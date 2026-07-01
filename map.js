'use strict';

class SN{
  constructor(s){
    this.g=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
    const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;
    let r=s*2147483647|0;
    for(let i=255;i>0;i--){r=(r*1664525+1013904223)&0x7fffffff;const j=r%(i+1);[p[i],p[j]]=[p[j],p[i]];}
    this.pm=new Uint8Array(512);this.pm12=new Uint8Array(512);
    for(let i=0;i<512;i++){this.pm[i]=p[i&255];this.pm12[i]=this.pm[i]%12;}
  }
  dot(g,x,y){return g[0]*x+g[1]*y;}
  n(xi,yi){
    const F=.5*(Math.sqrt(3)-1),G=(3-Math.sqrt(3))/6;
    const s=(xi+yi)*F,i=Math.floor(xi+s),j=Math.floor(yi+s),t=(i+j)*G;
    const x0=xi-(i-t),y0=yi-(j-t);let i1,j1;x0>y0?(i1=1,j1=0):(i1=0,j1=1);
    const x1=x0-i1+G,y1=y0-j1+G,x2=x0-1+2*G,y2=y0-1+2*G;
    const ii=i&255,jj=j&255;
    const g0=this.pm12[ii+this.pm[jj]],g1=this.pm12[ii+i1+this.pm[jj+j1]],g2=this.pm12[ii+1+this.pm[jj+1]];
    let t0=.5-x0*x0-y0*y0,n0=t0<0?0:(t0*=t0,t0*t0*this.dot(this.g[g0],x0,y0));
    let t1=.5-x1*x1-y1*y1,n1=t1<0?0:(t1*=t1,t1*t1*this.dot(this.g[g1],x1,y1));
    let t2=.5-x2*x2-y2*y2,n2=t2<0?0:(t2*=t2,t2*t2*this.dot(this.g[g2],x2,y2));
    return 70*(n0+n1+n2);
  }
  oct(x,y,o,p,l){let v=0,a=1,f=1,m=0;for(let i=0;i<o;i++){v+=this.n(x*f,y*f)*a;m+=a;a*=p;f*=l;}return v/m;}
}
function rng(s){let r=s|0;return()=>{r=Math.imul(r^r>>>15,1|r);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}

function tiles(id){if(tcache[id])return tcache[id];const t=[];for(let i=0;i<MW*MH;i++)if(cmap[i]===id)t.push(i);return tcache[id]=t;}

function buildOffscreen(){
  offC=document.createElement('canvas');offC.width=MW;offC.height=MH;
  const oc=offC.getContext('2d'),id=oc.createImageData(MW,MH),dd=id.data;
  for(let i=0;i<MW*MH;i++){
    const h=hmap[i],cid=cmap[i];let r,g,b;
    if(h<-.12){const t=Math.max(0,Math.min(1,(h+.38)/.26));r=WATER_COLOR[0]+Math.round((SHORE_COLOR[0]-WATER_COLOR[0])*t);g=WATER_COLOR[1]+Math.round((SHORE_COLOR[1]-WATER_COLOR[1])*t);b=WATER_COLOR[2]+Math.round((SHORE_COLOR[2]-WATER_COLOR[2])*t);}
    else if(h<.065){r=SHORE_COLOR[0];g=SHORE_COLOR[1];b=SHORE_COLOR[2];}
    else{const[cr,cg,cb]=DEFS[cid].rgb;const sh=Math.max(.72,Math.min(1,0.78+h*.44));r=Math.min(255,cr*sh)|0;g=Math.min(255,cg*sh)|0;b=Math.min(255,cb*sh)|0;const vr=((i*2654435761)>>>0)%5-2;r=Math.max(0,Math.min(255,r+vr));g=Math.max(0,Math.min(255,g+vr));b=Math.max(0,Math.min(255,b+vr));}
    if(cid>=0&&i%MW>0&&i%MW<MW-1&&i/MW|0>0&&(i/MW|0)<MH-1){const nb=[cmap[i+1],cmap[i-1],cmap[i+MW],cmap[i-MW]];if(nb.some(n=>n!==cid)){r=Math.min(255,r+90);g=Math.min(255,g+90);b=Math.min(255,b+90);}}
    dd[i*4]=r;dd[i*4+1]=g;dd[i*4+2]=b;dd[i*4+3]=255;
  }
  oc.putImageData(id,0,0);
  const vg=oc.createRadialGradient(MW/2,MH/2,MW*.18,MW/2,MH/2,MW*.72);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.22)');
  oc.fillStyle=vg;oc.fillRect(0,0,MW,MH);
}

