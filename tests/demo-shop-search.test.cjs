'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('demo item has a marketplace search link but no fabricated seller offer link',()=>{
 assert.match(app,/const demoSearch=C\.mode==='demo'\?/);
 assert.match(app,/href="compare-any\.html\?q='\+encodeURIComponent\(name\(p\)\)/);
 assert.match(app,/Найти реальные предложения/);
 assert.match(app,/Демонстрационный магазин без реальной ссылки/);
 assert.match(css,/\.demo-find-link/);
});
test('real offer cards do not include demo product search shortcuts',()=>{
 assert.match(app,/:'';\s*const info=/);
 assert.match(app,/if\(isLive&&C\.safeUrl\(target\)\)/);
});
