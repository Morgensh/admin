'use strict';

function newGame(){
  buildMode=false;updBtn();selectedCity=null;closeAllPanels();
  showRes=false;document.getElementById('btn-res').classList.remove('active');
  const pi=Math.floor(Math.random()*PRESETS.length);P=PRESETS[pi];MW=P.mw;MH=P.mh;
  generate((Date.now()%999983+Math.random()*1000)|0);
  fitView();startEconomy();
  msg(`🌾 Стройте фермы — без еды население начнёт убывать! 🏙 Город: ${CITY_GOLD}🪙+${CITY_WOOD}🌲+${CITY_STONE}🪨`);
}

function boot(){
  // на некоторых мобильных браузерах при первой отрисовке адресная строка ещё "гуляет",
  // и window.innerHeight/innerWidth могут на мгновение оказаться некорректными (0 или устаревшими) —
  // ждём следующего кадра, чтобы размеры точно устоялись перед генерацией карты
  requestAnimationFrame(()=>{
    try{
      if(!window.innerWidth||!window.innerHeight)throw new Error(`Некорректный размер окна: ${window.innerWidth}x${window.innerHeight}`);
      resize();newGame();draw();
    }catch(err){
      showErr((err&&err.stack)||String(err));
    }
  });
}
boot();
