'use strict';
const C=window.Catalog,$=id=>document.getElementById(id);
const icon=name=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const money=n=>n===null?'Неизвестно':n.toLocaleString('ru-RU')+' ₽';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=p=>p.displayName||p.name;
let storage;try{storage=window.localStorage;}catch{storage=null;}
const state={query:'',category:'',sort:'default',onlyFav:false,favorites:C.readFavorites(storage),ssdOnly:false,capacity:null,brands:[],interfaces:[],minPrice:null,maxPrice:null,selectedId:1,detailOpen:false};
let storageTimer,installPrompt=null;
function favoriteButton(p){return '<button class="favorite-toggle" data-favorite="'+p.id+'" aria-label="Избранное: '+escape(name(p))+'" aria-pressed="'+state.favorites.has(p.id)+'">'+icon('heart')+'</button>';}
function shopMark(o,i){return '<span class="shop"><span class="shop-mark s'+(i+1)+'" aria-hidden="true">'+escape(o.shop.split(' ').pop().slice(0,1))+'</span>'+escape(o.shop)+'</span>';}
function specs(p){return '<div class="specs">'+p.specs.map(s=>'<span>'+escape(s)+'</span>').join('')+'</div>';}
function renderCategories(){
  $('categories').innerHTML=C.categories.map((category,i)=>'<button class="category-card '+(state.category===category?'active':'')+'" data-category="'+escape(category)+'" aria-pressed="'+(state.category===category)+'"><img src="assets/category-'+i+'.webp" width="233" height="150" alt="" decoding="async" '+(i>5?'loading="lazy"':'')+'><span class="category-copy"><strong>'+category+'</strong><small>'+C.countLabel(C.products.filter(p=>p.category===category).length)+' в демокаталоге</small>'+icon('arrow')+'</span></button>').join('');
}
function renderCard(p,detailMode){
  const offers=C.sortedOffers(p.id),image='<img class="product-image" src="assets/'+p.image+'.webp" width="300" height="180" alt="'+escape(name(p))+' — иллюстрация" loading="lazy" decoding="async">';
  const info='<div class="card-info"><h3><button data-open="'+p.id+'">'+escape(name(p))+'</button></h3>'+(detailMode?'<p class="card-subtitle">'+escape(p.specs.join(', '))+'</p>'+specs(p):'<div class="price">'+money(C.bestPrice(p))+'</div><p class="card-note">с известной доставкой · демо</p>'+shopMark(offers[0],0))+'</div>';
  const open='<button class="compare-link" data-open="'+p.id+'">Сравнить 3 предложения '+icon('arrow')+'</button>';
  return '<article class="product-card" data-product="'+p.id+'">'+favoriteButton(p)+'<button class="product-image-button" data-open="'+p.id+'" aria-label="Сравнить '+escape(name(p))+'">'+image+'</button>'+info+(detailMode?'<div class="card-offers"><div class="price">'+money(C.bestPrice(p))+'</div><p class="card-note">итого с доставкой · демо</p>'+offers.map((o,i)=>'<div class="mini-offer">'+shopMark(o,i)+'<b>'+money(C.total(o))+'</b></div>').join('')+open+'</div>':open)+'</article>';
}
function chart(p){
  return '<span class="history-label">Вымышленная история · не рыночные данные</span><svg class="chart" viewBox="0 0 310 130" role="img" aria-label="Пример графика: вымышленная цена снижалась в течение месяца"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0875ff" stop-opacity=".2"/><stop offset="1" stop-color="#0875ff" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M35 15H300M35 53H300M35 91H300M35 15V104M100 15V104M165 15V104M230 15V104M300 15V104"/><path d="M35 20 47 30 64 30 73 35 91 34 101 42 123 47 138 47 149 52 164 50 178 57 198 58 212 68 231 65 251 74 271 76 300 80V104H35Z" fill="url(#chart-fill)" stroke="none"/><path class="chart-line" d="M35 20 47 30 64 30 73 35 91 34 101 42 123 47 138 47 149 52 164 50 178 57 198 58 212 68 231 65 251 74 271 76 300 80"/><circle cx="300" cy="80" r="4" fill="#0875ff" stroke="white"/><text x="0" y="18">'+Math.round(C.bestPrice(p)*1.5).toLocaleString('ru-RU')+'</text><text x="0" y="95">'+C.bestPrice(p).toLocaleString('ru-RU')+'</text><text x="35" y="123">27.09</text><text x="110" y="123">07.10</text><text x="195" y="123">17.10</text><text x="272" y="123">27.10</text></svg><div class="history-caption"><span>Пример за месяц</span><span>'+money(C.bestPrice(p))+' · демо</span></div>';
}
function renderDetail(p){
  const offers=C.sortedOffers(p.id);
  $('detail').innerHTML='<button class="back-results" id="back-results">‹ К списку товаров</button><div class="detail-image"><img src="assets/'+p.image+'.webp" alt="'+escape(name(p))+' — иллюстрация" width="320" height="180">'+favoriteButton(p)+'</div><h2>'+escape(name(p))+'</h2><p class="detail-subtitle">'+escape(p.specs.join(', '))+'</p>'+specs(p)+'<section class="detail-section"><h3>Сравнение цен в магазинах</h3><div class="offer-head"><span>Демонстрационные предложения</span><span>Итого</span></div>'+offers.map((o,i)=>'<div class="offer-row '+(!i?'best':'')+'">'+shopMark(o,i)+'<b>'+money(C.total(o))+'</b><small>демо</small></div><div class="offer-detail">Товар: '+money(o.price)+' · Доставка: '+(o.delivery===null?'уточняется':money(o.delivery))+'</div>').join('')+'<button disabled class="disabled-shop">Ссылки появятся после подключения магазинов</button></section><section class="detail-section"><h3>История цены</h3>'+chart(p)+'</section><p class="filter-note">Изображение иллюстративное. Реальные цены, наличие и характеристики требуют проверки источника.</p>';
}
function render(){
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
  // Home uses the six popular items from the approved composition; search includes all legacy items.
  const homeOrder=[1,4,10,11,2,12];
  if(!active&&state.sort==='default')results=homeOrder.map(id=>C.products.find(p=>p.id===id));
  $('results-heading').textContent=state.onlyFav?'Избранное':ssdMode?'SSD '+(state.capacity||'накопители'):state.category|| (state.query?'Результаты поиска':'Популярные товары');
  $('catalog-subtitle').textContent=active?'Иллюстративный каталог · сравнение с доставкой':'Сравнивайте итоговую стоимость, а не только ценник';
  $('count').textContent=C.countLabel(results.length);
  $('grid').innerHTML=results.length?results.map(p=>renderCard(p,detailMode)).join(''):'<div class="empty-state"><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button class="primary" id="empty-reset">Показать все товары</button></div>';
  const selected=results.find(p=>p.id===state.selectedId)||results[0];
  $('detail').hidden=!detailMode||!selected;
  if(detailMode&&selected){state.selectedId=selected.id;renderDetail(selected);}else document.body.classList.remove('show-detail');
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
function syncRoute(){const p=new URLSearchParams();if(state.query)p.set('q',state.query);if(state.category)p.set('category',state.category);if(state.ssdOnly)p.set('ssd','1');if(state.capacity)p.set('capacity',state.capacity);if(state.onlyFav)p.set('favorites','1');if(state.sort!=='default')p.set('sort',state.sort);if(state.selectedId!==1)p.set('product',state.selectedId);if(state.detailOpen)p.set('view','product');if(state.brands.length)p.set('brands',state.brands.join(','));if(state.interfaces.length)p.set('interfaces',state.interfaces.join(','));if(state.minPrice!==null)p.set('min',state.minPrice);if(state.maxPrice!==null)p.set('max',state.maxPrice);const hash=p.toString();history.replaceState(null,'',location.pathname+location.search+(hash?'#'+hash:''));}
function readRoute(){const p=new URLSearchParams(location.hash.slice(1));state.detailOpen=p.get('view')==='product';state.query=p.get('q')||'';state.category=C.categories.includes(p.get('category'))?p.get('category'):'';state.ssdOnly=p.get('ssd')==='1';state.capacity=['1 ТБ','500 ГБ','2 ТБ','4 ТБ'].includes(p.get('capacity'))?p.get('capacity'):null;state.onlyFav=p.get('favorites')==='1';state.sort=['asc','desc'].includes(p.get('sort'))?p.get('sort'):'default';state.selectedId=Number(p.get('product'))||1;state.brands=(p.get('brands')||'').split(',').filter(v=>['Samsung','Kingston','WD'].includes(v));state.interfaces=(p.get('interfaces')||'').split(',').filter(v=>['SATA','NVMe'].includes(v));const min=p.has('min')?Number(p.get('min')):null,max=p.has('max')?Number(p.get('max')):null;state.minPrice=C.validatePriceRange(min,max)?min:null;state.maxPrice=C.validatePriceRange(min,max)?max:null;$('q').value=state.query;$('min-price').value=state.minPrice??'';$('max-price').value=state.maxPrice??'';document.querySelectorAll('input[name=brand]').forEach(el=>el.checked=state.brands.includes(el.value));render();if(state.detailOpen)document.body.classList.add('show-detail');}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.category!==undefined){selectCategory(button.dataset.category);return;}
  if(button.dataset.favorite){const id=Number(button.dataset.favorite);C.toggleFavorite(state.favorites,id);if(!C.saveFavorites(storage,state.favorites)){$('storage-status').textContent='Хранилище недоступно. Избранное сохранено только до закрытия страницы.';$('storage-status').hidden=false;clearTimeout(storageTimer);storageTimer=setTimeout(()=>$('storage-status').hidden=true,6500);}render();return;}
  if(button.dataset.open){state.selectedId=Number(button.dataset.open);const p=C.products.find(p=>p.id===state.selectedId);if(!p)return;if(!document.body.classList.contains('detail-mode')){state.query=C.isSSD(p)?'SSD 1 ТБ':p.name;state.category='';state.ssdOnly=C.isSSD(p);state.capacity=p.capacity||null;$('q').value=state.query;}state.detailOpen=true;render();document.body.classList.add('show-detail');syncRoute();if(matchMedia('(max-width:980px)').matches)$('catalog').scrollIntoView({block:'start'});return;}
  if(button.dataset.interface!==undefined){state.interfaces=button.dataset.interface?[button.dataset.interface]:[];render();syncRoute();return;}
  if(button.dataset.capacity){state.capacity=button.dataset.capacity;state.ssdOnly=true;render();syncRoute();return;}
  if(button.id==='back-results'){document.body.classList.remove('show-detail');state.detailOpen=false;if(!state.ssdOnly&&!/ssd/i.test(state.query)){reset();}else render();return;}
  if(button.id==='empty-reset')reset();
});
$('q').addEventListener('input',()=>{state.query=$('q').value;state.ssdOnly=false;state.capacity=null;state.detailOpen=false;document.body.classList.remove('show-detail');render();syncRoute();});
$('search-form').addEventListener('submit',e=>{e.preventDefault();$('catalog').scrollIntoView({block:'start'});});
$('category').addEventListener('change',()=>selectCategory($('category').value));
$('sort').addEventListener('change',()=>{state.sort=$('sort').value;render();syncRoute();});
function toggleFavorites(){state.onlyFav=!state.onlyFav;state.detailOpen=false;document.body.classList.remove('show-detail');render();syncRoute();}
$('favorites').onclick=toggleFavorites;$('mobile-favorites').onclick=toggleFavorites;
$('mobile-search').onclick=()=>{$('q').focus();window.scrollTo({top:0,behavior:'smooth'});};
$('all-categories').onclick=reset;
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
readRoute();networkStatus();
