'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const read=name=>readFileSync(join(root,name),'utf8');

test('home page exposes universal search on desktop and mobile',()=>{
 const html=read('index.html');
 assert.match(html,/<form class="search"[^>]*id="search-form"[^>]*action="\.\/"/);
 assert.match(html,/<input id="q" name="q"/);
 assert.match(html,/id="inline-compare"/);
 assert.match(html,/class="universal-mobile-link"/);
});
test('home search runs inline with no navigation to second screen',()=>{
 const html=read('index.html'),app=read('app.js'),src=read('results.js');
 assert.match(html,/id="inline-compare"/);
 assert.doesNotMatch(html,/id="shortlink-help"/);
 assert.match(html,/src="results\.js"/);
 assert.doesNotMatch(app,/location\.assign\(url\.href\)/);
 assert.match(src,/searchForm\.addEventListener\('submit'/);
 assert.match(src,/showInline\(source\.kind!=='empty'\)/);
});
test('comparison page accepts query without requiring an API key',()=>{
 const source=read('results.js');
 assert.match(source,/new URLSearchParams\(location\.search\)/);
 assert.match(source,/params\.has\('q'\)/);
 assert.match(source,/autoCompare:true/);
});
test('offline app shell keeps both pages independent',()=>{
 const src=read('sw.js');
 assert.match(src,/\.\/compare-any\.html/);
 assert.match(src,/new URL\(url\.pathname,self\.location\.origin\)\.href/);
 assert.doesNotMatch(src,/request\.mode==='navigate'\?new URL\('\.\/index\.html'/);
});
