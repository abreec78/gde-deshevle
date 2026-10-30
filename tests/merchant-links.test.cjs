'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
const source=app.slice(app.indexOf('function shopMark('),app.indexOf('function specs('));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const make=(mode)=>new Function('C','escape',source+'return {shopMark,merchantSummary}')({
 mode,safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1'].includes(u.hostname)}catch{return false}}
},escape);

test('real merchant name in results is a direct clickable product offer',()=>{
 const {merchantSummary,shopMark}=make('live');
 const o={shop:'Ситилинк',url:'https://go.avred.online/abc?dl=https%3A%2F%2Fcitilink.ru%2Fproduct%2F12',price:1234};
 const result=merchantSummary(o,0);
 assert.match(result,/Магазин:/);
 assert.match(result,/Ситилинк/);
 assert.match(result,/<a class="shop shop-link"/);
 assert.match(result,/href="https:\/\/go\.avred\.online\/abc\?dl=/);
 assert.match(result,/target="_blank"/);
 assert.match(result,/rel="noopener noreferrer nofollow sponsored"/);
 assert.match(shopMark(o,2),/↗/);
});

test('real seller label uses supplied seller name and shows marketplace too',()=>{
 const o={shop:'Ozon',sellerName:'Позитроника',url:'https://www.ozon.ru/product/test-1234/'};
 const result=make('live').merchantSummary(o,0);
 assert.match(result,/Продавец:/);
 assert.match(result,/Позитроника/);
 assert.match(result,/Ozon/);
 assert.match(result,/class="shop shop-link"/);
});

test('real seller profile URL takes priority over product offer URL only when provided',()=>{
 const o={shop:'Ozon',sellerName:'Позитроника',sellerUrl:'https://www.ozon.ru/seller/pozitronika-123/',url:'https://www.ozon.ru/product/test-1234/'};
 const result=make('live').merchantSummary(o,0);
 assert.match(result,/href="https:\/\/www\.ozon\.ru\/seller\/pozitronika-123\//);
 assert.match(result,/Открыть страницу продавца/);
});

test('fake demo seller never gets a fabricated purchase link',()=>{
 const o={shop:'Магазин Б',price:1234,url:'https://example.org/should-not-open'};
 const result=make('demo').merchantSummary(o,1);
 assert.match(result,/Демо-магазин:/);
 assert.match(result,/Магазин Б/);
 assert.match(result,/демо/);
 assert.doesNotMatch(result,/<a|href=/);
});

test('invalid or malicious merchant URLs never become links',()=>{
 const shop={shop:'Test',url:'javascript:alert(1)',sellerName:'<img src=x onerror=alert(1)>'};
 const result=make('live').merchantSummary(shop,0);
 assert.doesNotMatch(result,/<a|href=|<img/);
 assert.match(result,/&lt;img/);
 assert.doesNotMatch(make('live').shopMark({shop:'Shop',url:'https://localhost/private'},0),/<a/);
});

test('all result layouts expose merchants before opening product details',()=>{
 assert.match(app,/detailMode\?[^;]*merchantSummary\(offers\[0\],0\)/);
 assert.match(app,/mini-offer[^;]*shopMark\(o,i\)/);
 assert.match(app,/offer-row[^;]*shopMark\(o,i\)/);
 assert.match(css,/\.seller-inline\{/);
 assert.match(css,/\.shop-link\{/);
});
