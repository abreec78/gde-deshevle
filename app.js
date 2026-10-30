'use strict';
const C=window.Catalog,$=id=>document.getElementById(id);
const icon=name=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const money=n=>n===null?'Неизвестно':n.toLocaleString('ru-RU')+' ₽';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=p=>p.displayName||p.name;
const parseId=value=>String(value).startsWith('live:')?value:Number(value);
const imagePath=p=>C.mode==='live'?p.imageUrl:'assets/'+p.image+'.webp';
const emptyLive={schemaVersion:1,mode:'live',sources:[],products:[]};
let catalogueError='';
C.useDemo();
let storage;try{storage=window.localStorage;}catch{storage=null;}
const state={query:'',category:'',sort:'default',onlyFav:false,favorites:C.readFavorites(storage),ssdOnly:false,capacity:null,brands:[],interfaces:[],minPrice:null,maxPrice:null,selectedId:1,detailOpen:false};
let storageTimer,installPrompt=null;
let automaticDemo=false;
function newHomeOrder(previous=[]){
  const selected=C.pickFeaturedProducts([1,2,3,4,5,6,7,8,9,10,11,12],6,Math.random,previous);
  try{storage?.setItem('kupiora:home-last',JSON.stringify(selected));}catch{}
  return selected;
}
let demoHomeOrder=(()=>{
  let previous=[];
  try{const saved=JSON.parse(storage?.getItem('kupiora:home-last')||'[]');if(Array.isArray(saved))previous=saved;}catch{}
  return newHomeOrder(previous);
})();
function favoriteButton(p){return '<button class="favorite-toggle" data-favorite="'+p.id+'" aria-label="Избранное: '+escape(name(p))+'" aria-pressed="'+state.favorites.has(p.id)+'">'+icon('heart')+'</button>';}
function shopMark(o,i){
  if(!o)return '<span class="shop-unknown">Магазин не указан</span>';
  const isLive=C.mode==='live',seller=typeof o.sellerName==='string'?o.sellerName.trim():'';
  const shown=seller||o.shop;
  const mark='<span class="shop-mark s'+(i%3+1)+'" aria-hidden="true">'+escape(String(shown).slice(0,1).toUpperCase())+'</span>';
  const text='<span class="shop-label">'+escape(shown)+(seller&&seller!==o.shop?'<small> · '+escape(o.shop)+'</small>':'')+'</span>';
  const inner=mark+text;
  // Prefer an actual seller profile only when the feed contains one; otherwise open this product offer.
  const hasSellerUrl=isLive&&C.safeUrl(o.sellerUrl);
  const target=hasSellerUrl?o.sellerUrl:o.url;
  if(isLive&&C.safeUrl(target))
    return '<a class="shop shop-link" href="'+escape(target)+'" target="_blank" rel="noopener noreferrer nofollow sponsored" title="'+(hasSellerUrl?'Открыть страницу продавца: ':'Открыть товар в магазине: ')+escape(shown)+'">'+inner+' <span class="shop-arrow" aria-hidden="true">↗</span></a>';
  return '<span class="shop shop-unlinked" title="'+(isLive?'Нет ссылки на предложение':'Демонстрационный магазин без реальной ссылки')+'">'+inner+(isLive?'':' <small class="shop-demo-note">демо</small>')+'</span>';
}
function merchantSummary(o,i){
  if(!o)return '<span class="seller-status">Магазин не указан</span>';
  const label=C.mode==='demo'?'Демо-магазин':typeof o.sellerName==='string'&&o.sellerName.trim()?'Продавец':'Магазин';
  return '<div class="seller-inline"><span class="seller-caption">'+label+':</span>'+shopMark(o,i)+'</div>';
}
function specs(p){return '<div class="specs">'+p.specs.map(s=>'<span>'+escape(s)+'</span>').join('')+'</div>';}
function renderCategories(){
  $('categories').innerHTML=C.categories.map((category,i)=>'<button class="category-card '+(state.category===category?'active':'')+'" data-category="'+escape(category)+'" aria-pressed="'+(state.category===category)+'"><img src="assets/category-'+i+'.webp" width="233" height="150" alt="" decoding="async" '+(i>5?'loading="lazy"':'')+'><span class="category-copy"><strong>'+category+'</strong><small>'+C.countLabel(C.filterProducts({category}).length)+(C.mode==='demo'?' в демокаталоге':' в каталоге')+'</small>'+icon('arrow')+'</span></button>').join('');
}
function renderCard(p,detailMode){
  const offers=C.sortedOffers(p.id),image='<img class="product-image" src="'+escape(imagePath(p))+'" width="300" height="180" alt="'+escape(name(p))+(C.mode==='demo'?' — иллюстрация':'')+'" loading="lazy" decoding="async">';
  const demoSearch=C.mode==='demo'?'<a class="demo-find-link" href="compare-any.html?q='+encodeURIComponent(name(p))+'">Найти реальные предложения ↗</a>':'';
  const info='<div class="card-info"><h3><button data-open="'+p.id+'">'+escape(name(p))+'</button></h3>'+(detailMode?'<p class="card-subtitle">'+escape(p.specs.join(', '))+'</p>'+specs(p)+merchantSummary(offers[0],0):'<div class="price">'+money(C.bestPrice(p))+'</div><p class="card-note">с известной доставкой'+(C.mode==='demo'?' · демо':' · '+escape(offers[0]?.region||''))+'</p>'+merchantSummary(offers[0],0))+demoSearch+'</div>';
  const open=C.mode==='demo'?'<a class="compare-link demo-compare-live" href="compare-any.html?q='+encodeURIComponent(name(p))+'">Искать настоящие цены ↗</a>':'<button class="compare-link" data-open="'+p.id+'">Сравнить цены ('+offers.length+') '+icon('arrow')+'</button>';
  return '<article class="product-card" data-product="'+p.id+'">'+favoriteButton(p)+'<button class="product-image-button" data-open="'+p.id+'" aria-label="Сравнить '+escape(name(p))+'">'+image+'</button>'+info+(detailMode?'<div class="card-offers"><div class="price">'+money(C.bestPrice(p))+'</div><p class="card-note">итого с доставкой'+(C.mode==='demo'?' · демо':' · '+escape(offers[0]?.region||''))+'</p>'+offers.map((o,i)=>'<div class="mini-offer">'+shopMark(o,i)+'<b>'+money(C.total(o))+'</b></div>').join('')+open+'</div>':open)+'</article>';
}
function chart(p){
  if(C.mode==='live'){
    const offer=C.sortedOffers(p.id)[0];
    const historyPoints=p.history?.[offer?.id];const points=(Array.isArray(historyPoints)?historyPoints:[]).filter(v=>Number.isFinite(v.price)&&v.price>=0&&Number.isFinite(Date.parse(v.at))&&Date.parse(v.at)<=Date.now()+300000).slice(-365).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    if(points.length<2)return '<p class="filter-note">История начнётся с реальных наблюдений. Пока недостаточно данных для графика.</p>';
    const min=Math.min(...points.map(v=>v.price)),max=Math.max(...points.map(v=>v.price)),range=max-min||1;
    const path=points.map((v,i)=>(i?'L':'M')+(35+i*265/(points.length-1)).toFixed(2)+' '+(92-(v.price-min)*70/range).toFixed(2)).join(' ');
    return '<p class="filter-note">'+escape(offer.shop)+' · цена товара без доставки · '+points.length+' наблюдений</p><svg class="chart" viewBox="0 0 310 125" role="img" aria-label="История наблюдений цены товара без доставки"><path class="chart-grid" d="M35 20H300M35 55H300M35 92H300"/><path class="chart-line" d="'+path+'"/><text x="0" y="18">'+max.toLocaleString('ru-RU')+'</text><text x="0" y="105">'+min.toLocaleString('ru-RU')+'</text></svg>';
  }
  return '<span class="history-label">Вымышленная история · не рыночные данные</span><svg class="chart" viewBox="0 0 310 130" role="img" aria-label="Пример графика: вымышленная цена снижалась в течение месяца"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0875ff" stop-opacity=".2"/><stop offset="1" stop-color="#0875ff" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M35 15H300M35 53H300M35 91H300M35 15V104M100 15V104M165 15V104M230 15V104M300 15V104"/><path d="M35 20 47 30 64 30 73 35 91 34 101 42 123 47 138 47 149 52 164 50 178 57 198 58 212 68 231 65 251 74 271 76 300 80V104H35Z" fill="url(#chart-fill)" stroke="none"/><path class="chart-line" d="M35 20 47 30 64 30 73 35 91 34 101 42 123 47 138 47 149 52 164 50 178 57 198 58 212 68 231 65 251 74 271 76 300 80"/><circle cx="300" cy="80" r="4" fill="#0875ff" stroke="white"/><text x="0" y="18">'+Math.round(C.bestPrice(p)*1.5).toLocaleString('ru-RU')+'</text><text x="0" y="95">'+C.bestPrice(p).toLocaleString('ru-RU')+'</text><text x="35" y="123">27.09</text><text x="110" y="123">07.10</text><text x="195" y="123">17.10</text><text x="272" y="123">27.10</text></svg><div class="history-caption"><span>Пример за месяц</span><span>'+money(C.bestPrice(p))+' · демо</span></div>';
}
function renderDetail(p){
  const offers=C.sortedOffers(p.id);
  $('detail').innerHTML='<button class="back-results" id="back-results">‹ К списку товаров</button><div class="detail-image"><img src="'+escape(imagePath(p))+'" alt="'+escape(name(p))+(C.mode==='demo'?' — иллюстрация':'')+'" width="320" height="180">'+favoriteButton(p)+'</div><h2>'+escape(name(p))+'</h2><p class="detail-subtitle">'+escape(p.specs.join(', '))+'</p>'+specs(p)+'<section class="detail-section"><h3>Сравнение цен в магазинах</h3><div class="offer-head"><span>'+(C.mode==='demo'?'Демонстрационные предложения':'Данные подключённых фидов')+'</span><span>Итого</span></div>'+offers.map((o,i)=>'<div class="offer-row '+(!i?'best':'')+'">'+shopMark(o,i)+'<b>'+money(C.total(o))+'</b><small>'+(C.mode==='demo'?'демо':'наблюдение')+'</small></div><div class="offer-detail">Товар: '+money(o.price)+' · Доставка: '+(o.delivery===null?'уточняется':money(o.delivery))+'</div>').join('')+(C.mode==='demo'?'<p class="shop-link-note">Это демонстрация: настоящих ссылок на тестовых продавцов нет.</p>':'<p class="shop-link-note">Нажмите на магазин или продавца, чтобы открыть предложение ↗</p>')+'</section><section class="detail-section"><h3>История цены</h3>'+chart(p)+'</section><p class="filter-note">Изображение иллюстративное. Реальные цены, наличие и характеристики требуют проверки источника.</p>';
}
function realOfferLinks(offers){return offers.map(o=>'<p class="source-stamp">'+escape(o.shop)+' · '+escape(o.region)+' · проверено '+new Date(o.checkedAt).toLocaleString('ru-RU')+'</p>').join('');}
function renderDataStatus(){
  const demo=C.mode==='demo',notice=$('data-notice');
  $('real-mode').setAttribute('aria-pressed',String(!demo));$('demo-mode').setAttribute('aria-pressed',String(demo));
  notice.classList.toggle('real-status',!demo);const regions=[...new Set(C.products.flatMap(p=>C.offersFor(p.id).map(o=>o.region)))];document.querySelector('.city').textContent=demo?'Москва · демо':regions.length===1?regions[0]:'Регион: из фида';
  notice.querySelector('strong').textContent=demo?'Демонстрационная версия.':'Данные магазинов.';
  notice.querySelector('span:not(.demo-dot)').textContent=demo?'Цены ниже вымышленные. Предложения и история цен — для примера.':'Доставка и цены зависят от региона и условий магазина. Неизвестная доставка не считается бесплатной.';
  $('source-status').textContent=demo?(catalogueError||'Вымышленные данные'):catalogueError||(!C.sources.length?'Источник пока не подключён':C.sources.filter(s=>s.status==='ok').length+' источников обновлено · '+C.countLabel(C.filterProducts().length));
  document.querySelector('.results-meta span:last-child').textContent=demo?'Иллюстративные цены · ₽':'Рубли · актуальность до 24 часов';
  document.querySelector('footer small').textContent=demo?'Демонстрация · Цены и история вымышлены · Покупка недоступна':'Цены из разрешённых фидов · Окончательные условия уточняйте в магазине';
}
let modeRequest=0;
async function loadMode(mode){
  const request=++modeRequest;catalogueError='';
  automaticDemo=mode==='auto';
  if(mode==='demo'){C.useDemo();render();syncRoute();return;}
  if(mode==='auto')C.useDemo();else C.useLive(emptyLive);
  render();
  try{
    const snapshot=await window.loadPublicCatalog();
    if(request!==modeRequest)return;
    C.useLive(snapshot);
    if(mode==='auto'&&!C.products.length){
      C.useDemo();
      catalogueError='Свежих цен нет. Показаны демонстрационные товары.';
    }else if(C.products.length)automaticDemo=false;
  }catch{
    if(request!==modeRequest)return;
    if(mode==='auto'){
      C.useDemo();
      catalogueError='Источник цен недоступен. Показаны демонстрационные товары.';
    }else catalogueError='Источник цен недоступен. Демоданные не подставлены.';
  }
  render();syncRoute();
}
function render(){
  renderDataStatus();
  const active=!!(state.query.trim()||state.category||state.onlyFav||state.ssdOnly||state.brands.length||state.interfaces.length||state.minPrice!==null||state.maxPrice!==null);
  const ssdMode=state.ssdOnly||(/ssd/i.test(state.query));
  const computerMode=ssdMode||state.category===C.categories[1];
  const detailMode=computerMode||state.detailOpen;
  document.body.classList.toggle('compact',active);document.body.classList.toggle('detail-mode',detailMode);
  if(!detailMode)document.body.classList.remove('show-detail','filters-open');
  document.body.classList.toggle('generic-detail',detailMode&&!computerMode);
  $('filters').hidden=!computerMode;$('mobile-filters').hidden=!computerMode;$('benefits').hidden=active;$('breadcrumbs').hidden=!active;
  $('breadcrumbs').innerHTML='<a href="#">Главная</a><span>›</span><button class="text-button" data-category="'+escape(state.category||C.categories[1])+'">'+escape(state.category|| (detailMode?C.categories[1]:'Каталог'))+'</button>'+(detailMode?'<span>›</span><button class="text-button" id="breadcrumb-ssd">Накопители → SSD</button><span>›</span><span>'+escape(state.capacity||'Все объёмы')+'</span>':'');
  let results=C.filterProducts(state);
  // Stable for this page load; changes on a fresh opening, not during every render.
  if(C.mode==='demo'&&!active&&state.sort==='default')
    results=demoHomeOrder.map(id=>C.products.find(p=>p.id===id)).filter(Boolean);
  $('results-heading').textContent=state.onlyFav?'Избранное':ssdMode?'SSD '+(state.capacity||'накопители'):state.category|| (state.query?'Результаты поиска':(C.mode==='demo'?'Случайные товары · демо':'Товары магазинов'));
  $('catalog-subtitle').textContent=C.mode==='live'?'Данные фидов · итог только с известной доставкой':active?'Иллюстративный каталог · сравнение с доставкой':'Сравнивайте итоговую стоимость, а не только ценник';
  $('count').textContent=C.countLabel(results.length);
  $('reshuffle-home').hidden=C.mode!=='demo'||active;
  $('grid').innerHTML=results.length?results.map(p=>renderCard(p,detailMode)).join(''):'<div class="empty-state"><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button class="primary" id="empty-reset">Показать все товары</button></div>';
  const selected=results.find(p=>p.id===state.selectedId)||results[0];
  $('detail').hidden=!detailMode||!selected;
  if(!results.length&&C.mode==='live'&&!C.sources.length)$('grid').innerHTML='<div class="empty-state"><h3>Реальный источник пока не подключён</h3><p>Подтверждённых цен нет. Демоверсию можно открыть отдельной кнопкой выше.</p></div>';
  if(detailMode&&selected){state.selectedId=selected.id;renderDetail(selected);if(C.mode==='live'){const sections=$('detail').querySelectorAll('.detail-section');sections[0].querySelector('.disabled-shop')?.remove();sections[0].insertAdjacentHTML('beforeend',realOfferLinks(C.sortedOffers(selected.id)));$('detail').querySelector('.filter-note:last-child').textContent='Товарные данные и фото предоставлены источником. Наличие и итоговые условия проверяйте в магазине.';}}else document.body.classList.remove('show-detail');
  $('favorites').setAttribute('aria-pressed',String(state.onlyFav));
  $('fav-count').textContent=[...state.favorites].filter(id=>C.products.some(p=>p.id===id)).length;$('fav-count').hidden=$('fav-count').textContent==='0';
  const chips=detailMode?[['Все',''],['SATA','SATA'],['NVMe (M.2)','NVMe']]:[['Все',''],['Электроника',C.categories[0]],['Компьютеры',C.categories[1]],['Бытовая техника',C.categories[2]],['Дом и сад',C.categories[6]],['Спорт',C.categories[9]]];
  $('chips').innerHTML=chips.map(([title,value])=>'<button class="chip '+((detailMode?state.interfaces.join(''):state.category)===value?'active':'')+'" '+(detailMode?'data-interface':'data-category')+'="'+escape(value)+'">'+title+'</button>').join('');
  $('category').value=state.category;$('sort').value=state.sort;
  document.querySelectorAll('#capacities button').forEach(b=>b.classList.toggle('active',b.dataset.capacity===state.capacity));
  document.querySelectorAll('input[name=interface]').forEach(el=>el.checked=state.interfaces.includes(el.value));
  renderCategories();
}
function selectCategory(category){state.category=category;state.ssdOnly=false;state.capacity=null;state.detailOpen=false;state.query='';$('q').value='';state.brands=[];state.interfaces=[];state.minPrice=null;state.maxPrice=null;clearFilterInputs();document.body.classList.remove('show-detail');render();syncRoute();}
function clearFilterInputs(){document.querySelectorAll('#filters input[type=checkbox]').forEach(el=>el.checked=false);$('min-price').value='';$('max-price').value='';$('filter-error').hidden=true;}
function reset(){Object.assign(state,{query:'',category:'',sort:'default',onlyFav:false,ssdOnly:false,capacity:null,brands:[],interfaces:[],minPrice:null,maxPrice:null,selectedId:1,detailOpen:false});$('q').value='';clearFilterInputs();render();syncRoute();}
function syncRoute(){const p=new URLSearchParams();if(state.query)p.set('q',state.query);if(state.category)p.set('category',state.category);if(state.ssdOnly)p.set('ssd','1');if(state.capacity)p.set('capacity',state.capacity);if(state.onlyFav)p.set('favorites','1');if(state.sort!=='default')p.set('sort',state.sort);if(state.selectedId!==1)p.set('product',state.selectedId);if(state.detailOpen)p.set('view','product');if(state.brands.length)p.set('brands',state.brands.join(','));if(state.interfaces.length)p.set('interfaces',state.interfaces.join(','));if(state.minPrice!==null)p.set('min',state.minPrice);if(state.maxPrice!==null)p.set('max',state.maxPrice);if(C.mode==='demo'&&!automaticDemo)p.set('data','demo');const hash=p.toString();history.replaceState(null,'',location.pathname+location.search+(hash?'#'+hash:''));}
function readRoute(){const p=new URLSearchParams(location.hash.slice(1));state.detailOpen=p.get('view')==='product';state.query=p.get('q')||'';state.category=C.categories.includes(p.get('category'))?p.get('category'):'';state.ssdOnly=p.get('ssd')==='1';state.capacity=['1 ТБ','500 ГБ','2 ТБ','4 ТБ'].includes(p.get('capacity'))?p.get('capacity'):null;state.onlyFav=p.get('favorites')==='1';state.sort=['asc','desc'].includes(p.get('sort'))?p.get('sort'):'default';state.selectedId=parseId(p.get('product'))||1;state.brands=(p.get('brands')||'').split(',').filter(v=>['Samsung','Kingston','WD'].includes(v));state.interfaces=(p.get('interfaces')||'').split(',').filter(v=>['SATA','NVMe'].includes(v));const min=p.has('min')?Number(p.get('min')):null,max=p.has('max')?Number(p.get('max')):null;state.minPrice=C.validatePriceRange(min,max)?min:null;state.maxPrice=C.validatePriceRange(min,max)?max:null;$('q').value=state.query;$('min-price').value=state.minPrice??'';$('max-price').value=state.maxPrice??'';document.querySelectorAll('input[name=brand]').forEach(el=>el.checked=state.brands.includes(el.value));render();if(state.detailOpen)document.body.classList.add('show-detail');}
document.addEventListener('click',event=>{
  if(event.target.closest('a[href="#"]')){event.preventDefault();reset();return;}
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.category!==undefined){selectCategory(button.dataset.category);return;}
  if(button.dataset.favorite){const id=parseId(button.dataset.favorite);C.toggleFavorite(state.favorites,id);if(!C.saveFavorites(storage,state.favorites)){$('storage-status').textContent='Хранилище недоступно. Избранное сохранено только до закрытия страницы.';$('storage-status').hidden=false;clearTimeout(storageTimer);storageTimer=setTimeout(()=>$('storage-status').hidden=true,6500);}render();return;}
  if(button.dataset.open){state.selectedId=parseId(button.dataset.open);const p=C.products.find(p=>p.id===state.selectedId);if(!p)return;if(!document.body.classList.contains('detail-mode')){state.query=C.isSSD(p)?'SSD 1 ТБ':p.name;state.category='';state.ssdOnly=C.isSSD(p);state.capacity=p.capacity||null;$('q').value=state.query;}state.detailOpen=true;render();document.body.classList.add('show-detail');syncRoute();if(matchMedia('(max-width:980px)').matches)$('catalog').scrollIntoView({block:'start'});return;}
  if(button.dataset.interface!==undefined){state.interfaces=button.dataset.interface?[button.dataset.interface]:[];render();syncRoute();return;}
  if(button.dataset.capacity){state.capacity=button.dataset.capacity;state.ssdOnly=true;render();syncRoute();return;}
  if(button.id==='back-results'){document.body.classList.remove('show-detail');state.detailOpen=false;if(!state.ssdOnly&&!/ssd/i.test(state.query)){reset();}else render();return;}
  if(button.id==='empty-reset')reset();
});
$('q').addEventListener('input',()=>{state.query=$('q').value;state.ssdOnly=false;state.capacity=null;state.detailOpen=false;document.body.classList.remove('show-detail');render();syncRoute();});
$('search-form').addEventListener('submit',e=>{e.preventDefault();const q=$('q').value.trim();const url=new URL('./compare-any.html',location.href);if(q)url.searchParams.set('q',q);location.assign(url.href);});
$('category').addEventListener('change',()=>selectCategory($('category').value));
$('sort').addEventListener('change',()=>{state.sort=$('sort').value;render();syncRoute();});
function toggleFavorites(){state.onlyFav=!state.onlyFav;state.detailOpen=false;document.body.classList.remove('show-detail');render();syncRoute();}
$('favorites').onclick=toggleFavorites;$('mobile-favorites').onclick=toggleFavorites;
$('mobile-search').onclick=()=>{$('q').focus();window.scrollTo({top:0,behavior:'smooth'});};
$('all-categories').onclick=reset;
$('reshuffle-home').onclick=()=>{demoHomeOrder=newHomeOrder(demoHomeOrder);if(C.mode!=='demo')loadMode('demo');else render();};
$('real-mode').onclick=()=>loadMode('live');$('demo-mode').onclick=()=>loadMode('demo');
$('mobile-filters').onclick=()=>document.body.classList.add('filters-open');$('close-filters').onclick=()=>document.body.classList.remove('filters-open');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('filters-open');$('mobile-filters').focus();}});
$('apply-filters').onclick=()=>{const min=$('min-price').value===''?null:Number($('min-price').value),max=$('max-price').value===''?null:Number($('max-price').value);if(!C.validatePriceRange(min,max)){$('filter-error').textContent='Укажите корректный диапазон: цена «от» не больше цены «до».';$('filter-error').hidden=false;return;}state.minPrice=min;state.maxPrice=max;state.brands=[...document.querySelectorAll('input[name=brand]:checked')].map(e=>e.value);state.interfaces=[...document.querySelectorAll('input[name=interface]:checked')].map(e=>e.value);$('filter-error').hidden=true;document.body.classList.remove('filters-open');render();syncRoute();};
$('reset-filters').onclick=()=>{state.minPrice=null;state.maxPrice=null;state.brands=[];state.interfaces=[];state.capacity=null;clearFilterInputs();render();syncRoute();};
function openSSD(){state.ssdOnly=true;state.category=C.categories[1];state.capacity='1 ТБ';state.detailOpen=false;state.query='';$('q').value='';render();syncRoute();}
$('ssd-filter').onclick=openSSD;
document.addEventListener('click',e=>{if(e.target.closest('#breadcrumb-ssd'))openSSD();});
document.querySelector('[data-filter-category]').onclick=()=>selectCategory(C.categories[1]);
window.addEventListener('hashchange',readRoute);
window.addEventListener('storage',e=>{if(e.key==='favorites'||e.key===null){state.favorites=C.readFavorites(storage);render();}});
function networkStatus(){$('offline-status').hidden=navigator.onLine;}
window.addEventListener('online',networkStatus);window.addEventListener('offline',networkStatus);
function showHelp(visible){$('install-help').hidden=!visible;$('pwa-help').setAttribute('aria-expanded',String(visible));}
$('pwa-help').onclick=()=>showHelp($('install-help').hidden);$('close-help').onclick=()=>showHelp(false);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-button').hidden=false;});
$('install-button').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-button').hidden=true;};
window.addEventListener('appinstalled',()=>{$('install-button').hidden=true;installPrompt=null;});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{showHelp(true);$('install-help').prepend('Офлайн-кеш сейчас недоступен. ');});
readRoute();networkStatus();loadMode(new URLSearchParams(location.hash.slice(1)).get('data')==='demo'?'demo':new URLSearchParams(location.hash.slice(1)).get('data')==='live'?'live':'auto');
setInterval(()=>{if(C.mode==='live')render();},60000);
