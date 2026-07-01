'use strict';

function newGame(){
  buildMode=false;updBtn();selectedCity=null;closeAllPanels();
  showRes=false;document.getElementById('btn-res').classList.remove('active');
  const pi=Math.floor(Math.random()*PRESETS.length);P=PRESETS[pi];MW=P.mw;MH=P.mh;
  generate((Date.now()%999983+Math.random()*1000)|0);
  fitView();startEconomy();
  msg(`🌾 Стройте фермы — без еды население начнёт убывать! 🏙 Город: ${CITY_GOLD}🪙+${CITY_WOOD}🌲+${CITY_STONE}🪨`);
}

resize();newGame();draw();