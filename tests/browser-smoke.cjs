'use strict';
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1365,height:900},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('dialog',d=>d.accept());
 const origin='http://127.0.0.1:8899/';
 try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('#demo-mode').click();
  await page.locator('.product-card').first().waitFor({state:'visible'});
  await page.locator('#favorites').click();
  await page.locator('#favorites').click();
  await page.locator('#reshuffle-home').click();
  assert.ok(await page.locator('.product-card').count()>0,'homepage demo remains populated');
  await page.goto(origin+'compare-any.html?sample=1',{waitUntil:'domcontentloaded'});
  await page.locator('#product-preview').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#preview-title').textContent.includes('Samsung 980'));
  assert.match(await page.locator('#preview-state').textContent(),/отчёт/i);
  assert.equal(await page.locator('#comparison-panel').isVisible(),false);
  await page.locator('#compare-now').click();
  await page.locator('#comparison-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#cards .compare-card').count(),2);
  const prices=(await page.locator('#cards .compare-price').allTextContents()).map(v=>Number(v.replace(/[^\d]/g,'')));
  assert.deepEqual(prices,[27428,30689]);
  assert.match(await page.locator('#best').textContent(),/27\s*428|27\s*428/);
  assert.equal(await page.locator('#sample-warning').isVisible(),true);
  await page.locator('#clear').click();
  assert.equal(await page.locator('#product-preview').isVisible(),false);
  await page.locator('#query').fill('https://www.wildberries.ru/catalog/247318779/detail.aspx');
  await page.locator('#search button').click();
  await page.locator('#product-preview').waitFor({state:'visible'});
  assert.match(await page.locator('#preview-title').textContent(),/247318779/);
  assert.equal(await page.locator('#compare-now').isEnabled(),true);
  await page.locator('#compare-now').click();
  await page.locator('#source-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#stores a').count(),18);
  assert.match(await page.locator('#message').textContent(),/не подключён/);
  assert.equal(await page.locator('#best').isVisible(),false);
  // The same-link flow also accepts an Ozon card and never invents a price.
  await page.locator('#query').fill('https://www.ozon.ru/product/samsung-test-12345678/');
  await page.locator('#search button').click();
  await page.locator('#product-preview').waitFor({state:'visible'});
  await page.locator('#compare-now').click();
  assert.equal(await page.locator('#stores a').count(),18);
  assert.deepEqual(errors,[],'unexpected JavaScript page errors');
  console.log('BROWSER SMOKE PASSED: home favorites, shuffle, dated source comparison, reset, WB/Ozon links, 18 shops and zero fabricated prices');
 }finally{
  await page.screenshot({path:'/tmp/kupiora-browser-last.png',fullPage:true}).catch(()=>{});
  await browser.close();
 }
})().catch(e=>{console.error('BROWSER SMOKE FAILED',e);process.exitCode=1});
