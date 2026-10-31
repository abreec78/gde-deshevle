'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 try{
  const root='http://127.0.0.1:8899/';
  await page.goto(root,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#grid .product-card');
  assert.equal(await page.locator('#grid .product-card').count(),12);
  assert.equal(await page.locator('#inline-compare').isVisible(),false);
  const initial=page.url();

  // Short Ozon share link is accepted on the SAME homepage, with a working recovery action.
  await page.locator('#q').fill('https://ozon.ru/t/bTByYAY');
  await page.locator('#search-form button[type=submit]').click();
  await page.locator('#shortlink-help').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).pathname,'/');
  assert.equal(await page.locator('#inline-compare').isVisible(),true);
  assert.equal(await page.locator('#offers-section').isVisible(),false);
  assert.match(await page.locator('#status').textContent(),/Короткая ссылка Ozon принята/);
  assert.equal(await page.locator('#shortlink-open').getAttribute('href'),'https://ozon.ru/t/bTByYAY');
  assert.ok(await page.locator('#shortlink-open').isEnabled());
  assert.equal(await page.locator('.inline-store-row').count(),0);
  assert.equal(await page.locator('#offers .result-offer').count(),0);

  // User pastes a full Ozon URL; search runs inline, no second results page.
  await page.locator('#q').fill('https://www.ozon.ru/product/samsung-980-12345678/');
  await page.locator('#search-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Нет подключения'));
  assert.equal(new URL(page.url()).pathname,'/');
  assert.equal(await page.locator('#shortlink-help').isVisible(),false);
  assert.equal(await page.locator('#product-panel').isVisible(),true);
  assert.equal(await page.locator('#offers .result-offer').count(),0);
  assert.equal(await page.locator('#empty').isVisible(),true);
  assert.equal(await page.locator('.inline-store-row').count(),0);
  assert.equal(await page.locator('#offers .result-offer').count(),0);

  // The in-page search can display real matching offers immediately when an API responds.
  let payload=null;
  await page.route('**/api/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:true})}));
  await page.route('**/api/search',route=>{
    payload=route.request().postDataJSON();
    return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({id:'test-1'})});
  });
  await page.route('**/api/poll*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    done:true,sourceTitle:'Samsung 980 MZ-V8V1T0BW 1 ТБ',
    offers:[
      {shop:'Яндекс Маркет',title:'Samsung 980 MZ-V8V1T0BW',url:'https://market.yandex.ru/card/samsung-980/102208554664',price:30689,match:'confirmed'},
      {shop:'Ozon',title:'Samsung 980 MZ-V8V1T0BW',url:'https://www.ozon.ru/product/samsung-980-12345678/',price:27428,match:'source'},
      {shop:'Wildberries',title:'Other model',url:'https://www.wildberries.ru/catalog/247318779/detail.aspx',price:2000,match:'unverified'}
    ]
  })}));
  await page.locator('#q').fill('https://www.ozon.ru/product/samsung-980-12345678/');
  await page.locator('#search-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#offers .result-offer').length===2);
  assert.equal(new URL(page.url()).pathname,'/');
  assert.equal(payload.autoCompare,true);
  assert.deepEqual(await page.locator('#offers .offer-seller').allTextContents(),['Ozon','Яндекс Маркет']);
  assert.equal(await page.locator('.inline-store-row').count(),0);
  assert.equal(await page.locator('#offers .result-offer').count(),2);
  assert.equal(await page.locator('#best').isVisible(),true);
  await page.screenshot({path:'/tmp/kupiora-inline-screen.png',fullPage:true});

  // Close restores the shop instead of navigating to the legacy second screen.
  await page.locator('#close-inline-search').click();
  assert.equal(await page.locator('#inline-compare').isVisible(),false);
  assert.equal(await page.locator('#grid .product-card').count(),12);
  assert.equal(new URL(page.url()).pathname,'/');
  assert.deepEqual(errors,[]);
  console.log('INLINE HOMEPAGE PASS: 12 products, Ozon /t shortlink, no navigation, fallback, verified sorted merchant offers, close');
 }finally{await browser.close()}
})().catch(error=>{console.error('INLINE HOMEPAGE FAIL:',error);process.exitCode=1});
