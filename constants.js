'use strict';

// ── Страны ────────────────────────────────────────────────
const DEFS=[
  {id:0,name:'Solaria', rgb:[255,200,50],  hex:'#ffc832'},
  {id:1,name:'Nordvik', rgb:[50,160,255],  hex:'#32a0ff'},
  {id:2,name:'Verdania',rgb:[60,220,90],   hex:'#3cdc5a'},
  {id:3,name:'Crimoria',rgb:[255,60,80],   hex:'#ff3c50'},
  {id:4,name:'Aurentum',rgb:[255,160,20],  hex:'#ffa014'},
  {id:5,name:'Umbrath', rgb:[180,80,255],  hex:'#b450ff'},
  {id:6,name:'Frosthal',rgb:[60,230,230],  hex:'#3ce6e6'},
  {id:7,name:'Velmoria',rgb:[255,110,60],  hex:'#ff6e3c'},
];
const NC=DEFS.length,PLAYER=0;

// ── Города ────────────────────────────────────────────────
const CITY_GOLD=100,CITY_WOOD=30,CITY_STONE=20,CITY_MIN_D=30;
const POP_PASSIVE=0.4,POP_INVEST_RATE=0.8,POP_INVEST_TICKS=20,POP_MAX=2000;
const GEAR_MIN_R=3,GEAR_MAX_R=10;

// ── ИИ ─────────────────────────────────────────────────────
const AI_BUILD_INT=12,AI_INVEST_INT=6,AI_INVEST_AMT=40;

// ── Кризис / выкуп городов ───────────────────────────────────
const WEAK_GOLD=25,WEAK_TICKS_NEEDED=24; // страна в кризисе если золото ниже порога ~12 секунд подряд

// ── Кредиты (долговая зависимость) ────────────────────────────
const LOAN_RATE=0.3;              // доля добычи ресурсов и дохода, уходящая кредитору каждый тик, пока долг не погашен
const LOAN_DURATION=50;           // срок кредита в тиках (при тике 500мс ≈ 25 секунд)
const LOAN_MIN_AMOUNT=60,LOAN_MAX_AMOUNT=280; // диапазон суммы, которую страна просит в кредит

// ── Налоги ─────────────────────────────────────────────────
const TAX_PER_POP=0.03;            // золота с одного жителя за тик при ставке налога 100%
const TAX_DEFAULT=0.2;             // стартовая ставка налога у игрока (20%)
const TAX_GROWTH_PENALTY=0.75;     // насколько сильно налог тормозит прирост населения (при 100% рост падает на 75%)
const TAX_UNREST_THRESHOLD=0.65;   // ставка, выше которой население начинает роптать и убывать
const TAX_UNREST_RATE=0.012;       // базовый % населения, теряемый за тик при недовольстве (растёт с превышением порога)
const AI_TAX_MIN=0.1,AI_TAX_MAX=0.35,AI_TAX_INT=16; // диапазон стартовой ставки ИИ + как часто ИИ пересматривает её

// ── Генерация карты ──────────────────────────────────────────
const WATER_COLOR=[8,20,60],SHORE_COLOR=[30,50,100];
const PRESETS=[{mw:900,mh:600,rx:.38,ry:.32},{mw:1100,mh:700,rx:.40,ry:.34},{mw:1300,mh:820,rx:.41,ry:.35}];

// ── Ресурсы ───────────────────────────────────────────────
const RES=[
  {id:'food', name:'Еда',    icon:'🌾', color:'#e0c050', base:5},
  {id:'wood', name:'Дерево', icon:'🌲', color:'#66bb55', base:6},
  {id:'stone',name:'Камень', icon:'🪨', color:'#9aa3ad', base:9},
  {id:'iron', name:'Железо', icon:'⚙️',  color:'#88aacc', base:12},
  {id:'gold', name:'Золото', icon:'✨', color:'#ffd250', base:20},
];
function resById(id){return RES.find(r=>r.id===id);}

// сколько единиц ресурса даёт ОДНА построенная шахта/ферма за тик (для еды дополнительно умножается на качество почвы d.quality)
const DEPOSIT_RATE={food:0.55, wood:0.6, stone:0.5, iron:0.35, gold:0.18};
// стоимость постройки: дерево + камень (ресурсы) + деньги (🪙) + рабочие руки (свободное население страны)
const MINE_COST={
  food: {wood:10, stone:0,  money:35,  workers:7},   // ферма
  wood: {wood:0,  stone:0,  money:50,  workers:6},   // дом дровосеков
  stone:{wood:15, stone:0,  money:45,  workers:8},
  iron: {wood:30, stone:15, money:75,  workers:12},
  gold: {wood:25, stone:35, money:140, workers:18},  // золотая шахта — самая дорогая и трудоёмкая
};
const DEPOSITS_PER_COUNTRY_MIN=4,DEPOSITS_PER_COUNTRY_MAX=6,DEPOSIT_MIN_D=18;
const FOOD_PER_POP=0.008,STARVE_RATE=0.015; // расход еды на 1 жителя за тик; % населения, теряемый при голоде