'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root='http://127.0.0.1:8899/';
 try{
  // 1. Legacy standalone results remain directly accessible; homepage uses the inline version.
  await page.goto(root,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#grid .product-card');
  assert.equal(await page.locator('#grid .product-card').count(),12);
  await page.goto(root+'results.html',{waitUntil:'domcontentloaded'});
  await page.locator('#query').fill('https://www.wildberries.ru/catalog/247318779/detail.aspx');
  await page.locator('#product-search button').click();
  await page.locator('#product-title').waitFor({state:'visible'});
  assert.match(await page.locator('#product-title').textContent(),/Wildberries/);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('не подключён'));
  assert.equal(await page.locator('#offers .result-offer').count(),0);
  assert.equal(await page.locator('#empty').isVisible(),true);
  assert.equal(await page.locator('#search-options').isVisible(),false);

  // 2. Exact original card loads once; the API automatically matches and ranks all confirmed stores.
  let requestBody=null;
  await page.route('**/api/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:true,provider:'Fixture'})}));
  await page.route('**/api/search',route=>{
    requestBody=route.request().postDataJSON();
    return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({id:'fixture-1'})});
  });
  await page.route('**/api/poll*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    done:true,sourceTitle:'Samsung 980 MZ-V8V1T0BW 1 ТБ',sourceImage:'https://ir.ozone.ru/example-photo.jpg',
    offers:[
      {shop:'Яндекс Маркет',title:'Samsung 980 MZ-V8V1T0BW 1 ТБ',url:'https://market.yandex.ru/card/samsung-980/102208554664',price:30689,match:'confirmed',delivery:null,checkedAt:'2026-10-30T12:37:40+03:00'},
      {shop:'Ozon',title:'Samsung 980 MZ-V8V1T0BW 1 ТБ',url:'https://www.ozon.ru/product/samsung-980-12345678/',price:27428,match:'source',delivery:null,checkedAt:'2026-10-30T12:36:43+03:00'},
      {shop:'Wildberries',title:'Samsung 980 MZ-V8V2T0BW 2 ТБ',url:'https://www.wildberries.ru/catalog/247318779/detail.aspx',price:2000,match:'unverified',delivery:null}
    ]
  })}));
  await page.locator('#query').fill('https://www.ozon.ru/product/samsung-980-12345678/');
  await page.locator('#product-search button').click();
  await page.waitForFunction(()=>document.querySelectorAll('#offers .result-offer').length===2);
  assert.equal(requestBody.autoCompare,true);
  assert.equal(requestBody.sourceUrl,'https://www.ozon.ru/product/samsung-980-12345678/');
  assert.deepEqual(await page.locator('#offers .offer-seller').allTextContents(),['Ozon','Яндекс Маркет']);
  assert.equal(await page.locator('#best').isVisible(),true);
  assert.match(await page.locator('#best').textContent(),/27.428|27 428|27 428|27 428/);
  assert.equal(await page.locator('#offers .result-offer').count(),2);
  // 3. User can submit a new marketplace link with the same single control.
  await page.locator('#query').fill('https://www.wildberries.ru/catalog/247318779/detail.aspx');
  await page.locator('#product-search button').click();
  await page.waitForFunction(()=>document.querySelectorAll('#offers .result-offer').length===2);
  assert.equal(requestBody.sourceUrl,'https://www.wildberries.ru/catalog/247318779/detail.aspx');
  assert.deepEqual(errors,[]);
  console.log('ONE-STEP BROWSER PASSED: 12 catalog products, WB and Ozon links, automatic search, sorted offers and excluded mismatches');
 }finally{await browser.close()}
})().catch(e=>{console.error('ONE-STEP BROWSER FAILED:',e);process.exitCode=1});
