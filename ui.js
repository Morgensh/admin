'use strict';

function msg(t){document.getElementById('msg').textContent=t;}

function updateHUD(){
  const pc=countries[PLAYER];if(!pc)return;
  document.getElementById('gold-val').textContent=Math.floor(pc.gold);
  const iv=document.getElementById('income-val');
  if(pc.starving){iv.textContent='⚠ ГОЛОД — население убывает';iv.style.color='#ff6060';}
  else if(taxUnrest(pc)){iv.textContent='⚠ НЕДОВОЛЬСТВО — население убывает';iv.style.color='#ff6060';}
  else{iv.textContent=`+${(income(pc)+taxIncome(pc)).toFixed(2)}/тик`;iv.style.color='#88aa66';}
  const rd=document.getElementById('res-display');
  const foodCons=totalPop(PLAYER)*FOOD_PER_POP;
  rd.innerHTML=RES.map(r=>{
    if(r.id==='food')return `<span${pc.starving?' style="color:#ff6060"':''}>${r.icon}${Math.floor(pc.resources[r.id].stock)} <small style="opacity:.7">(-${foodCons.toFixed(2)}/тик)</small></span>`;
    return `<span>${r.icon}${Math.floor(pc.resources[r.id].stock)}</span>`;
  }).join('')+`<span>👷${freeWorkers(pc)}</span>`;
  const hasCreditRequests=countries.some(needsLoan);
  document.getElementById('btn-market').classList.toggle('has-alert',hasCreditRequests);
}

// ── Панели ────────────────────────────────────────────────
function anyPanelOpen(){return['city-panel','pop-panel','dev-panel','market-panel','tax-panel'].some(id=>document.getElementById(id).style.display==='flex');}
function closeAllPanels(){['city-panel','pop-panel','dev-panel','market-panel','tax-panel'].forEach(id=>document.getElementById(id).style.display='none');selectedCity=null;}
function openCityPanel(id){selectedCity=id;refreshCityPanel();document.getElementById('city-panel').style.display='flex';}

function refreshCityPanel(){
  const c=cities.find(x=>x.id===selectedCity);if(!c)return;
  const co=countries[c.ownerId];
  document.getElementById('cp-title').textContent=`${c.isCapital?'⭐':'🏙'} ${cityLabel(c.pop)}`;
  document.getElementById('cp-title').style.color=co.id===PLAYER?'#ffd250':co.hex;
  const boost=c.investTicks>0?c.investBudget*POP_INVEST_RATE/POP_INVEST_TICKS:0;
  const incB=(0.5+(c.pop/POP_MAX)*2.5)*0.003;
  document.getElementById('cp-stats').innerHTML=`
    <div class="city-stat"><span>Страна</span><span style="color:${co.hex}">${co.name}</span></div>
    <div class="city-stat"><span>Население</span><span>${Math.floor(c.pop)} чел.</span></div>
    <div class="city-stat"><span>Тип</span><span>${cityLabel(c.pop)}</span></div>
    ${co.starving
      ?`<div class="city-stat" style="color:#ff6060"><span>⚠ Голод</span><span>-${(c.pop*STARVE_RATE).toFixed(1)}/тик</span></div>`
      :`<div class="city-stat"><span>Прирост</span><span>+${(POP_PASSIVE+boost).toFixed(1)}/тик</span></div>`}
    <div class="city-stat"><span>Доход</span><span>+${(incB*.5).toFixed(3)} 🪙/тик</span></div>
    ${co.loan&&co.loan.lenderId===PLAYER?`<div class="city-stat" style="color:#dcc01e"><span>💳 В долгу у вас</span><span>${co.loan.ticksLeft} тиков, ${Math.round(co.loan.rate*100)}%</span></div>`:''}
    ${c.investTicks>0?`<div class="city-stat"><span>Инвестиции</span><span style="color:#dcc01e">${c.investTicks} тиков</span></div>`:''}
  `;
  const isP=c.ownerId===PLAYER;
  document.getElementById('invest-row-wrap').style.display=isP?'flex':'none';
  document.getElementById('invest-btn').style.display=isP?'':'none';
  document.getElementById('invest-label').style.display=isP?'':'none';
  document.getElementById('invest-hint').textContent=isP?`Ускорит прирост на ${POP_INVEST_TICKS} тиков.`:'';
  if(isP){const sl=document.getElementById('invest-slider');sl.max=Math.min(500,Math.max(10,Math.floor(countries[PLAYER].gold)));document.getElementById('invest-val').textContent=sl.value+' 🪙';}
  const forSale=!isP&&isForSale(c);
  document.getElementById('buyout-block').style.display=forSale?'flex':'none';
  if(forSale){
    const price=buyoutPrice(c);
    const btn=document.getElementById('buyout-btn');
    btn.textContent=`💰 Выкупить за ${price} 🪙`;
    const can=countries[PLAYER].gold>=price;
    btn.style.opacity=can?'1':'.45';
    btn.onclick=()=>{
      const pc=countries[PLAYER];
      if(pc.gold<price){msg('Недостаточно золота для выкупа');return;}
      pc.gold-=price;
      const oldOwner=countries[c.ownerId];
      c.ownerId=PLAYER;c.investBudget=0;c.investTicks=0;
      if(!cities.some(x=>x.ownerId===oldOwner.id))oldOwner.alive=false;
      updateHUD();refreshCityPanel();msg(`🏙 Город выкуплен у ${oldOwner.name}!`);
    };
  }
}
document.getElementById('invest-slider').oninput=function(){document.getElementById('invest-val').textContent=this.value+' 🪙';};
document.getElementById('invest-btn').onclick=function(){
  const c=cities.find(x=>x.id===selectedCity);if(!c||c.ownerId!==PLAYER)return;
  const pc=countries[PLAYER],amt=parseInt(document.getElementById('invest-slider').value);
  if(pc.gold<amt){msg('Недостаточно золота!');return;}
  pc.gold-=amt;c.investBudget=amt;c.investTicks=POP_INVEST_TICKS;updateHUD();refreshCityPanel();msg(`💰 Вложено ${amt} 🪙`);
};
document.getElementById('cp-close').onclick=closeAllPanels;
document.getElementById('pop-close').onclick=closeAllPanels;
document.getElementById('dev-close').onclick=closeAllPanels;
document.getElementById('market-close').onclick=closeAllPanels;

