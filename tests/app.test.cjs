const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync,statSync}=require('node:fs');
const {join}=require('node:path');
const C=require('../core.js');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const storage=(value)=>{const map=new Map(value==null?[]:[['favorites',value]]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};

test('all six original PR2 product IDs, names and prices remain available',()=>{
  assert.deepEqual(C.products.slice(0,6).map(p=>[p.id,p.name,p.price]),[[1,'SSD 1 ТБ',4590],[2,'Беспроводные наушники',1990],[3,'Робот-пылесос',12990],[4,'Смартфон 128 ГБ',14990],[5,'Клавиатура',1290],[6,'Электрочайник',2490]]);
});
test('demo disclosure is persistent, no fabricated sale or review labels',()=>{
  assert.match(html,/Цены ниже вымышленные/);
  const app=readFileSync(join(root,'app.js'),'utf8');
  assert.match(app,/Вымышленная история/);assert.match(app,/настоящих ссылок на тестовых продавцов нет/);
  assert.doesNotMatch(app,/124 товара|1 248 отзыв|Лучша[яи] цена|-25%/);
});
test('search trims spaces, ignores case and matches SSD specifications',()=>{
  const list=C.filterProducts({query:' SsD 1 тБ '});
  assert.deepEqual(list.map(p=>p.id),[1,7,8,9]);
  assert.deepEqual(C.filterProducts({query:'НАУШНИКИ'}).map(p=>p.id),[2]);
  assert.equal(C.filterProducts({query:'несуществующий товар'}).length,0);
  assert.equal(C.filterProducts({query:'   '}).length,C.products.length);
  assert.equal(C.filterProducts({query:'kingston NVMe'}).length,1);
});
test('there are exactly twelve distinct categories from the approved home mockup',()=>{
  assert.equal(C.categories.length,12);assert.equal(new Set(C.categories).size,12);
  const select=html.match(/<select id="category"[\s\S]*?<\/select>/)[0];
  const options=[...select.matchAll(/<option(?:\s[^>]*)?>(.*?)<\/option>/g)].map(m=>m[1]);
  assert.deepEqual(options.slice(1),C.categories);
});
for(const category of C.categories)test('category: '+category,()=>{
  const expected=C.products.filter(p=>p.category===category);
  assert.deepEqual(C.filterProducts({category}),expected);
});
test('all 36 offers: known delivery is included; unknown is never zero',()=>{
  for(const p of C.products){const offers=C.sortedOffers(p.id);assert.equal(offers.length,3);assert.equal(offers[0].delivery,0);assert.equal(offers[1].delivery,390);assert.equal(offers[2].delivery,null);assert.equal(C.total(offers[2]),null);for(const o of offers.slice(0,2))assert.equal(C.total(o),o.price+o.delivery);assert.equal(C.bestPrice(p),p.price+250);}
  assert.equal(C.total({price:100,delivery:undefined}),null);
  assert.equal(C.total({price:100,delivery:NaN}),null);
});
test('original SSD delivered totals remain 4840 versus 4980',()=>{
  assert.deepEqual(C.sortedOffers(1).map(C.total),[4840,4980,null]);
});
test('sorting uses the same delivered minimum in both directions',()=>{
  const asc=C.filterProducts({sort:'asc'}).map(C.bestPrice),desc=C.filterProducts({sort:'desc'}).map(C.bestPrice);
  assert.deepEqual(asc,[...asc].sort((a,b)=>a-b));assert.deepEqual(desc,[...asc].reverse());
  assert.deepEqual(C.filterProducts().map(p=>p.id),C.products.map(p=>p.id));
});
test('legacy favorites survive migration, new page context and removal',()=>{
  const store=storage('[1,5]'),fav=C.readFavorites(store);
  assert.deepEqual(C.filterProducts({onlyFav:true,favorites:fav}).map(p=>p.id),[1,5]);
  C.toggleFavorite(fav,2);assert.equal(C.saveFavorites(store,fav),true);
  const reload=C.readFavorites(store);assert.deepEqual([...reload],[1,5,2]);
  C.toggleFavorite(reload,1);C.toggleFavorite(reload,5);C.toggleFavorite(reload,2);
  assert.equal(C.filterProducts({onlyFav:true,favorites:reload}).length,0);
});
test('search, category, sort, price and favorites compose',()=>{
  const state={favorites:new Set([1,5,7]),onlyFav:true,category:C.categories[1],sort:'asc'};
  assert.deepEqual(C.filterProducts(state).map(p=>p.id),[5,7,1]);
  assert.deepEqual(C.filterProducts({...state,query:'ssd',minPrice:4600}).map(p=>p.id),[1]);
  assert.equal(C.filterProducts({...state,category:C.categories[0]}).length,0);
});
for(const saved of ['{bad','{}','null','"string"','[1,"2",null,{},2.5]'])test('malformed favorites: '+saved,()=>{
  assert.deepEqual(C.filterProducts({onlyFav:true,favorites:C.readFavorites(storage(saved))}).map(p=>p.id),saved.startsWith('[1,')?[1]:[]);
});
test('blocked storage keeps in-memory favorites without crashing',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  const fav=C.readFavorites(blocked);C.toggleFavorite(fav,1);assert.equal(C.saveFavorites(blocked,fav),false);
  assert.deepEqual(C.filterProducts({onlyFav:true,favorites:fav}).map(p=>p.id),[1]);
  assert.equal(C.readFavorites(null).size,0);
});
test('filtering SSD, brands, interfaces and capacity works',()=>{
  assert.deepEqual(C.filterProducts({ssdOnly:true,capacity:'1 ТБ'}).map(p=>p.id),[1,7,8,9]);
  assert.deepEqual(C.filterProducts({ssdOnly:true,brands:['Samsung'],interfaces:['NVMe']}).map(p=>p.id),[1]);
  assert.deepEqual(C.filterProducts({ssdOnly:true,interfaces:['SATA']}).map(p=>p.id),[8]);
  assert.equal(C.filterProducts({ssdOnly:true,capacity:'2 ТБ'}).length,0);
  assert.equal(C.filterProducts({ssdOnly:true,maxPrice:1000}).length,0);
});
test('invalid price ranges are rejected; zero and inclusive bounds work',()=>{
  for(const pair of [[-1,100],[200,100],[NaN,100],[0,Infinity]])assert.equal(C.validatePriceRange(...pair),false);
  for(const pair of [[null,null],[0,0],[0,5000],[5000,null]])assert.equal(C.validatePriceRange(...pair),true);
  assert.deepEqual(C.filterProducts({minPrice:4840,maxPrice:4840}).map(p=>p.id),[1]);
});
test('favorites cannot inject a nonexistent product',()=>{const fav=new Set();C.toggleFavorite(fav,999);assert.equal(fav.size,0);});
test('correct Russian counts',()=>{assert.equal(C.countLabel(1),'1 товар');assert.equal(C.countLabel(4),'4 товара');assert.equal(C.countLabel(12),'12 товаров');assert.equal(C.countLabel(21),'21 товар');});
test('local images exist, are compact and contain no external dependencies',()=>{
  for(const p of C.products)assert.ok(existsSync(join(root,'assets',p.image+'.webp')));
  for(let i=0;i<12;i++)assert.ok(existsSync(join(root,'assets','category-'+i+'.webp')));
  const css=readFileSync(join(root,'styles.css'),'utf8');assert.doesNotMatch(css,/@import|https?:\/\//);assert.match(css,/prefers-reduced-motion/);
  assert.ok(statSync(join(root,'styles.css')).size<30000);
});
test('PWA icons, scope and shortcuts resolve locally under a subpath',()=>{
  const manifest=JSON.parse(readFileSync(join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
  for(const i of manifest.icons){assert.ok(existsSync(join(root,i.src)));assert.match(i.sizes,/192x192|512x512/);}
  for(const s of manifest.shortcuts)assert.ok(s.url.startsWith('./#'));
  assert.match(html,/apple-touch-icon/);
});
