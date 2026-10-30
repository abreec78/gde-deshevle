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


test('homepage navigation opens product preview, never directly runs price comparison',()=>{
 assert.ok(html.includes('id="product-preview"'));
 assert.ok(html.includes('id="preview-photo"'));
 assert.ok(html.includes('id="compare-now"'));
 assert.ok(html.includes('id="comparison-panel" hidden'));
 assert.ok(html.includes('id="source-panel" hidden'));
 assert.ok(html.includes("detectAPI().then("));
 assert.ok(html.includes("$('search').requestSubmit()"));
 assert.ok(html.includes("if(phase==='preview')"));
 assert.ok(html.includes("'./api/compare'"));
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


test('product preview appears with Ozon link before comparison and no fabricated photo',()=>{
 const {context,elements}=setup();
 js(context,"current='https://www.ozon.ru/product/samsung-ssd-12345678/';renderPreview()");
 assert.equal(elements['product-preview'].hidden,false);
 assert.ok(html.includes('id="comparison-panel" hidden'));
 assert.equal(elements['preview-title'].textContent,'samsung ssd');
 assert.ok(elements['preview-photo'].children[0].textContent.includes('Фотография появится'));
 assert.equal(elements['preview-source-link'].href,'https://www.ozon.ru/product/samsung-ssd-12345678/');
});
test('photo and title are shown only when the Ozon source confirms them',()=>{
 const {context,elements}=setup();
 context.sample={sourceTitle:'Samsung MZ-V8V1T0BW 1 TB',sourceImage:'https://ir.ozone.ru/real-photo.jpg',sourcePrice:27000,
  offers:[{shop:'Ozon',title:'Samsung MZ-V8V1T0BW 1 TB',url:'https://www.ozon.ru/product/samsung-ssd-12345678/',
   image:'https://ir.ozone.ru/real-photo.jpg',price:27000,match:'source'}]};
 js(context,"current='https://www.ozon.ru/product/samsung-ssd-12345678/';recordPoll(sample)");
 assert.equal(elements['preview-state'].textContent,'Карточка подтверждена источником');
 assert.equal(elements['preview-title'].textContent,'Samsung MZ-V8V1T0BW 1 TB');
 assert.equal(elements['preview-photo'].children[0].src,'https://ir.ozone.ru/real-photo.jpg');
 assert.ok(html.includes('id="comparison-panel" hidden'));
});
test('compare button reveals lists but without API never invents other-store prices',async()=>{
 const {context,elements}=setup();
 js(context,"current='https://www.ozon.ru/product/samsung-ssd-12345678/';renderPreview()");
 await js(context,'startComparison()');
 assert.equal(elements['comparison-panel'].hidden,false);
 assert.equal(elements['source-panel'].hidden,false);
 assert.ok(elements['message'].textContent.includes('Источник актуальных цен не подключён'));
 assert.ok(elements['cards'].innerHTML.includes('Подтверждённые предложения пока не найдены'));
});


test('Wildberries card links from the browser are recognized by exact article ID',()=>{
 const {context}=setup();
 context.wb='https://www.wildberries.ru/catalog/247318779/detail.aspx?targetUrl=EX';
 const result=js(context,'understandInput(wb)');
 assert.equal(result.kind,'wb');
 assert.equal(result.id,'247318779');
 assert.equal(result.store,'Wildberries');
 assert.equal(result.url,'https://www.wildberries.ru/catalog/247318779/detail.aspx');
 assert.equal(js(context,'isProductLink(wb)'),true);
});
test('Wildberries product IDs with short catalogue URLs are normalized but search pages rejected',()=>{
 const {context}=setup();
 context.wb='https://wildberries.ru/catalog/247318779';
 assert.equal(js(context,'understandInput(wb).url'),'https://www.wildberries.ru/catalog/247318779/detail.aspx');
 for(const candidate of ['https://wildberries.ru.evil.test/catalog/247318779/detail.aspx',
 'http://www.wildberries.ru/catalog/247318779/detail.aspx',
 'https://www.wildberries.ru/catalog/0/search.aspx?search=ssd',
 'https://www.wildberries.ru/seller/247318779']){
  context.wb=candidate;
  assert.equal(js(context,'understandInput(wb).kind'),'invalid');
 }
});
test('Yandex Market individual cards are accepted, site search remains unverified',()=>{
 const {context}=setup();
 context.url='https://market.yandex.ru/card/elektrobritva-braun/103683837950?sku=42';
 assert.equal(js(context,'understandInput(url).kind'),'ym');
 context.url='https://market.yandex.ru/search?text=braun';
 assert.equal(js(context,'understandInput(url).kind'),'invalid');
});
test('comparison button remains clickable during card lookup and queues comparison',async()=>{
 const {context,elements}=setup();
 js(context,"current='https://www.wildberries.ru/catalog/247318779/detail.aspx';apiMode=true;previewTicket='job-123';renderPreview()");
 assert.equal(elements['compare-now'].disabled,false);
 await js(context,'startComparison()');
 assert.equal(js(context,'compareRequested'),true);
 assert.equal(elements['comparison-panel'].hidden,false);
 assert.equal(elements['source-panel'].hidden,false);
 assert.ok(elements['message'].textContent.includes('Сравнение начнётся автоматически'));
});
test('without backend the Wildberries compare button still opens store links and gives honest status',async()=>{
 const {context,elements}=setup();
 js(context,"current='https://www.wildberries.ru/catalog/247318779/detail.aspx';renderPreview()");
 await js(context,'startComparison()');
 assert.equal(elements['compare-now'].disabled,false);
 assert.equal(elements['comparison-panel'].hidden,false);
 assert.equal(elements['source-panel'].hidden,false);
 assert.ok(elements['message'].textContent.includes('Источник актуальных цен не подключён'));
 assert.equal(js(context,'STORES.length'),18);
});
test('verified candidates and merely similar candidates are displayed separately',()=>{
 assert.ok(html.includes('Похожие предложения, совпадение модели НЕ подтверждено'));
 assert.ok(html.includes('offer-unverified'));
 assert.ok(html.includes("x.match==='source'||x.match==='confirmed'"));
 assert.ok(html.includes('min'));
});
