'use strict';

function buyoutPrice(c){return Math.round(60+c.pop*2.2);}
function isForSale(c){const co=countries[c.ownerId];return co&&co.id!==PLAYER&&co.alive&&(co.weakTicks||0)>=WEAK_TICKS_NEEDED;}

function initResources(co){
  co.resources={};
  for(const r of RES)co.resources[r.id]={stock:0};
  co.resources.wood.stock=50;
  co.resources.stone.stock=30; // стартовый запас, чтобы можно было сразу основать второй город
  co.resources.food.stock=40;  // запас еды на старте, пока не построена первая ферма
  co.starving=false;
  co.foodRatio=1; // отношение добычи еды к потребности — используется, чтобы плавно тормозить прирост населения заранее
}

// сколько еды страна добывает за тик со всех построенных ферм (с учётом качества почвы)
function foodProduction(co){
  return deposits.reduce((s,d)=>s+((d.ownerId===co.id&&d.res==='food'&&d.mined)?DEPOSIT_RATE.food*(d.quality||1):0),0);
}

// добыча за тик: суммируем по всем построенным шахтам/фермам страны (еда учитывает качество почвы)
// если страна взяла кредит — часть добычи автоматически уходит кредитору, пока долг не погашен
function tickResources(co){
  const loan=co.loan;
  for(const r of RES){
    let total=0;
    for(const d of deposits){
      if(d.ownerId===co.id&&d.res===r.id&&d.mined)total+=DEPOSIT_RATE[r.id]*(d.quality||1);
    }
    if(total<=0)continue;
    if(loan){
      const cut=total*loan.rate;
      co.resources[r.id].stock=Math.min(9999,co.resources[r.id].stock+(total-cut));
      const lender=countries[loan.lenderId];
      if(lender)lender.resources[r.id].stock=Math.min(9999,lender.resources[r.id].stock+cut);
    } else {
      co.resources[r.id].stock=Math.min(9999,co.resources[r.id].stock+total);
    }
  }
}

// сколько работников уже занято на шахтах/фермах страны
function workersUsed(co){
  return deposits.reduce((s,d)=>s+((d.ownerId===co.id&&d.mined)?MINE_COST[d.res].workers:0),0);
}
function freeWorkers(co){return Math.max(0,Math.floor(totalPop(co.id))-workersUsed(co));}

function canAffordMine(co,res){
  const c=MINE_COST[res];
  return co.resources.wood.stock>=c.wood&&co.resources.stone.stock>=c.stone&&co.gold>=c.money&&freeWorkers(co)>=c.workers;
}
function buildMine(co,depositId){
  const d=deposits.find(x=>x.id===depositId);
  if(!d||d.mined||d.ownerId!==co.id)return false;
  const c=MINE_COST[d.res];
  if(co.resources.wood.stock<c.wood||co.resources.stone.stock<c.stone||co.gold<c.money||freeWorkers(co)<c.workers)return false;
  co.resources.wood.stock-=c.wood;co.resources.stone.stock-=c.stone;co.gold-=c.money;
  d.mined=true;
  return true;
}

function cityIncomeBonus(co){return cities.filter(c=>c.ownerId===co.id).reduce((s,c)=>s+(0.5+(c.pop/POP_MAX)*2.5),0);}
function income(co){return Math.max(0.2,tiles(co.id).length/1000)+cityIncomeBonus(co)*0.003;}
function totalPop(id){return cities.filter(c=>c.ownerId===id).reduce((s,c)=>s+c.pop,0);}

// ── Налоги: население теперь напрямую влияет на казну через ставку ────
function taxIncome(co){return totalPop(co.id)*TAX_PER_POP*co.taxRate;}
// чем выше ставка — тем медленнее растёт население (люди меньше вкладываются в семью/дело при высоких поборах)
function taxGrowthFactor(co){return Math.max(0.25,1-co.taxRate*TAX_GROWTH_PENALTY);}
// за порогом начинается открытое недовольство — население тает независимо от голода
function taxUnrest(co){return co.taxRate>TAX_UNREST_THRESHOLD;}

