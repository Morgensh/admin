'use strict';

// AI торговля: иногда выставляет ресурсы, иногда покупает
function aiMarketTick(co,rand){
  if(co.id===PLAYER||!co.alive)return;
  if(rand()<0.15){
    for(const r of RES){
      const rs=co.resources[r.id];
      if(rs.stock>50&&rand()<0.4){
        const qty=Math.floor(rand()*20+5);
        const price=Math.max(1,Math.round(marketPrice[r.id]*(0.9+rand()*0.3)));
        marketOrders.push({id:orderNextId++,sellerId:co.id,res:r.id,qty,price});
        rs.stock-=qty;
        break;
      }
    }
  }
  if(rand()<0.1&&co.gold>30){
    const cheap=marketOrders.filter(o=>o.sellerId!==co.id&&o.price<=marketPrice[o.res]*1.1);
    if(cheap.length){
      const o=cheap[Math.floor(rand()*cheap.length)];
      const buyQty=Math.min(o.qty,Math.floor(co.gold/o.price));
      if(buyQty>0){
        co.gold-=buyQty*o.price;
        co.resources[o.res].stock+=buyQty;
        o.qty-=buyQty;
        if(o.qty<=0)marketOrders=marketOrders.filter(x=>x.id!==o.id);
        const seller=countries.find(c=>c.id===o.sellerId);
        if(seller)seller.gold+=buyQty*o.price;
      }
    }
  }
}

// AI строит шахты на своих месторождениях
function aiTickMines(co,rand){
  if(co.id===PLAYER||!co.alive)return;
  if(aiTickN%10!==co.id%10)return;
  const unmined=deposits.filter(d=>d.ownerId===co.id&&!d.mined);
  if(!unmined.length)return;
  const d=unmined[Math.floor(rand()*unmined.length)];
  if(canAffordMine(co,d.res))buildMine(co,d.id);
}

// AI основывает новый город, если хватает золота+дерева+камня
function aiCanFoundCity(co){return co.gold>=CITY_GOLD&&co.resources.wood.stock>=CITY_WOOD&&co.resources.stone.stock>=CITY_STONE;}
function aiFoundCity(co){co.gold-=CITY_GOLD;co.resources.wood.stock-=CITY_WOOD;co.resources.stone.stock-=CITY_STONE;}

// AI пересматривает налоговую ставку: поднимает при нехватке золота, снижает если хочет растить население
function aiTickTax(co,rand){
  if(co.id===PLAYER||!co.alive)return;
  if(aiTickN%AI_TAX_INT!==co.id%AI_TAX_INT)return;
  if(co.gold<WEAK_GOLD*1.5)co.taxRate=Math.min(0.6,co.taxRate+0.05+rand()*0.03);
  else if(totalPop(co.id)<300)co.taxRate=Math.max(0.05,co.taxRate-0.03-rand()*0.03);
}

function runAI(rand){
  for(const co of countries){
    if(co.id===PLAYER||!co.alive)continue;
    if(aiTickN%AI_INVEST_INT===co.id%AI_INVEST_INT){
      const mc=cities.filter(c=>c.ownerId===co.id);
      if(mc.length&&co.gold>=AI_INVEST_AMT){const t=mc[Math.floor(rand()*mc.length)];co.gold-=AI_INVEST_AMT;t.investBudget=AI_INVEST_AMT;t.investTicks=POP_INVEST_TICKS;}
    }
    if(aiTickN%AI_BUILD_INT===co.id%AI_BUILD_INT&&aiCanFoundCity(co)){
      const tl=tiles(co.id);
      for(let a=0;a<30;a++){
        const ti=tl[Math.floor(rand()*tl.length)],wx=ti%MW,wy=ti/MW|0;
        if(!cities.some(c=>Math.hypot(c.x-wx,c.y-wy)<CITY_MIN_D)){
          aiFoundCity(co);
          cities.push({id:nextId++,ownerId:co.id,x:wx,y:wy,pop:50+Math.floor(rand()*150),investBudget:0,investTicks:0,isCapital:false});
          break;
        }
      }
    }
    aiMarketTick(co,rand);
    aiTickMines(co,rand);
    aiTickTax(co,rand);
  }
  tickMarketPrices(rand);
  aiTickN++;
}