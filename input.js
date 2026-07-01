'use strict';

function cityLabel(p){return p<100?'Деревня':p<400?'Посёлок':p<800?'Город':p<1500?'Большой город':'Мегаполис';}
function gearRadius(pop){return GEAR_MIN_R+(GEAR_MAX_R-GEAR_MIN_R)*Math.sqrt(Math.min(1,pop/POP_MAX));}

// canvas.width/height теперь в физических пикселях (canvas.width=CSS-ширина*dpr), а вся камера (vx/vy/vs)
// живёт в CSS-пикселях — поэтому здесь всегда делим на dpr, чтобы получить реальный размер вьюпорта
function clamp(){const cw=canvas.width/dpr,ch=canvas.height/dpr;vx=Math.max(cw*.1-MW*vs,Math.min(cw*.9,vx));vy=Math.max(ch*.1-MH*vs,Math.min(ch*.9,vy));}
function fitView(){const cw=canvas.width/dpr,ch=canvas.height/dpr;vs=Math.max(cw/MW,ch/MH)*1.05;vx=(cw-MW*vs)/2;vy=(ch-MH*vs)/2;}

function drawGear(x,y,color,R){
  const teeth=Math.max(5,Math.round(R*.9)),ri=R*.62,rh=R*.26;
  ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=4;ctx.shadowOffsetY=1;
  ctx.beginPath();
  for(let i=0;i<teeth*2;i++){const a=(Math.PI*i/teeth)-Math.PI/(teeth*2),rr=i%2===0?R:ri;i===0?ctx.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}
  ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=Math.max(.4,R*.07);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,rh,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
}
function drawDeposit(d){
  const r=resById(d.res);
  ctx.save();
  ctx.globalAlpha=d.mined?1:0.5;
  if(d.mined){
    ctx.beginPath();ctx.arc(d.x,d.y,7,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fill();
    ctx.strokeStyle=r.color;ctx.lineWidth=1;ctx.stroke();
  }
  ctx.font='9px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(r.icon,d.x,d.y);
  ctx.restore();
}

function draw(){
  ctx.fillStyle='#06080f';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!offC){requestAnimationFrame(draw);return;}
  // ctx.scale(dpr,dpr) первым — переводит все дальнейшие CSS-пиксельные координаты (vx/vy/vs)
  // в физические пиксели canvas. Без этого на retina-экранах картинка растягивается и мылится.
  ctx.save();ctx.scale(dpr,dpr);ctx.translate(vx,vy);ctx.scale(vs,vs);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(offC,0,0);
  for(const co of countries){
    if(!co.alive||!co.capital)continue;
    const{x,y}=co.capital;
    ctx.beginPath();for(let i=0;i<10;i++){const a=Math.PI*i/5-Math.PI/2,r=i%2?2.5:5;i?ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}
    ctx.closePath();ctx.fillStyle=co.hex;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=.6;ctx.stroke();
    ctx.font=`${co.id===PLAYER?'bold ':''}7px Courier New`;ctx.textAlign='center';ctx.textBaseline='top';
    const gw=ctx.measureText(co.name).width+6;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x-gw/2,y+7,gw,10);
    ctx.fillStyle=co.id===PLAYER?'#ffd250':co.hex;ctx.fillText(co.name,x,y+8);
  }
  for(const c of cities){
    const co=countries[c.ownerId];if(!co?.alive)continue;
    const R=gearRadius(c.pop),isP=co.id===PLAYER;
    if(c.investTicks>0&&isP){ctx.beginPath();ctx.arc(c.x,c.y,R+4,0,Math.PI*2);ctx.strokeStyle='rgba(255,210,60,.4)';ctx.lineWidth=2;ctx.stroke();}
    if(isForSale(c)){
      const pulse=0.55+0.45*Math.sin(Date.now()/260);
      ctx.beginPath();ctx.arc(c.x,c.y,R+5,0,Math.PI*2);ctx.strokeStyle=`rgba(255,90,90,${pulse})`;ctx.lineWidth=2.2;ctx.stroke();
      ctx.font='7px serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('💰',c.x,c.y-R-4);
    }
    drawGear(c.x,c.y,isP?'#ffd250':co.hex,R);
    if(R>5){const lbl=Math.floor(c.pop)+'';ctx.font='5.5px Courier New';ctx.textAlign='center';ctx.textBaseline='top';const gw=ctx.measureText(lbl).width+4;ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(c.x-gw/2,c.y+R+1,gw,7);ctx.fillStyle=isP?'#ffd250':co.hex;ctx.fillText(lbl,c.x,c.y+R+2);}
  }
  if(showRes){
    for(const d of deposits){
      const co=countries[d.ownerId];if(!co?.alive)continue;
      drawDeposit(d);
    }
  }
  ctx.restore();
  requestAnimationFrame(draw);
}
