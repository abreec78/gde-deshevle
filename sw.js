'use strict';
const PREFIX='gde-deshevle-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+'v2-reference-design';
const SHELL=["./","./index.html","./styles.css","./core.js","./app.js","./manifest.webmanifest","./assets/category-0.webp","./assets/category-1.webp","./assets/category-10.webp","./assets/category-11.webp","./assets/category-2.webp","./assets/category-3.webp","./assets/category-4.webp","./assets/category-5.webp","./assets/category-6.webp","./assets/category-7.webp","./assets/category-8.webp","./assets/category-9.webp","./assets/headphones.webp","./assets/icon-192.png","./assets/icon-512.png","./assets/kettle.webp","./assets/keyboard.webp","./assets/kingston.webp","./assets/laptop.webp","./assets/phone.webp","./assets/robot.webp","./assets/samsung-sata.webp","./assets/ssd-sata.webp","./assets/ssd.webp","./assets/tv.webp","./assets/washer.webp","./assets/wd.webp"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const inShell=SHELL.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  if(request.mode!=='navigate'&&!inShell)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok){const key=request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:request;await cache.put(key,response.clone());}
      return response;
    }catch{
      const cached=await cache.match(request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:request);
      return cached||new Response('Offline asset unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
