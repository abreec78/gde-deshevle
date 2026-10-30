/* Shared catalogue logic. Live offers and illustrative demo data never mix. */
(function(root){
  'use strict';
  const categories=['Электроника','Компьютеры и комплектующие','Бытовая техника','Смартфоны и гаджеты','Телевизоры и видео','Аудио','Дом и сад','Инструменты','Автотовары','Спорт и отдых','Детские товары','Красота и здоровье'];
  // Original PR2 identifiers/prices are preserved, including saved favorites.
  const products=[
    {id:1,name:'SSD 1 ТБ',displayName:'Samsung 990 EVO 1 ТБ',category:categories[1],price:4590,shop:'Магазин А',image:'ssd',brand:'Samsung',interface:'NVMe',capacity:'1 ТБ',specs:['M.2','PCIe 4.0','5000/4200 МБ/с']},
    {id:2,name:'Беспроводные наушники',displayName:'Беспроводные наушники',category:categories[5],price:1990,shop:'Магазин Б',image:'headphones',specs:['Bluetooth','Полноразмерные']},
    {id:3,name:'Робот-пылесос',category:categories[2],price:12990,shop:'Магазин В',image:'robot',specs:['Уборка по расписанию','Wi-Fi']},
    {id:4,name:'Смартфон 128 ГБ',category:categories[3],price:14990,shop:'Магазин А',image:'phone',specs:['128 ГБ','6.1 дюйма']},
    {id:5,name:'Клавиатура',category:categories[1],price:1290,shop:'Магазин Б',image:'keyboard',specs:['Механическая','USB']},
    {id:6,name:'Электрочайник',category:categories[2],price:2490,shop:'Магазин В',image:'kettle',specs:['1.7 л','Автоотключение']},
    {id:7,name:'Kingston NV2 1 ТБ',category:categories[1],price:4290,shop:'Магазин Б',image:'kingston',brand:'Kingston',interface:'NVMe',capacity:'1 ТБ',specs:['M.2','PCIe 4.0','3500/2800 МБ/с']},
    {id:8,name:'Samsung 870 EVO 1 ТБ',category:categories[1],price:6490,shop:'Магазин А',image:'samsung-sata',brand:'Samsung',interface:'SATA',capacity:'1 ТБ',specs:['2.5 дюйма','SATA III','560/530 МБ/с']},
    {id:9,name:'WD Black SN770 1 ТБ',category:categories[1],price:5990,shop:'Магазин В',image:'wd',brand:'WD',interface:'NVMe',capacity:'1 ТБ',specs:['M.2','PCIe 4.0','5150/4900 МБ/с']},
    {id:10,name:'Телевизор 55 дюймов 4K',category:categories[4],price:42990,shop:'Магазин Б',image:'tv',specs:['55 дюймов','4K UHD']},
    {id:11,name:'Ноутбук 13 дюймов',category:categories[1],price:89990,shop:'Магазин В',image:'laptop',specs:['13 дюймов','256 ГБ']},
    {id:12,name:'Стиральная машина',category:categories[2],price:29990,shop:'Магазин А',image:'washer',specs:['8 кг','Инверторный мотор']}
  ];
  const demoProducts=products.map(p=>({...p}));
  let mode='demo',liveOffers=new Map(),sourceInfo=[];
  function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}}
  function fresh(o,now=Date.now()){const checked=Date.parse(o.checkedAt),until=Date.parse(o.validUntil);return Number.isFinite(checked)&&Number.isFinite(until)&&checked<=now+300000&&checked>=now-86400000&&until>now&&until<=checked+86400000&&o.available!==false;}
  function offersFor(id){if(mode==='live')return (liveOffers.get(id)||[]).filter(o=>fresh(o));const p=products.find(p=>p.id===id);return p?[{shop:p.shop,price:p.price,delivery:390},{shop:'Тестовый магазин Г',price:p.price+250,delivery:0},{shop:'Тестовый магазин Д',price:p.price+700,delivery:null}]:[];}
  function useDemo(){mode='demo';products.splice(0,products.length,...demoProducts);liveOffers=new Map();sourceInfo=[];}
  function useLive(snapshot){
    const accepted=[],offers=new Map();
    if(snapshot?.schemaVersion!==1||snapshot.mode!=='live'||!Array.isArray(snapshot.products)||!Array.isArray(snapshot.sources)||snapshot.products.length>5000)throw Error('Invalid catalogue');
    const sources=new Set(snapshot.sources.map(s=>s.id));
    const regions=new Set();
    for(const p of snapshot.products){
      if(!/^live:[a-f0-9]{24}$/.test(p.id)||accepted.some(x=>x.id===p.id)||typeof p.name!=='string'||!p.name||p.name.length>500||!categories.includes(p.category)||!safeUrl(p.imageUrl)||!Array.isArray(p.specs)||p.specs.some(x=>typeof x!=='string')||!Array.isArray(p.offers))throw Error('Invalid product');
      const valid=p.offers.filter(o=>sources.has(o.source)&&typeof o.shop==='string'&&o.shop&&o.currency==='RUB'&&Number.isFinite(o.price)&&o.price>=0&&(o.delivery===null||Number.isFinite(o.delivery)&&o.delivery>=0)&&safeUrl(o.url)&&fresh(o));
      if(!valid.length)continue;
      for(const o of valid){if(typeof o.region!=='string'||!o.region)throw Error('Missing region');regions.add(o.region);}
      if(regions.size>1)throw Error('Mixed regions');
      accepted.push({...p});offers.set(p.id,valid.map(o=>({...o})));
    }
    mode='live';products.splice(0,products.length,...accepted);liveOffers=offers;sourceInfo=snapshot.sources.map(s=>({...s}));
  }
  function total(o){return o.delivery===null||!Number.isFinite(o.delivery)||!Number.isFinite(o.price)?null:o.price+o.delivery;}
  function sortedOffers(id){return offersFor(id).slice().sort((a,b)=>(total(a)??Infinity)-(total(b)??Infinity));}
  function bestPrice(p){const totals=offersFor(p.id).map(total).filter(v=>v!==null);return totals.length?Math.min(...totals):null;}
  function isSSD(p){return p.category===categories[1]&&/ssd|nvme|sata|накопител/i.test([p.name,p.displayName,p.interface,...(p.specs||[])].join(' '));}
  const aliases={'Компьютеры':categories[1],'Для дома':categories[6]};
  function filterProducts(state={}){
    const q=(state.query||'').trim().toLocaleLowerCase('ru-RU');
    let list=products.filter(p=>{
      const searchable=[p.name,p.displayName,p.brand,p.capacity,p.interface,isSSD(p)?'SSD накопители накопитель':'',...(p.specs||[])].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
      const category=aliases[state.category]||state.category;
      return (mode!=='live'||offersFor(p.id).length>0)&&(!q||q.split(/\s+/).every(term=>searchable.includes(term)))&&(!category||p.category===category)&&(!state.onlyFav||state.favorites?.has(p.id))&&(!state.ssdOnly||isSSD(p))&&(!state.capacity||p.capacity===state.capacity)&&(!state.brands?.length||state.brands.includes(p.brand))&&(!state.interfaces?.length||state.interfaces.includes(p.interface))&&(state.minPrice==null||bestPrice(p)!==null&&bestPrice(p)>=state.minPrice)&&(state.maxPrice==null||bestPrice(p)!==null&&bestPrice(p)<=state.maxPrice);
    });
    if(state.sort==='asc'||state.sort==='desc')list.sort((a,b)=>{const pa=bestPrice(a),pb=bestPrice(b);return pa===null?(pb===null?0:1):pb===null?-1:state.sort==='asc'?pa-pb:pb-pa;});
    return list;
  }
  function readFavorites(storage){try{const value=JSON.parse(storage.getItem('favorites')||'[]');return new Set(Array.isArray(value)?value.filter(v=>Number.isInteger(v)||typeof v==='string'&&/^live:[a-f0-9]{24}$/.test(v)):[]);}catch{return new Set();}}
  function saveFavorites(storage,favorites){try{storage.setItem('favorites',JSON.stringify([...favorites]));return true;}catch{return false;}}
  function toggleFavorite(favorites,id){if(!products.some(p=>p.id===id))return;favorites.has(id)?favorites.delete(id):favorites.add(id);}
  function countLabel(n){const r=n%100,last=n%10;return n+' '+(r>=11&&r<=14?'товаров':last===1?'товар':last>=2&&last<=4?'товара':'товаров');}
  // Select a changing, stable-per-page-load home assortment; never alter real offers or prices.
  function pickFeaturedProducts(ids,count=6,random=Math.random,previous=[]){
    const ordered=[...ids];
    for(let i=ordered.length-1;i>0;i--){
      const sample=Number(random());
      const j=Number.isFinite(sample)?Math.min(i,Math.max(0,Math.floor(sample*(i+1)))):0;
      [ordered[i],ordered[j]]=[ordered[j],ordered[i]];
    }
    const selected=ordered.slice(0,Math.max(0,Math.min(ordered.length,count)));
    if(selected.length>1&&Array.isArray(previous)&&selected.join(',')===previous.join(',')){
      [selected[0],selected[1]]=[selected[1],selected[0]];
    }
    return selected;
  }
  function validatePriceRange(min,max){return (min==null||Number.isFinite(min)&&min>=0)&&(max==null||Number.isFinite(max)&&max>=0)&&(min==null||max==null||min<=max);}
  const api={categories,products,offersFor,total,sortedOffers,bestPrice,isSSD,filterProducts,readFavorites,saveFavorites,toggleFavorite,countLabel,pickFeaturedProducts,validatePriceRange,safeUrl,fresh,useLive,useDemo,get mode(){return mode;},get sources(){return sourceInfo;}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Catalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
