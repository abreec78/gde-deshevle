/* Kupiora: exact finite basket optimisation. Money is calculated in kopecks. */
(function(root){
 'use strict';
 const cents=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e8?Math.round(v*100):null;
 const validId=id=>Number.isInteger(id)&&id>0||typeof id==='string'&&/^live:[a-f0-9]{24}$/.test(id);
 function read(storage,key,fallback){try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}}
 function save(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
 function readCart(storage,mode){const v=read(storage,'kupiora.cart.'+mode,[]);return Array.isArray(v)?v.filter(x=>x&&validId(x.id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=20).slice(0,12).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i):[];}
 function saveCart(storage,mode,cart){return save(storage,'kupiora.cart.'+mode,cart);}
 function readTargets(storage,mode){const v=read(storage,'kupiora.targets.'+mode,{});if(!v||typeof v!=='object'||Array.isArray(v))return {};return Object.fromEntries(Object.entries(v).filter(([id,value])=>validId(/^\d+$/.test(id)?Number(id):id)&&cents(value)!==null&&value>0));}
 function saveTargets(storage,mode,targets){return save(storage,'kupiora.targets.'+mode,targets);}
 function fresh(value,now){const t=Date.parse(value?.checkedAt),until=Date.parse(value?.validUntil);return Number.isFinite(t)&&Number.isFinite(until)&&t<=now+300000&&t>=now-86400000&&until>now&&until<=t+86400000;}
 function orderKey(o){return JSON.stringify([o.source||'demo',o.shop,o.region||'demo']);}
 function policyFor(offer,now){const p=offer.orderPolicy;
   if(!p||p.confirmed!==true||p.region!==offer.region||!fresh(p,now)||cents(p.shipping)===null||cents(p.minOrder)===null)return null;
   if(p.freeShippingThreshold!=null&&(cents(p.freeShippingThreshold)===null||!['beforeDiscount','afterDiscount'].includes(p.thresholdBasis)))return null;
   if(p.discount!=null){const d=p.discount;if(d.confirmed!==true||cents(d.minSubtotal)===null||!['fixed','percent'].includes(d.type)||cents(d.value)===null||d.type==='percent'&&d.value>100)return null;}
   return {shipping:p.shipping,minOrder:p.minOrder,freeShippingThreshold:p.freeShippingThreshold??null,thresholdBasis:p.thresholdBasis||null,discount:p.discount?{confirmed:true,type:p.discount.type,value:p.discount.value,minSubtotal:p.discount.minSubtotal}:null};
 }
 function evaluate(lines,now){const orders=new Map();
   for(const line of lines){const key=orderKey(line.offer);if(!orders.has(key))orders.set(key,{key,shop:line.offer.shop,region:line.offer.region,items:[],subtotal:0});const o=orders.get(key);o.items.push(line);o.subtotal+=cents(line.offer.price)*line.quantity;}
   let known=true,total=0;
   for(const o of orders.values()){
     const policies=o.items.map(x=>policyFor(x.offer,now)),p=policies[0];
     // Every offer must carry the same confirmed order policy; never sum per-item shipping.
     const agreed=p&&policies.every(x=>x&&JSON.stringify(x)===JSON.stringify(p));
     o.discount=0;o.shipping=null;o.minimumMet=null;
     if(agreed){
       if(o.subtotal<cents(p.minOrder))return null;
       o.minimumMet=true;
       const d=p.discount;
       if(d&&o.subtotal>=cents(d.minSubtotal))o.discount=Math.min(o.subtotal,d.type==='fixed'?cents(d.value):Math.round(o.subtotal*d.value/100));
       const thresholdBase=p.thresholdBasis==='afterDiscount'?o.subtotal-o.discount:o.subtotal;
       o.shipping=p.freeShippingThreshold!=null&&thresholdBase>=cents(p.freeShippingThreshold)?0:cents(p.shipping);
     }
     o.total=o.shipping===null?null:o.subtotal-o.discount+o.shipping;
     if(o.total===null)known=false;else total+=o.total;
   }
   return {orders:[...orders.values()],orderCount:orders.size,total:known?total:null,confirmed:known};
 }
 function optimize(cart,products,getOffers,{now=Date.now(),maxCombinations=100000}={}){
   if(!cart.length)return {status:'empty',plans:[]};
   if(cart.length>12||cart.some(x=>!x||!validId(x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>20)||new Set(cart.map(x=>x.id)).size!==cart.length)return {status:'invalid',plans:[]};
   const choices=[];let combinations=1;
   for(const item of cart){const product=products.find(x=>x.id===item.id);if(!product)return {status:'unavailable',plans:[]};
     const offers=getOffers(item.id).filter(o=>cents(o.price)!==null&&o.available!==false&&(o.stock==null||Number.isInteger(o.stock)&&o.stock>=item.quantity));
     if(!offers.length)return {status:'unavailable',plans:[]};
     combinations*=offers.length;if(combinations>maxCombinations)return {status:'limit',plans:[],combinations};
     choices.push(offers.map(offer=>({product,offer,quantity:item.quantity})));
   }
   if(new Set(choices.flat().map(x=>x.offer.region)).size>1)return {status:'mixed-regions',plans:[]};
   const grouped=new Map();let unknown=0;
   function visit(i,lines){if(i<choices.length){for(const line of choices[i])visit(i+1,[...lines,line]);return;}
     const plan=evaluate(lines,now);if(!plan)return;if(plan.total===null)unknown++;
     const key=plan.orders.map(o=>o.key).sort().join('|');const old=grouped.get(key);
     const subtotal=p=>p.orders.reduce((s,o)=>s+o.subtotal,0);
     if(!old||(plan.total??Infinity)<(old.total??Infinity)||plan.total===null&&old.total===null&&subtotal(plan)<subtotal(old))grouped.set(key,plan);
   }
   visit(0,[]);
   const all=[...grouped.values()],confirmed=all.filter(p=>p.confirmed).sort((a,b)=>a.total-b.total||a.orderCount-b.orderCount);
   const best=confirmed[0]||null;
   const alternative=best?confirmed.filter(p=>p.orderCount<best.orderCount).sort((a,b)=>a.orderCount-b.orderCount||a.total-b.total)[0]||null:null;
   const single=confirmed.filter(p=>p.orderCount===1).sort((a,b)=>a.total-b.total)[0]||null;
   const savings=best&&single?Math.max(0,single.total-best.total):null;
   // Unknown plans may be cheaper. The winner is only cheapest among confirmed totals.
   const plans=[best,alternative,single,...all.filter(p=>!p.confirmed).sort((a,b)=>a.orderCount-b.orderCount).slice(0,3)].filter((p,i,a)=>p&&a.indexOf(p)===i);
   return {status:all.length?'ok':'unavailable',plans,best,alternative,single,savings,unknown,combinations,globalMinimumConfirmed:!!best&&!unknown};
 }
 function priceAdvice(points,current,now=Date.now()){
   const history=Array.isArray(points)?points.filter(p=>p&&cents(p.price)!==null&&Number.isFinite(Date.parse(p.at))&&Date.parse(p.at)<=now).slice().sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)):[];
   const days=new Set(history.map(p=>p.at.slice(0,10)));
   if(cents(current)===null||history.length<3||days.size<3)return {label:'Недостаточно данных для рекомендации',reason:'Нужно минимум три наблюдения в разные дни одного предложения и региона.',minimum:history.length?Math.min(...history.map(p=>p.price)):null,history};
   const prices=history.map(p=>p.price),minimum=Math.min(...prices),sorted=prices.slice().sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
   const drop=history.length>1&&current<history[history.length-2].price;
   if(current<=minimum*1.03)return {label:'Цена близка к минимуму за период',reason:'Текущая цена не более чем на 3% выше минимума доступной истории. Это сравнение наблюдений, не прогноз.',minimum,drop,history};
   if(current>median*1.1)return {label:'Цена выше обычной',reason:'Текущая цена более чем на 10% выше медианы доступных наблюдений. Будущее снижение не гарантируется.',minimum,drop,history};
   return {label:'Цена в обычном диапазоне',reason:'Цена не близка к минимуму и не превышает медиану наблюдений более чем на 10%.',minimum,drop,history};
 }
 const api={cents,readCart,saveCart,readTargets,saveTargets,optimize,priceAdvice,policyFor};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SmartBasket=api;
})(typeof globalThis!=='undefined'?globalThis:this);
