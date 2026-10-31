'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const read=name=>readFileSync(join(root,name),'utf8');

test('home page exposes universal search on desktop and mobile',()=>{
 const html=read('index.html');
 assert.match(html,/<form class="search"[^>]*id="search-form"[^>]*action="results\.html"/);
 assert.match(html,/<input id="q" name="q"/);
 assert.match(html,/href="results\.html">Найти товар по ссылке/);
 assert.match(html,/class="universal-mobile-link"/);
});
test('main search preserves query when navigating to universal results',()=>{
 const src=read('app.js');
 assert.match(src,/url\.searchParams\.set\('q',q\)/);
 assert.match(src,/location\.assign\(url\.href\)/);
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
