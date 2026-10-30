'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const C=require('../core.js');
const read=path=>readFileSync(join(__dirname,'..',path),'utf8');
const allIds=[1,2,3,4,5,6,7,8,9,10,11,12];

test('homepage picks six distinct products from twelve categories and variants',()=>{
  const samples=Array.from({length:30},()=>C.pickFeaturedProducts(allIds,6));
  assert.ok(samples.every(list=>list.length===6&&new Set(list).size===6&&list.every(id=>allIds.includes(id))));
  assert.ok(new Set(samples.map(list=>list.join(','))).size>1,'showcase should vary');
  assert.deepEqual(allIds,[1,2,3,4,5,6,7,8,9,10,11,12],'original catalog is not modified');
});

test('two consecutive openings never repeat the same exact assortment if saved',()=>{
  const first=C.pickFeaturedProducts(allIds,6,()=>0.37);
  const second=C.pickFeaturedProducts(allIds,6,()=>0.37,first);
  assert.notDeepEqual(second,first);
  assert.deepEqual([...second].sort((a,b)=>a-b),[...first].sort((a,b)=>a-b));
});

test('demonstration selection remains stable across re-render, and has manual reshuffle',()=>{
  const app=read('app.js'),html=read('index.html');
  assert.match(app,/let demoHomeOrder=/);
  assert.match(app,/results=demoHomeOrder\.map\(id=>C\.products\.find/);
  assert.match(app,/'reshuffle-home'\)\.onclick/);
  assert.match(html,/id="reshuffle-home"/);
  assert.match(html,/Случайные товары · демо/);
});

test('homepage starts with samples and only uses real prices from fresh source',()=>{
  const app=read('app.js');
  assert.match(app,/C\.useDemo\(\);\s*let storage/);
  assert.match(app,/C\.useLive\(snapshot\)/);
  assert.match(app,/if\(mode==='auto'&&!C\.products\.length\)/);
  assert.match(app,/Источник цен недоступен\. Показаны демонстрационные товары/);
  assert.match(app,/loadMode\(new URLSearchParams\(location\.hash\.slice\(1\)\)\.get\('data'\)==='demo'\?'demo':new URLSearchParams/);
  assert.match(app,/if\(C\.mode==='demo'&&!automaticDemo\)p\.set\('data','demo'\)/);
});

test('true live mode does not silently display invented prices',()=>{
  const app=read('app.js');
  assert.match(app,/if\(mode==='auto'\)C\.useDemo\(\);else C\.useLive\(emptyLive\)/);
  assert.match(app,/Источник цен недоступен\. Демоданные не подставлены/);
});