function generate(seed){
  const rand=rng(seed);
  const n1=new SN(rand()*1000);
  const n2=new SN(rand()*1000+777); // отдельный шум для плодородия почвы
  hmap=new Float32Array(MW*MH);cmap=new Int8Array(MW*MH).fill(-1);fmap=new Float32Array(MW*MH);
  nextId=1;tcache={};cities=[];aiTickN=0;marketOrders=[];orderNextId=1;deposits=[];depNextId=1;
  countries=DEFS.map(d=>({...d,gold:120+Math.floor(rand()*60),capital:null,alive:true,loan:null,taxRate:d.id===PLAYER?TAX_DEFAULT:(AI_TAX_MIN+rand()*(AI_TAX_MAX-AI_TAX_MIN))}));
  for(const co of countries)initResources(co);

  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const nx=x/MW-.5,ny=y/MH-.5,d=Math.sqrt((nx/P.rx)**2+(ny/P.ry)**2);
    const dome=Math.pow(Math.max(0,1-d),2.2);
    const noise=n1.oct(x/MW*2.8,y/MH*2.8,7,.5,2.05)+n1.oct(x/MW*1.1,y/MH*1.1,3,.45,2.2)*.22;
    hmap[y*MW+x]=dome*1.14+noise*.26-.20-(d>1?(d-1)*3.2:0);
    const fert=n2.oct(x/MW*1.6,y/MH*1.6,4,.5,2.1);
    fmap[y*MW+x]=Math.max(0,Math.min(1,(fert+1)/2));
  }

  const land=[];for(let i=0;i<MW*MH;i++)if(hmap[i]>=.065)land.push(i);
  if(land.length<400){generate(seed+1);return;}
  const seeds=[];let tries=0;const minD=Math.min(MW,MH)*.15;
  while(seeds.length<NC&&tries<8000){tries++;const i=land[Math.floor(rand()*land.length)];const sx=i%MW,sy=i/MW|0;if(seeds.every(s=>Math.hypot(sx-s.x,sy-s.y)>=minD))seeds.push({x:sx,y:sy});}
  if(seeds.length<NC){generate(seed+1);return;}

  for(let i=0;i<MW*MH;i++){if(hmap[i]<.065)continue;const x=i%MW,y=i/MW|0;let best=-1,bd=1e9;for(let c=0;c<NC;c++){const d=(x-seeds[c].x)**2+(y-seeds[c].y)**2;if(d<bd){bd=d;best=c;}}cmap[i]=best;}

  for(let c=0;c<NC;c++){
    let sx=0,sy=0,n=0;for(let i=0;i<MW*MH;i++)if(cmap[i]===c){sx+=i%MW;sy+=i/MW|0;n++;}
    if(!n){generate(seed+1);return;}
    let best=-1,bd=1e9;const cx=sx/n,cy=sy/n;
    for(let i=0;i<MW*MH;i++){if(cmap[i]!==c)continue;const d=(i%MW-cx)**2+(i/MW|0-cy)**2;if(d<bd){bd=d;best=i;}}
    countries[c].capital={x:best%MW,y:best/MW|0};
  }

  for(let c=0;c<NC;c++){
    const co=countries[c],cap=co.capital;if(!cap)continue;
    cities.push({id:nextId++,ownerId:c,x:cap.x,y:cap.y,pop:c===PLAYER?80:60+Math.floor(rand()*120),investBudget:0,investTicks:0,isCapital:true});
    const tl=tiles(c);let placed=0;
    for(let a=0;a<80&&placed<1+Math.floor(rand()*2);a++){
      const ti=tl[Math.floor(rand()*tl.length)],wx=ti%MW,wy=ti/MW|0;
      if(!cities.some(ci=>Math.hypot(ci.x-wx,ci.y-wy)<CITY_MIN_D)){
        cities.push({id:nextId++,ownerId:c,x:wx,y:wy,pop:30+Math.floor(rand()*80),investBudget:0,investTicks:0,isCapital:false});
        placed++;
      }
    }
  }

  // проверяет, что точка (wx,wy) находится глубоко внутри территории страны c — не у моря и не у границы с соседом
  const BORDER_MARGIN=9;
  function isInterior(wx,wy,c){
    if(wx<BORDER_MARGIN||wy<BORDER_MARGIN||wx>=MW-BORDER_MARGIN||wy>=MH-BORDER_MARGIN)return false;
    for(let dy=-BORDER_MARGIN;dy<=BORDER_MARGIN;dy+=3){
      for(let dx=-BORDER_MARGIN;dx<=BORDER_MARGIN;dx+=3){
        if(dx*dx+dy*dy>BORDER_MARGIN*BORDER_MARGIN)continue;
        if(cmap[(wy+dy)*MW+(wx+dx)]!==c)return false;
      }
    }
    return true;
  }

  // ── Фермы: размещаются в самых плодородных точках территории — чем земля лучше, тем больше ферм возможно ──
  for(let c=0;c<NC;c++){
    const tl=tiles(c);
    if(!tl.length)continue;
    const avgFert=tl.reduce((s,ti)=>s+fmap[ti],0)/tl.length;
    // потолок числа ферм растёт вместе с размером территории — иначе большая/растущая страна упрётся в фиксированный лимит еды
    const farmSlots=Math.max(6,Math.min(30,Math.round(tl.length/700+avgFert*8)));
    const ranked=tl.map(ti=>({ti,f:fmap[ti]})).sort((a,b)=>b.f-a.f);
    let placed=0;
    for(const{ti,f}of ranked){
      if(placed>=farmSlots)break;
      const wx=ti%MW,wy=ti/MW|0;
      if(!isInterior(wx,wy,c))continue;
      if(deposits.some(d=>Math.hypot(d.x-wx,d.y-wy)<DEPOSIT_MIN_D))continue;
      if(cities.some(ci=>Math.hypot(ci.x-wx,ci.y-wy)<14))continue;
      deposits.push({id:depNextId++,ownerId:c,x:wx,y:wy,res:'food',mined:false,quality:+(0.6+f*0.8).toFixed(2)});
      placed++;
    }
  }

  // ── Прочие месторождения ресурсов: разбросаны по территории каждой страны ──
  const ORE_RES=RES.filter(r=>r.id!=='food');
  for(let c=0;c<NC;c++){
    const tl=tiles(c);
    if(!tl.length)continue;
    const n=DEPOSITS_PER_COUNTRY_MIN+Math.floor(rand()*(DEPOSITS_PER_COUNTRY_MAX-DEPOSITS_PER_COUNTRY_MIN+1));
    let placed=0,tries2=0;
    while(placed<n&&tries2<300){
      tries2++;
      const ti=tl[Math.floor(rand()*tl.length)],wx=ti%MW,wy=ti/MW|0;
      if(!isInterior(wx,wy,c))continue;
      if(deposits.some(d=>Math.hypot(d.x-wx,d.y-wy)<DEPOSIT_MIN_D))continue;
      if(cities.some(ci=>Math.hypot(ci.x-wx,ci.y-wy)<14))continue;
      const res=ORE_RES[Math.floor(rand()*ORE_RES.length)].id;
      deposits.push({id:depNextId++,ownerId:c,x:wx,y:wy,res,mined:false});
      placed++;
    }
  }

  buildOffscreen();updateHUD();
}