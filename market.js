'use strict';

// колебание рыночных цен — раз в тик, по всем ресурсам сразу
function tickMarketPrices(rand){
  for(const r of RES){
    const supply=marketOrders.filter(o=>o.res===r.id).reduce((s,o)=>s+o.qty,0);
    const base=r.base;
    marketPrice[r.id]=Math.max(base*.5,Math.round(base*(1+(supply>100?-0.2:supply<20?0.2:0))+(rand()-.5)*base*.1));
  }
}

function renderMarketTabs(){
  document.getElementById('tab-buy').classList.toggle('active',marketTab==='buy');
  document.getElementById('tab-sell').classList.toggle('active',marketTab==='sell');
  document.getElementById('tab-credit').classList.toggle('active',marketTab==='credit');
  document.getElementById('market-buy-view').style.display=marketTab==='buy'?'':'none';
  document.getElementById('market-sell-view').style.display=marketTab==='sell'?'':'none';
  document.getElementById('market-credit-view').style.display=marketTab==='credit'?'':'none';
  document.getElementById('market-action').style.display=marketTab==='sell'?'':'none';
}

function renderMarketOrders(){
  const container=document.getElementById('market-orders');
  const empty=document.getElementById('market-empty');
  container.innerHTML='';
  const pc=countries[PLAYER];
  const orders=marketOrders.slice().sort((a,b)=>a.price-b.price);
  if(!orders.length){empty.style.display='';return;}
  empty.style.display='none';
  for(const o of orders){
    const seller=countries.find(c=>c.id===o.sellerId);
    const r=resById(o.res);
    const row=document.createElement('div');row.className='order-row';
    const isOwn=o.sellerId===PLAYER;
    const defQty=Math.max(1,Math.min(o.qty,Math.floor(pc.gold/o.price)||1));
    row.innerHTML=`
      <span class="order-res">${r.icon}</span>
      <div class="order-info">
        <b>${r.name} × ${o.qty}</b>
        <span style="color:${seller?.hex||'#888'}">${seller?.name||'?'}</span>
        <span style="font-size:9px;color:#445566;"> · рынок: ${marketPrice[o.res]}🪙</span>
      </div>
      <span class="order-price">${o.price}🪙/ед</span>
      ${isOwn
        ? `<button class="btn order-buy-btn" style="border-color:rgba(255,60,60,.4);color:#ff6060;" data-oid="${o.id}">Снять</button>`
        : `<input type="number" class="buy-qty-input" min="1" max="${o.qty}" value="${defQty}" style="width:44px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#c8d4e8;font-family:'Courier New',monospace;font-size:9px;border-radius:3px;padding:3px 4px;">
           <button class="btn order-buy-btn btn-green" data-oid="${o.id}">Купить</button>`}
    `;
    container.appendChild(row);
    row.querySelector('.order-buy-btn').onclick=()=>{
      if(isOwn){cancelOrder(o.id);}
      else{
        const input=row.querySelector('.buy-qty-input');
        const qty=Math.max(1,parseInt(input.value)||1);
        buyOrder(o.id,qty);
      }
    };
  }
}

function buyOrder(oid,wantQty){
  const o=marketOrders.find(x=>x.id===oid);if(!o)return;
  const pc=countries[PLAYER];
  const askQty=Math.max(1,Math.min(wantQty||o.qty,o.qty));
  const maxQty=Math.min(askQty,Math.floor(pc.gold/o.price));
  if(maxQty<=0){msg('Недостаточно золота!');return;}
  const cost=maxQty*o.price;
  pc.gold-=cost;
  pc.resources[o.res].stock+=maxQty;
  const seller=countries.find(c=>c.id===o.sellerId);
  if(seller)seller.gold+=cost;
  o.qty-=maxQty;
  if(o.qty<=0)marketOrders=marketOrders.filter(x=>x.id!==oid);
  updateHUD();renderMarketOrders();
  msg(`✅ Куплено ${maxQty} ${resById(o.res).name} за ${cost}🪙`);
}

function cancelOrder(oid){
  const o=marketOrders.find(x=>x.id===oid);if(!o)return;
  countries[PLAYER].resources[o.res].stock+=o.qty;
  marketOrders=marketOrders.filter(x=>x.id!==oid);
  renderMarketOrders();
  msg('Лот снят с рынка');
}

