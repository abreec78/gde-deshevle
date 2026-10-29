'use strict';
// Integration seam only. Not imported by the app; no collection or network activity.
function assign(seed,config){
 if(!config?.enabled)return null;
 if(typeof seed!=='string'||!seed||!Array.isArray(config.variants)||config.variants.length!==3||new Set(config.variants.map(v=>v.id)).size!==3||config.variants.some(v=>!['A','B','C'].includes(v.id)||!Number.isSafeInteger(v.weight)||v.weight<0||v.weight>10000))throw Error('Invalid experiment configuration');
 const total=config.variants.reduce((s,v)=>s+v.weight,0);if(!total)throw Error('No active variants');
 let hash=2166136261;for(const char of config.id+':'+seed){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
 let value=hash%total;for(const v of config.variants){if(value<v.weight)return v.id;value-=v.weight;}
}
module.exports={assign};