// ── Кредиты (долговая зависимость) ────────────────────────────
// страна сама "просит кредит", если попала в реальный экономический кризис и ещё не должна игроку
function needsLoan(co){return co&&co.id!==PLAYER&&co.alive&&!co.loan&&(co.weakTicks||0)>=WEAK_TICKS_NEEDED;}
// сумма, которую страна просит — чем дольше в кризисе, тем больше ей нужно
function requestedLoanAmount(co){
  const over=Math.max(0,(co.weakTicks||0)-WEAK_TICKS_NEEDED);
  return Math.round(Math.min(LOAN_MAX_AMOUNT,LOAN_MIN_AMOUNT+over*3));
}
// выдать заём: игрок платит стране сумму сразу, взамен LOAN_RATE её добычи/дохода идёт игроку LOAN_DURATION тиков
function issueLoan(co,amount){
  const pc=countries[PLAYER];
  if(pc.gold<amount)return false;
  pc.gold-=amount;co.gold+=amount;
  co.loan={lenderId:PLAYER,rate:LOAN_RATE,ticksLeft:LOAN_DURATION,totalTicks:LOAN_DURATION,amount};
  co.weakTicks=0;
  return true;
}
// конфискация города в счёт непогашенного долга (если к концу срока страна так и не вышла из кризиса)
function foreclose(co){
  const mine=cities.filter(c=>c.ownerId===co.id);
  if(!mine.length)return;
  const target=mine.find(c=>!c.isCapital)||mine[0]; // забираем не столицу, если есть выбор
  target.ownerId=PLAYER;target.investBudget=0;target.investTicks=0;
  if(!cities.some(c=>c.ownerId===co.id))co.alive=false;
  msg(`⚖ ${co.name} не расплатилась по кредиту — город конфискован в счёт долга!`);
}

// ── Главный игровой тик (раз в 500мс) ────────────────────────
function startEconomy(){
  if(ecoTimer)clearInterval(ecoTimer);
  const rand=rng(Date.now()%99991);
  ecoTimer=setInterval(()=>{
    for(const c of cities){
      const co=countries[c.ownerId];
      if(co&&co.starving){
        c.pop=Math.max(5,c.pop-c.pop*STARVE_RATE);
      } else if(co&&taxUnrest(co)){
        const over=co.taxRate-TAX_UNREST_THRESHOLD;
        c.pop=Math.max(5,c.pop-c.pop*TAX_UNREST_RATE*(1+over*4));
      } else {
        const boost=c.investTicks>0?c.investBudget*POP_INVEST_RATE/POP_INVEST_TICKS:0;
        // прирост заранее тормозится, если добыча еды не поспевает за населением — так рост плавно выходит на плато, а не срывается в голод рывком
        const foodBrake=co?Math.min(1,co.foodRatio??1):1;
        const growth=(POP_PASSIVE+boost)*(co?taxGrowthFactor(co):1)*foodBrake;
        c.pop=Math.min(POP_MAX,c.pop+growth);
        if(c.investTicks>0)c.investTicks--;
      }
    }
    for(const co of countries){if(!co.alive)continue;
      const incAmt=income(co)*.5+taxIncome(co);
      if(co.loan){
        const cut=incAmt*co.loan.rate;
        co.gold+=incAmt-cut;
        const lender=countries[co.loan.lenderId];if(lender)lender.gold+=cut;
      } else {
        co.gold+=incAmt;
      }
      tickResources(co);
      const foodNeed=totalPop(co.id)*FOOD_PER_POP;
      co.foodRatio=foodNeed>0?Math.min(1.2,foodProduction(co)/foodNeed):1;
      if(co.resources.food.stock>=foodNeed){co.resources.food.stock-=foodNeed;co.starving=false;}
      else{co.resources.food.stock=0;co.starving=true;}
      if(co.id!==PLAYER){co.weakTicks=(co.gold<WEAK_GOLD)?(co.weakTicks||0)+1:0;}
      if(co.loan){
        co.loan.ticksLeft--;
        if(co.loan.ticksLeft<=0){
          const stillWeak=co.gold<WEAK_GOLD;
          co.loan=null;
          if(stillWeak)foreclose(co);
        }
      }
    }
    runAI(rand);
    updateHUD();
    if(selectedCity!==null)refreshCityPanel();
    if(document.getElementById('dev-panel').style.display==='flex')openDevPanel();
    if(document.getElementById('market-panel').style.display==='flex'&&marketTab==='credit')renderCreditList();
    if(document.getElementById('tax-panel').style.display==='flex')refreshTaxPanel();
  },500);
}