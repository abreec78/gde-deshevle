'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','compare-any.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(){
  const elements={};
  const el=()=>({value:'',textContent:'',innerHTML:'',children:[],href:'',target:'',rel:'',title:'',className:'',
    addEventListener(){},append(x){this.children.push(x)},replaceChildren(){this.children=[];this.innerHTML=''},
    querySelector(){return el()},reset(){},click(){},remove(){},setAttribute(){},
  });
  const document={getElementById(k){return elements[k]??(elements[k]=el())},createElement(){return el()}};
  const ls={getItem(){return null},setItem(){}};
  const context=vm.createContext({document,localStorage:ls,location:{search:''},URL,URLSearchParams,Date,Number,String,Array,Math,Set,JSON,Blob,Intl,
    fetch:async()=>{throw Error('offline')},setTimeout(){return 1},clearTimeout(){},confirm:()=>true});
  vm.runInContext(code,context,{timeout:3000});
  return {context,elements};
}
function js(context,text){return vm.runInContext(text,context,{timeout:3000})}
test('client source contains 18 distinct stores and real images from reports',()=>{
 const {context}=setup();assert.equal(js(context,'STORES.length'),18);
 assert.ok(js(context,'STORES.some(s=>s[0]==="Wildberries")'));
 assert.ok(js(context,'externalSearch(STORES[2],"Samsung A55").includes("market.yandex.ru/search")'));
});
test('Yandex report uses card-level fallback URL and photo link',()=>{
 const {context}=setup();
 const report={regioncode:'Москва',data:[{link:'https://market.yandex.ru/card/ssd-samsung/102208554664',
  sku:{history:[{record_date:'2026-10-30T12:37:40+03:00'}]},offers:[{
  Name:'Samsung 980 MZ-V8V1T0BW 1 ТБ',ShopUrl:null,Price:30689,
  Offer_pics:['https://avatars.mds.yandex.net/myimg.jpg'],Market_short:'YM'}]}]};
 context.fixture=report;const a=js(context,'parseReport(fixture)');
 assert.equal(a.length,1);assert.equal(a[0].shop,'Яндекс Маркет');assert.equal(a[0].price,30689);
 assert.equal(a[0].url,report.data[0].link);assert.equal(a[0].image,report.data[0].offers[0].Offer_pics[0]);
});
test('Ozon report reads actual product URL and rejects zero price',()=>{
 const {context}=setup();
 context.fixture={regioncode:'Москва',data:[{link:'https://www.ozon.ru/product/ssd-1234567',offers:[
   {ShopUrl:'https://www.ozon.ru/product/ssd-1234567',Name:'Samsung 980 MZ-V8V1T0BW 1 ТБ',Price:27428,Offer_pics:['https://ir.ozone.ru/photo.jpg']},
   {ShopUrl:'https://www.ozon.ru/product/ssd-1234568',Name:'Other',Price:0}]}]};
 const got=js(context,'parseReport(fixture)');assert.equal(got.length,1);assert.equal(got[0].shop,'Ozon');
});
test('comparison only marks strong identical MPN and non-conflicting capacities',()=>{
 const {context}=setup();
 const data=[{mpn:'MZ-V8V1T0BW',title:'Samsung 980 1 ТБ'},{mpn:'MZ-V8V1T0BW',title:'Samsung 980 1 TB'}];
 context.match=data;assert.equal(js(context,'comparable(match)'),true);
 context.match[1].mpn='MZ-V8V2T0BW';assert.equal(js(context,'comparable(match)'),false);
 context.match[1].mpn='MZ-V8V1T0BW';context.match[1].title='Samsung 980 2 TB';
 assert.equal(js(context,'comparable(match)'),false);
});
test('unknown URLs and empty prices are never treated as offers',()=>{
 const {context}=setup();
 assert.equal(js(context,'https("http://example.com/item")'),'');
 assert.equal(js(context,'getStore("https://www.ozon.ru/product/ssd-1234")'),'Ozon');
 assert.equal(js(context,'getStore("https://ozon.ru.evil.test/product/1")'),null);
});


test('homepage-to-comparison navigation auto-runs only when backend is enabled',()=>{
 assert.ok(html.includes("detectAPI().then("));
 assert.ok(html.includes("if(apiMode&&typeof $('search').requestSubmit==='function')"));
 assert.ok(html.includes("Без API нельзя получить и сравнить актуальные цены"));
});
test('Ozon product link is recognized by immutable product ID',()=>{
 const {context}=setup();
 context.link='https://www.ozon.ru/product/samsung-ssd-12345678/?from=share';
 const info=js(context,'understandInput(link)');
 assert.equal(info.kind,'ozon');
 assert.equal(info.id,'12345678');
 assert.equal(info.url,'https://www.ozon.ru/product/samsung-ssd-12345678/');
 assert.equal(info.query,'samsung ssd');
});
test('shortlinks and fake Ozon domains do not impersonate product pages',()=>{
 const {context}=setup();
 for(const link of ['https://ozon.ru.evil.test/product/12345','https://www.ozon.ru/search/?text=ssd','https://www.ozon.ru/t/aBcd','http://www.ozon.ru/product/12345']) {
   context.link=link;
   assert.equal(js(context,'understandInput(link).kind'),'invalid');
 }
});
test('the cheapest badge is reserved for confirmed matching offers',()=>{
 const {context}=setup();
 assert.equal(js(context,'typeof understandInput'),'function');
 assert.ok(js(context,'document.getElementById("best")'));
 assert.ok(html.includes("x.match==='confirmed'"));
 assert.ok(html.includes("items.some(x=>x.match==='source')"));
 assert.ok(html.includes("Доставка и персональные скидки могут изменить итоговую стоимость"));
});
test('the comparison page uses the same blue-white visual identity as homepage',()=>{
 assert.ok(html.includes('href="./styles.css"'));
 assert.ok(html.includes('color:#0875ff'));
 assert.ok(html.includes('Где дешевле?'));
 assert.ok(html.includes('font-weight:600'));
});