// ── Панель население ──────────────────────────────────────
document.getElementById('btn-pop').onclick=()=>{
  const list=document.getElementById('pop-list');list.innerHTML='';
  const ranked=countries.filter(c=>c.alive).map(co=>({co,pop:totalPop(co.id),n:cities.filter(c=>c.ownerId===co.id).length})).sort((a,b)=>b.pop-a.pop);
  const mx=Math.max(1,ranked[0]?.pop||1);
  for(const{co,pop,n}of ranked){
    const row=document.createElement('div');row.className='pop-row';row.style.borderLeftColor=co.hex;
    row.innerHTML=`<div class="pop-name" style="color:${co.hex}">${co.name}${co.id===PLAYER?' ★':''}</div><div class="pop-bar-wrap"><div class="pop-bar-fill" style="width:${(pop/mx*100).toFixed(0)}%;background:${co.hex}"></div></div><div class="pop-num">${Math.floor(pop).toLocaleString()} чел.<br><span style="color:#445566;font-size:9px">${n} город(ов)</span></div>`;
    list.appendChild(row);
  }
  document.getElementById('pop-panel').style.display='flex';
};

// ── Месторождения на карте (просто toggle отображения) ────
document.getElementById('btn-res').onclick=function(){
  showRes=!showRes;
  this.classList.toggle('active',showRes);
  msg(showRes?'🗺 Тусклые — не разведаны, яркие — с шахтой':'Месторождения скрыты');
};

