'use strict';
// No credential or feed URL is ever sent to the browser.
window.loadPublicCatalog=async function(){
  const response=await fetch('./data/catalog.json',{cache:'no-store'});
  if(!response.ok)throw Error('Catalogue unavailable');
  const body=await response.text();
  if(body.length>5*1024*1024)throw Error('Catalogue too large');
  return JSON.parse(body);
};
