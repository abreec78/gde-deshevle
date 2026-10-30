'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const read=name=>readFileSync(join(root,name),'utf8');

test('home page exposes universal search on desktop and mobile',()=>{
 const html=read('index.html');
 assert.match(html,/<form class="search"[^>]*id="search-form"[^>]*action="compare-any\.html"/);
 assert.match(html,/<input id="q" name="q"/);
 assert.match(html,/href="compare-any\.html">Искать во всех магазинах/);
 assert.match(html,/class="universal-mobile-link"/);
});
test('main search preserves query when navigating to universal results',()=>{
 const src=read('app.js');
 assert.match(src,/url\.searchParams\.set\('q',q\)/);
 assert.match(src,/location\.assign\(url\.href\)/);
});
test('comparison page accepts query without requiring an API key',()=>{
 const source=read('compare-any.html');
 assert.match(source,/new URLSearchParams\(location\.search\)\.get\('q'\)/);
 assert.match(source,/if\(incoming&&incoming\.trim\(\)\.length>=2\)/);
 assert.match(source,/if\(apiMode&&isProductLink\(q\)\)try/);
});
test('offline app shell keeps both pages independent',()=>{
 const src=read('sw.js');
 assert.match(src,/\.\/compare-any\.html/);
 assert.match(src,/new URL\(url\.pathname,self\.location\.origin\)\.href/);
 assert.doesNotMatch(src,/request\.mode==='navigate'\?new URL\('\.\/index\.html'/);
});
