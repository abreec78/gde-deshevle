const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const source=readFileSync(join(__dirname,'..','sw.js'),'utf8');

function harness(){
  const handlers={},stores=new Map(),scope='https://example.test/gde-deshevle/';let offline=false,fetchCount=0;
  const key=r=>typeof r==='string'?r:r.url;
  const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {async addAll(files){for(const f of files){assert.ok(f==='./'||existsSync(join(__dirname,'..',f)));map.set(new URL(f,scope).href,new Response('cached:'+f));}},async put(r,v){map.set(key(r),v);},async match(r){return map.get(key(r))?.clone();}};},async keys(){return [...stores.keys()];},async delete(k){return stores.delete(k);}};
  const self={registration:{scope},location:{origin:'https://example.test'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(source,{self,caches,URL,Response,fetch:async request=>{fetchCount++;if(offline)throw Error('offline');return new Response('fresh:'+request.url,{status:200});}});
  return {stores,handlers,setOffline:()=>offline=true,fetches:()=>fetchCount,async install(){let task;handlers.install({waitUntil:p=>task=p});await task;},async activate(){let task;handlers.activate({waitUntil:p=>task=p});await task;},async request(path,{method='GET',mode='cors'}={}){let response;handlers.fetch({request:{url:new URL(path,scope).href,method,mode},respondWith:p=>response=p});return response?await response:null;}};
}
test('PWA precaches every shell asset including local artwork',async()=>{const h=harness();await h.install();const cache=[...h.stores.values()][0];assert.ok(cache.size>=33);assert.ok([...cache.keys()].every(k=>k.startsWith('https://example.test/gde-deshevle/')));});
test('offline navigation and images work under a GitHub Pages subpath',async()=>{const h=harness();await h.install();h.setOffline();assert.equal(await (await h.request('./',{mode:'navigate'})).text(),'cached:./index.html');assert.equal(await (await h.request('assets/ssd.webp')).text(),'cached:./assets/ssd.webp');});
test('fresh HTML is cached, then served on network failure',async()=>{const h=harness();await h.install();await h.request('./',{mode:'navigate'});h.setOffline();assert.equal(await (await h.request('./',{mode:'navigate'})).text(),'fresh:https://example.test/gde-deshevle/');});
test('PWA leaves POST, other origins and non-shell requests alone',async()=>{const h=harness();await h.install();assert.equal(await h.request('./',{method:'POST'}),null);assert.equal(await h.request('https://other.test/file'),null);assert.equal(await h.request('api/private'),null);assert.equal(h.fetches(),0);});
test('cache update preserves other applications on the same origin',async()=>{const h=harness();await h.install();h.stores.set('another-app',new Map());h.stores.set('gde-deshevle-%2Fother%2F-v1',new Map());h.stores.set('gde-deshevle-%2Fgde-deshevle%2F-v1',new Map());await h.activate();assert.ok(h.stores.has('another-app'));assert.ok(h.stores.has('gde-deshevle-%2Fother%2F-v1'));assert.equal(h.stores.has('gde-deshevle-%2Fgde-deshevle%2F-v1'),false);});