function renderSellForm(){
  const pc=countries[PLAYER];
  const sel=document.getElementById('sell-res');
  sel.innerHTML='';
  const myRes=RES.filter(r=>pc.resources[r.id].stock>0);
  if(!myRes.length){document.getElementById('sell-hint').textContent='У вас нет ресурсов для продажи';return;}
  for(const r of myRes){
    const op=document.createElement('option');op.value=r.id;op.textContent=`${r.icon} ${r.name} (${Math.floor(pc.resources[r.id].stock)} ед.)`;sel.appendChild(op);
  }
  updateSellHint();
  sel.onchange=updateSellHint;
  document.getElementById('sell-price').value=marketPrice[sel.value]||10;
}

function updateSellHint(){
  const rid=document.getElementById('sell-res').value;
  if(!rid)return;
  document.getElementById('sell-hint').textContent=`Рыночная цена: ${marketPrice[rid]}🪙/ед`;
  document.getElementById('sell-price').value=marketPrice[rid];
}

function renderCreditList(){
  const container=document.getElementById('credit-list');
  const empty=document.getElementById('credit-empty');
  container.innerHTML='';
  const pc=countries[PLAYER];
  const requesters=countries.filter(needsLoan);
  if(!requesters.length){empty.style.display='';return;}
  empty.style.display='none';
  for(const co of requesters){
    const amount=requestedLoanAmount(co);
    const canAfford=pc.gold>=amount;
    const row=document.createElement('div');row.className='order-row';row.style.flexDirection='column';row.style.alignItems='stretch';row.style.gap='6px';
    row.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:${co.hex};font-size:11px;letter-spacing:1px;text-transform:uppercase;flex:1;">${co.name}</span>
        <span style="font-size:9px;color:#ff8866;">⚠ в кризисе</span>
      </div>
      <div style="font-size:9px;color:#889aab;">Просит <b style="color:#dcc01e">${amount} 🪙</b> · вернёт ${Math.round(LOAN_RATE*100)}% добычи и дохода в течение ${LOAN_DURATION} тиков</div>
      <div style="font-size:9px;color:#ff6060;">Если не расплатится к сроку — вы заберёте один из её городов бесплатно</div>
    `;
    const btn=document.createElement('button');
    btn.className='btn order-buy-btn btn-green';btn.style.alignSelf='flex-end';
    btn.textContent=canAfford?`💰 Выдать кредит ${amount} 🪙`:'Недостаточно золота';
    if(!canAfford)btn.style.opacity='.45';
    btn.onclick=()=>{
      if(issueLoan(co,amount)){updateHUD();renderCreditList();msg(`💰 Выдан кредит ${co.name}: ${amount} 🪙 под ${Math.round(LOAN_RATE*100)}%`);}
      else msg('Недостаточно золота для кредита');
    };
    row.appendChild(btn);
    container.appendChild(row);
  }
}

function openMarket(){
  marketTab='buy';renderMarketTabs();renderMarketOrders();
  document.getElementById('market-panel').style.display='flex';
}

document.getElementById('btn-market').onclick=()=>openMarket();
document.getElementById('tab-buy').onclick=()=>{marketTab='buy';renderMarketTabs();renderMarketOrders();};
document.getElementById('tab-sell').onclick=()=>{marketTab='sell';renderMarketTabs();renderSellForm();};
document.getElementById('tab-credit').onclick=()=>{marketTab='credit';renderMarketTabs();renderCreditList();};

document.getElementById('market-action').onclick=()=>{
  const pc=countries[PLAYER];
  const rid=document.getElementById('sell-res').value;
  const qty=parseInt(document.getElementById('sell-qty').value)||0;
  const price=parseInt(document.getElementById('sell-price').value)||0;
  if(!rid||qty<=0||price<=0){msg('Заполни все поля');return;}
  if(pc.resources[rid].stock<qty){msg('Недостаточно ресурса');return;}
  pc.resources[rid].stock-=qty;
  marketOrders.push({id:orderNextId++,sellerId:PLAYER,res:rid,qty,price});
  msg(`📦 Лот выставлен: ${qty} ${resById(rid).name} по ${price}🪙`);
  marketTab='buy';renderMarketTabs();renderMarketOrders();
};