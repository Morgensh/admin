'use strict';

// рыночные цены (колеблются)
let marketPrice={food:7,wood:6,stone:9,iron:12,gold:20};
// лоты на рынке: {id, sellerId, res, qty, price}
let marketOrders=[];
let orderNextId=1;
// месторождения: {id, ownerId, res, x, y, mined, quality?, controlledBy}
// controlledBy — если задан (id страны), добыча с этого месторождения идёт ей, а не ownerId (зона влияния)
let deposits=[],depNextId=1;
let fmap=null; // карта плодородия почвы

// зона влияния игрока (выкупленные города дают контроль над ресурсами вокруг, без захвата самой земли)
let infMap=null; // Uint8Array по тайлам: 1 — под влиянием игрока
let infC=null;   // полупрозрачный офскрин-канвас с отрисованной зоной влияния

// карта
let MW,MH,P,hmap,cmap;

// страны и города
let countries=[],cities=[];
let nextId=1,tcache={},aiTickN=0;
let offC; // офскрин-канвас с готовым изображением карты

// камера
let vx=0,vy=0,vs=1;
let dpr=1; // devicePixelRatio — чтобы canvas рендерился в реальном разрешении экрана, а не размыто
let pinch={on:false,d0:1,vs0:1,vx0:0,vy0:0,mx0:0,my0:0}; // состояние pinch-zoom двумя пальцами

// ввод
let drag={on:false,sx:0,sy:0,vx0:0,vy0:0,moved:0,lx:0,ly:0};
let touches={},buildMode=false,selectedCity=null,ecoTimer=null,showRes=false;

// UI
let marketTab='buy';

const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