// ── Развитие: постройка шахт ───────────────────────────────
function openDevPanel(){
  const pc=countries[PLAYER];

  const sum=document.getElementById('dev-summary');sum.innerHTML='';
  for(const r of RES){
    const item=document.createElement('div');item.className='dev-sum-item';
    item.innerHTML=`<span class="ic">${r.icon}</span><span>${Math.floor(pc.resources[r.id].stock)}</span>`;
    sum.appendChild(item);
  }
  const goldItem=document.createElement('div');goldItem.className='dev-sum-item';
  goldItem.innerHTML=`<span class="ic">🪙</span><span style="color:#dcc01e">${Math.floor(pc.gold)}</span>`;
  sum.appendChild(goldItem);
  const popItem=document.createElement('div');popItem.className='dev-sum-item';
  popItem.innerHTML=`<span class="ic">👷</span><span style="color:#78aaff">${freeWorkers(pc)} свободных</span>`;
  sum.appendChild(popItem);

  // ── Баланс еды: сколько добывается и сколько потребляется населением ──
  const foodProd=foodProduction(pc);
  const foodCons=totalPop(PLAYER)*FOOD_PER_POP;
  const foodBal=foodProd-foodCons;
  const balEl=document.getElementById('dev-food-balance');
  balEl.style.color=foodBal>=0?'#3cc878':'#ff6060';
  balEl.innerHTML=`🌾 Добыча <b>+${foodProd.toFixed(2)}</b>/тик · Потребление <b>-${foodCons.toFixed(2)}</b>/тик · Баланс <b>${foodBal>=0?'+':''}${foodBal.toFixed(2)}</b>/тик`;

  const list=document.getElementById('dev-list');list.innerHTML='';
  for(const r of RES){
    const mine=deposits.filter(d=>d.ownerId===PLAYER&&d.res===r.id);
    if(!mine.length)continue;
    const isFarm=r.id==='food';
    const minedCount=mine.filter(d=>d.mined).length;
    const unminedCount=mine.length-minedCount;
    const cost=MINE_COST[r.id];
    const stock=Math.floor(pc.resources[r.id].stock);
    const block=document.createElement('div');
    block.className='dev-block';block.style.borderLeftColor=r.color;
    const costParts=[cost.wood?`${cost.wood}🌲`:null,cost.stone?`${cost.stone}🪨`:null,`${cost.money}🪙`,`${cost.workers}👷`].filter(Boolean).join(' + ');
    block.innerHTML=`
      <div class="dev-block-title" style="color:${r.color}">${r.icon} ${r.name}</div>
      <div class="city-stat"><span>Запас</span><span>${stock}</span></div>
      <div class="city-stat"><span>${isFarm?'Ферм построено':'Шахт построено'}</span><span>${minedCount} / ${mine.length}</span></div>
      <div class="city-stat"><span>Добыча сейчас</span><span>+${(minedCount*DEPOSIT_RATE[r.id]).toFixed(2)}/тик</span></div>
      <div class="city-stat"><span>Стоимость ${isFarm?'фермы':'шахты'}</span><span>${costParts}</span></div>
    `;
    const btnRow=document.createElement('div');btnRow.className='row';btnRow.style.marginTop='4px';
    if(unminedCount>0){
      const free=freeWorkers(pc);
      const lacks=[];
      if(cost.wood>pc.resources.wood.stock)lacks.push(`${Math.ceil(cost.wood-pc.resources.wood.stock)}🌲`);
      if(cost.stone>pc.resources.stone.stock)lacks.push(`${Math.ceil(cost.stone-pc.resources.stone.stock)}🪨`);
      if(cost.money>pc.gold)lacks.push(`${Math.ceil(cost.money-pc.gold)}🪙`);
      if(cost.workers>free)lacks.push(`${Math.ceil(cost.workers-free)}👷`);
      const can=lacks.length===0;
      const btn=document.createElement('button');
      btn.className='btn dev-build-btn'+(can?' btn-amber':'');
      if(!can)btn.style.opacity='.4';
      btn.textContent=`${isFarm?'🚜 Построить ферму':'🏗 Построить шахту'} (своб. ${unminedCount})`;
      btn.onclick=()=>{
        const target=deposits.find(d=>d.ownerId===PLAYER&&d.res===r.id&&!d.mined);
        if(!target)return;
        if(buildMine(pc,target.id)){updateHUD();openDevPanel();msg(`${isFarm?'🚜 Ферма построена':'🏗 Шахта построена'}: ${r.name}`);}
        else msg(`Недостаточно ресурсов или рабочих рук для постройки ${isFarm?'фермы':'шахты'}`);
      };
      btnRow.appendChild(btn);
      if(lacks.length){
        const hint=document.createElement('span');hint.style.fontSize='9px';hint.style.color='#ff8866';
        hint.textContent=`не хватает: ${lacks.join(', ')}`;
        if(cost.workers>free)hint.textContent+=' (нужно больше населения)';
        btnRow.appendChild(hint);
      }
    } else {
      const span=document.createElement('span');span.style.fontSize='9px';span.style.color='#445566';span.textContent='Все известные месторождения освоены';
      btnRow.appendChild(span);
    }
    block.appendChild(btnRow);
    list.appendChild(block);
  }
  if(!list.children.length)list.innerHTML='<p style="font-size:10px;color:#556;text-align:center;padding:20px 0;">На вашей территории пока нет месторождений</p>';
  document.getElementById('dev-panel').style.display='flex';
}
document.getElementById('btn-dev').onclick=openDevPanel;
document.getElementById('dev-to-market').onclick=()=>{closeAllPanels();openMarket();};

// ── Налоги ────────────────────────────────────────────────
function refreshTaxPanel(){
  const pc=countries[PLAYER];
  const ti=taxIncome(pc);
  const gf=taxGrowthFactor(pc);
  const unrest=taxUnrest(pc);
  document.getElementById('tax-stats').innerHTML=`
    <div class="city-stat"><span>Ставка налога</span><span>${Math.round(pc.taxRate*100)}%</span></div>
    <div class="city-stat"><span>Население</span><span>${Math.floor(totalPop(PLAYER))} чел.</span></div>
    <div class="city-stat"><span>Доход с налога</span><span style="color:#dcc01e">+${ti.toFixed(2)} 🪙/тик</span></div>
    <div class="city-stat"><span>Прирост населения</span><span style="color:${gf<1?'#ffb43c':'#3cc878'}">×${gf.toFixed(2)}</span></div>
    ${unrest?`<div class="city-stat" style="color:#ff6060"><span>⚠ Недовольство</span><span>население убывает</span></div>`:''}
  `;
  document.getElementById('tax-hint').textContent=unrest
    ?'Слишком высокая ставка — люди в открытом недовольстве, население тает быстрее, чем растёт.'
    :'Выше ставка — больше золота прямо сейчас, но население (а с ним и будущий доход, и рабочие руки) растёт медленнее.';
}
document.getElementById('btn-tax').onclick=()=>{
  const sl=document.getElementById('tax-slider');
  sl.value=Math.round(countries[PLAYER].taxRate*100);
  document.getElementById('tax-val').textContent=sl.value+'%';
  refreshTaxPanel();
  document.getElementById('tax-panel').style.display='flex';
};
document.getElementById('tax-slider').oninput=function(){
  const v=parseInt(this.value);
  document.getElementById('tax-val').textContent=v+'%';
  countries[PLAYER].taxRate=v/100;
  refreshTaxPanel();updateHUD();
};
document.getElementById('tax-close').onclick=closeAllPanels;