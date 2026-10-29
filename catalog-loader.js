'use strict';
// No credential or feed URL is ever sent to the browser.
window.loadPublicCatalog=async function(){
  const response=await fetch('./data/catalog.json',{cache:'no-store'});
  if(!response.ok)throw Error('Catalogue unavailable');
  const body=await response.text();
  if(body.length>200*1024*1024)throw Error('Catalogue too large');
  const snapshot=JSON.parse(body);
  if(snapshot.format!=='chunks-v1')return snapshot;
  if(!Array.isArray(snapshot.chunks)||snapshot.chunks.length>500)throw Error('Invalid chunk index');
  snapshot.products=[];
  for(const name of snapshot.chunks){
    if(!/^part-[0-9]{4}\.json$/.test(name))throw Error('Invalid chunk name');
    const chunk=await fetch('./data/parts/'+name,{cache:'no-store'});
    if(!chunk.ok)throw Error('Catalogue part unavailable');
    const text=await chunk.text();if(text.length>2*1024*1024)throw Error('Catalogue part too large');
    const products=JSON.parse(text);if(!Array.isArray(products)||products.length>250)throw Error('Invalid part');
    for(const p of products)snapshot.products.push(p);
  }
  if(snapshot.products.length!==snapshot.productCount)throw Error('Incomplete catalogue');
  return snapshot;
};
