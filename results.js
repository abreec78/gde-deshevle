'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const embedded=Boolean($('inline-compare'));
  const searchForm=$('product-search')||$('search-form');
  const searchInput=$('query')||$('q');
  function showInline(visible){
    if(!embedded)return;
    $('inline-compare').hidden=!visible;
    document.body.classList.toggle('inline-results-open',visible);
  }
  function shortHelper(source){
    const container=$('shortlink-help');
    if(!container)return;
    container.hidden=!source||source.kind!=='short';
    if(source?.kind==='short')$('shortlink-open').href=source.url;
    if($('offers-section'))$('offers-section').hidden=Boolean(source?.kind==='short');
  }
  const money=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
  const state={turn:0,query:'',source:null,sourceTitle:'',sourceImage:'',offers:[],api:false,archival:false,reportDate:'',done:false};
  // Price coverage is separate from links. Only a returned verified offer is a market price.
  const known=[
    ['Ozon','ozon.ru','https://www.ozon.ru/search/?text='],
    ['Wildberries','wildberries.ru','https://www.wildberries.ru/catalog/0/search.aspx?search='],
    ['Яндекс Маркет','market.yandex.ru','https://market.yandex.ru/search?text='],
    ['Ситилинк','citilink.ru'],['DNS','dns-shop.ru'],['М.Видео','mvideo.ru'],
    ['Эльдорадо','eldorado.ru'],['Мегамаркет','megamarket.ru'],['AliExpress','aliexpress.ru'],
    ['ВсеИнструменты','vseinstrumenti.ru'],['Петрович','petrovich.ru'],
    ['Золотое Яблоко','goldapple.ru'],['Lamoda','lamoda.ru'],
    ['Спортмастер','sportmaster.ru'],['Детский мир','detmir.ru'],
    ['RBT','rbt.ru'],['Технопарк','technopark.ru'],['Ашан','auchan.ru']
  ];
  function shopSearchLink(store,term){
    if(!term)return null;
    const text=encodeURIComponent(term);
    if(store[2])return store[2]+text;
    return 'https://yandex.ru/search/?text='+encodeURIComponent('site:'+store[1]+' '+term);
  }
  function safeUrl(input){
    try{const url=new URL(input);return url.protocol==='https:'&&!url.username&&!url.password&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)?url.href:null}catch{return null}
  }
  function parseQuery(raw){
    const input=String(raw||'').trim().slice(0,1200);
    if(!input)return {kind:'empty'};
    if(!/^https?:\/\//i.test(input))return {kind:'text',query:input};
    let url;try{url=new URL(input)}catch{return {kind:'invalid',reason:'Ссылка повреждена. Вставьте полный адрес карточки товара.'}}
    if(!safeUrl(input))return {kind:'invalid',reason:'Используйте безопасную HTTPS-ссылку на карточку товара.'};
    const host=url.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='ozon.ru'){
      const short=url.pathname.match(/^\/t\/([a-zA-Z0-9_-]+)\/?$/);
      if(short)return {kind:'short',store:'Ozon',id:short[1],url:'https://ozon.ru/t/'+short[1],query:''};
      const match=url.pathname.match(/^\/product\/(?:.*?-)?(\d+)\/?$/);
      if(!match)return {kind:'invalid',reason:'У Ozon нужна полная ссылка /product/… . Короткие ссылки следует раскрыть в браузере.'};
      const path=url.pathname;
      let slug=path.split('/')[2].replace(/-\d+\/?$/,'').replace(/-/g,' ');
      try{slug=decodeURIComponent(slug)}catch{}
      return {kind:'product',store:'Ozon',id:match[1],url:'https://www.ozon.ru'+path,query:slug.trim()};
    }
    if(host==='wildberries.ru'){
      const match=url.pathname.match(/^\/catalog\/(\d+)(?:\/detail\.aspx)?\/?$/i);
      if(!match)return {kind:'invalid',reason:'Для Wildberries скопируйте ссылку на конкретную карточку /catalog/…/detail.aspx.'};
      return {kind:'product',store:'Wildberries',id:match[1],url:'https://www.wildberries.ru/catalog/'+match[1]+'/detail.aspx',query:''};
    }
    if(host==='market.yandex.ru'){
      const match=url.pathname.match(/^\/(?:card|p)\/(.+)\/(\d+)\/?$/i);
      if(!match)return {kind:'invalid',reason:'Для Яндекс Маркета нужна прямая ссылка на карточку товара.'};
      let slug=match[1];try{slug=decodeURIComponent(slug)}catch{}
      return {kind:'product',store:'Яндекс Маркет',id:match[2],url:'https://market.yandex.ru'+url.pathname,query:slug.replace(/-/g,' ')};
    }
    return {kind:'invalid',reason:'Сейчас распознаются ссылки Ozon, Wildberries и Яндекс Маркета. Для других магазинов введите точную модель.'};
  }
  function status(value){$('status').textContent=value}
  function renderPhoto(){
    const root=$('product-photo');root.replaceChildren();
    const src=safeUrl(state.sourceImage);
    if(src){
      const img=document.createElement('img');img.src=src;img.alt=state.sourceTitle?'Фото '+state.sourceTitle:'Фото товара';img.loading='eager';
      img.onerror=()=>{root.replaceChildren();const p=document.createElement('span');p.textContent='Фотография из источника недоступна';root.append(p)};
      root.append(img);
    }else{const msg=document.createElement('span');msg.textContent='Фото появится, если его предоставит источник';root.append(msg)}
  }
  function renderProduct(){
    const source=state.source;
    $('product-panel').hidden=!source||source.kind==='invalid'||source.kind==='empty'||source.kind==='short';
    if($('product-panel').hidden)return;
    $('source-label').textContent=state.archival?'Архивный пример с сохранёнными ценами':source.kind==='product'?'Источник: '+source.store:'Поиск по названию';
    $('product-title').textContent=state.sourceTitle||source.query||(source.kind==='product'?source.store+' · товар № '+source.id:'Поиск товара');
    $('product-description').textContent=state.archival?'Данные из сохранённых отчётов за '+state.reportDate+'; это не сегодняшние цены.':
      state.sourceTitle?'Модель определена по источнику. Показываем только подтверждённые совпадения.':
      source.kind==='product'?'Карточка распознана по ссылке. Название и фото требуют данных магазина.':'Уточните модель, чтобы найти одинаковые предложения.';
    const original=$('original-link');original.hidden=source.kind!=='product';
    if(!original.hidden){original.href=source.url;original.textContent='Открыть товар на '+source.store+' ↗'}
    renderPhoto();
    if(embedded)$('product-panel').classList.toggle('no-source-photo',!safeUrl(state.sourceImage));
  }
  function validOffer(x){
    return x&&typeof x.shop==='string'&&x.shop.trim().length>0&&safeUrl(x.url)&&Number.isFinite(x.price)&&x.price>0&&
       (x.match==='source'||x.match==='confirmed')&&(!x.delivery||Number.isFinite(x.delivery)&&x.delivery>=0);
  }
  function comparableOffers(){
    const offers=new Map();
    for(const raw of state.offers){
      if(!validOffer(raw))continue;
      const entry={...raw,url:safeUrl(raw.url),price:Number(raw.price),delivery:raw.delivery??null};
      const key=entry.shop.trim().toLowerCase();
      const current=offers.get(key);
      if(!current||entry.price<current.price)offers.set(key,entry);
    }
    return [...offers.values()].sort((a,b)=>a.price-b.price);
  }
  function el(tag,cls,contents){const node=document.createElement(tag);if(cls)node.className=cls;if(contents!==undefined)node.textContent=contents;return node}
  function renderOffers(){
    const list=$('offers');list.replaceChildren();
    const data=comparableOffers();
    (embedded?$('inline-count'):$('count')).textContent=data.length+' '+(data.length===1?'предложение':data.length>=2&&data.length<=4?'предложения':'предложений');
    $('best').hidden=!data.length;
    $('empty').hidden=data.length>0;
    $('sample-note').textContent=state.archival?'Архив: '+state.reportDate+'. Не использовать как актуальную цену.':'';
    if(!data.length){
      $('empty-reason').textContent=state.archival?'В архиве нет допустимых предложений.':
        state.api&&!state.done?'Идёт получение подтверждённых предложений. Непохожие товары не учитываются.':
        'Цены точно такого же товара пока не получены. Сервер цен не подключён или совпадения не подтверждены. Нельзя определить самый дешёвый магазин.';
      return;
    }
    const best=data[0],prefix=state.archival?'Самый дешёвый вариант из архивных предложений':'Самый дешёвый из подтверждённых вариантов';
    $('best').replaceChildren();
    $('best').append(el('span','',prefix+': '),el('strong','',money(best.price)+' · '+best.shop));
    if(state.archival)$('best').append(el('span','',' · данные за '+state.reportDate));
    for(const [i,o] of data.entries()){
      const item=el('article','result-offer'+(!i?' cheapest':''));
      item.append(el('div','offer-seller',o.shop),el('div','offer-price',money(o.price)));
      item.append(el('div','offer-title',o.title||state.sourceTitle||'Идентичный товар'));
      item.append(el('div','offer-label',Number.isFinite(o.delivery)?'Доставка: '+money(o.delivery):'Доставка не учтена'));
      if(state.archival)item.append(el('div','offer-date','Цена из отчёта '+state.reportDate));
      else if(o.checkedAt){
        const dt=Date.parse(o.checkedAt);
        item.append(el('div','offer-date',Number.isFinite(dt)?'Цена проверена: '+new Date(dt).toLocaleString('ru-RU'):'Время проверки не подтверждено'));
      }else item.append(el('div','offer-date','Время проверки не указано'));
      const a=el('a','offer-link','В магазин ↗');a.href=o.url;a.target='_blank';a.rel='noopener noreferrer nofollow sponsored';item.append(a);
      list.append(item);
    }
  }
  function renderSearchLinks(){
    // Not a marketplace directory: only confirmed matches are displayed.
    // Keep the standalone page's legacy section hidden as well.
    const section=$('search-options');
    if(section)section.hidden=true;
    const target=$('store-search-links');
    if(target)target.replaceChildren();
  }
  async function fetchJson(url,options){
    const response=await fetch(url,options);
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
  }
  async function loadArchivedExample(turn){
    const doc=await fetchJson('./data/sample-ssd980.json',{cache:'no-store'});
    if(turn!==state.turn)return;
    if(!doc||!safeUrl(doc.sourceUrl)||!Array.isArray(doc.offers))throw Error('Архивный пример недоступен');
    state.source=parseQuery(doc.sourceUrl);
    state.query=doc.sourceUrl;
    state.sourceTitle=doc.title;
    state.sourceImage=doc.image;
    state.offers=doc.offers.map(o=>({...o,match:o.match==='source'?'source':'confirmed'}));
    state.archival=true;state.reportDate=doc.sampleDate||'30.10.2026';state.done=true;
    searchInput.value=state.query;
    renderProduct();renderOffers();renderSearchLinks();status('Пример сравнения открыт. Это исторические цены, не текущие.');
  }
  async function find(query){
    const turn=++state.turn;
    state.query=String(query||'').trim().slice(0,1200);
    state.source=parseQuery(state.query);
    state.sourceTitle='';state.sourceImage='';state.offers=[];state.archival=false;state.reportDate='';state.done=false;state.api=false;
    searchInput.value=state.query;
    const source=state.source;
    showInline(source.kind!=='empty');
    shortHelper(source);
    renderProduct();renderOffers();renderSearchLinks();
    if(source.kind==='empty'){status('Введите ссылку на товар или точную модель.');return}
    if(source.kind==='invalid'){status(source.reason);return}
    if(source.kind==='short'){
      const u=new URL(location.href);u.searchParams.set('q',state.query);u.searchParams.delete('sample');history.replaceState(null,'',u.pathname+u.search);
      status('Пытаемся раскрыть короткую ссылку Ozon и определить конкретный товар…');
      try{
        const response=await fetchJson('./api/resolve?url='+encodeURIComponent(source.url),{
          cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(turn!==state.turn)return;
        if(response.resolved&&response.url&&parseQuery(response.url).kind==='product'){
          searchInput.value=response.url;
          await find(response.url); // immediately continues with normal API search
          return;
        }
      }catch{}
      if(turn!==state.turn)return;
      state.done=true;renderSearchLinks();
      status('Короткая ссылка Ozon принята. Ozon не предоставил полный адрес товара. Без него нельзя точно определить модель и сравнить реальные цены. Открой ссылку и скопируй адрес карточки.');
      return;
    }
    const u=new URL(location.href);u.searchParams.set('q',state.query);u.searchParams.delete('sample');history.replaceState(null,'',u.pathname+u.search);
    status(source.kind==='product'?'Ссылка '+source.store+' распознана. Проверяем наличие источника актуальных цен…':'Ищем по названию. Проверяем наличие источника цен…');
    try{
      const api=await fetchJson('./api/status',{cache:'no-store',signal:AbortSignal.timeout(2000)});
      if(turn!==state.turn)return;
      if(!api.enabled)throw Error('API выключен');
      state.api=true;
    }catch{
      if(turn!==state.turn)return;
      state.done=true;renderOffers();renderSearchLinks();
      status('Нет подключения к ценам магазинов. Предложения этого товара не получены, минимальную цену определить нельзя.');
      return;
    }
    try{
      const sourceUrl=source.kind==='product'?source.url:null;
      const task=await fetchJson('./api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:state.query,sourceUrl,autoCompare:true,region:'Москва'})});
      if(!task.id)throw Error('Нет ID задания');
      status('Определяем точный товар и запрашиваем цены подключённых площадок…');
      for(let attempt=0;attempt<35;attempt++){
        if(turn!==state.turn)return;
        const statusData=await fetchJson('./api/poll?id='+encodeURIComponent(task.id),{cache:'no-store'});
        if(turn!==state.turn)return;
        if(typeof statusData.sourceTitle==='string'&&statusData.sourceTitle)state.sourceTitle=statusData.sourceTitle;
        if(safeUrl(statusData.sourceImage))state.sourceImage=statusData.sourceImage;
        if(Array.isArray(statusData.offers))state.offers=statusData.offers;
        renderProduct();renderOffers();renderSearchLinks();
        if(statusData.done){
          state.done=true;renderOffers();
          const total=comparableOffers().length;
          status(total?'Найдено подтверждённых предложений: '+total+'. Отсортировано от дешёвого к дорогому.':'Проверка завершена. Подтверждённых предложений нет. '+(statusData.errors||[]).join('; '));
          return;
        }
        if(statusData.phase==='error'){state.done=true;renderOffers();status('Не удалось определить точный товар по источнику.');return}
        status(state.sourceTitle?'Товар определён. Проверяем предложения магазинов…':'Получаем точную модель по ссылке…');
        await new Promise(resolve=>setTimeout(resolve,3500));
      }
      state.done=true;renderOffers();status('Источник ещё обрабатывает задание. Актуальные предложения пока не получены.');
    }catch{
      if(turn!==state.turn)return;
      state.done=true;renderOffers();
      status('Сервер цен не смог завершить запрос. Неподтверждённые цены не показываются.');
    }
  }
  searchForm.addEventListener('submit',event=>{
    event.preventDefault();
    void find(searchInput.value);
    if(embedded)requestAnimationFrame(()=>$('inline-compare').scrollIntoView({behavior:'smooth',block:'start'}));
  });
  if(embedded){
    document.addEventListener('click',event=>{
      const link=event.target.closest('a[href^="?q="]');
      if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      const target=new URL(link.href);
      const q=target.searchParams.get('q');
      if(q){searchInput.value=q;void find(q);requestAnimationFrame(()=>$('inline-compare').scrollIntoView({behavior:'smooth',block:'start'}));}
    });
  }
  if(embedded){
    $('close-inline-search').onclick=()=>{
      state.turn++;state.query='';state.source=null;state.offers=[];state.sourceTitle='';state.sourceImage='';state.api=false;
      searchInput.value='';showInline(false);shortHelper(null);
      const u=new URL(location.href);u.searchParams.delete('q');u.searchParams.delete('sample');history.replaceState(null,'',u.pathname+u.search);
      searchInput.focus();
    };
    $('shortlink-paste').onclick=async()=>{
      try{
        if(navigator.clipboard?.readText){
          const value=(await navigator.clipboard.readText()).trim();
          if(value.startsWith('https://')&&value!==state.query){searchInput.value=value;void find(value);return;}
        }
      }catch{}
      searchInput.focus();status('Вставь полный адрес с помощью Ctrl+V в поиск сверху и нажми синюю кнопку.');
    };
  }
  const params=new URLSearchParams(location.search);
  if(params.get('sample')==='1') {
    showInline(true);
    void loadArchivedExample(++state.turn).catch(()=>status('Архивный пример недоступен.'));
  }
  else if(params.has('q'))void find(params.get('q'));
  else {renderOffers();renderSearchLinks()}
})();
