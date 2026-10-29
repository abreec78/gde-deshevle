'use strict';
(function(){
 const C=window.Catalog,B=window.SmartBasket,el=id=>document.getElementById(id);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rub=v=>v===null?'Требует уточнения':(v/100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
 let storage;try{storage=localStorage;}catch{storage=null;}
 const carts={demo:B.readCart(storage,'demo'),live:B.readCart(storage,'live')};
 const targets={demo:B.readTargets(storage,'demo'),live:B.readTargets(storage,'live')};
 let preferred=null,lastMode=C.mode;
 const dialog=document.createElement('dialog');dialog.id='basket-panel';dialog.setAttribute('aria-labelledby','basket-title');document.body.append(dialog);
 function notify(message){el('storage-status').textContent=message;el('storage-status').hidden=false;setTimeout(()=>el('storage-status').hidden=true,5000);}
 function persist(){preferred=null;if(!B.saveCart(storage,C.mode,carts[C.mode]))notify('Хранилище недоступно. Корзина сохранена только до закрытия страницы.');}
 function getOffers(id){return C.offersFor(id).map(o=>{
   if(C.mode!=='demo')return o;
   // Explicit synthetic policies exist only in demo. No real merchant terms invented.
   const checkedAt=new Date().toISOString(),validUntil=new Date(Date.now()+3600000).toISOString();
   return {...o,region:'Москва · демо',orderPolicy:o.delivery===null?null:{confirmed:true,region:'Москва · демо',checkedAt,validUntil,shipping:o.delivery,minOrder:0,freeShippingThreshold:10000,thresholdBasis:'afterDiscount'}};
 });}
 function planHTML(p,i,result){return '<article class="basket-plan '+(preferred===i?'chosen':'')+'"><h3>'+(!p.confirmed?'Сумма не подтверждена':p===result.best?'Минимум среди подтверждённых вариантов':p.orderCount===1?'Один заказ':'Меньше заказов')+'</h3><p><strong>'+rub(p.total)+'</strong> · Заказов: '+p.orderCount+'</p>'+p.orders.map(o=>'<section><h4>'+esc(o.shop)+'</h4>'+o.items.map(x=>'<p>'+esc(x.product.displayName||x.product.name)+' × '+x.quantity+' — '+rub(B.cents(x.offer.price)*x.quantity)+'</p>').join('')+'<p>Товары: '+rub(o.subtotal)+' · Подтверждённая скидка: '+rub(o.discount)+'<br>Доставка: '+rub(o.shipping)+' · Итого: '+rub(o.total)+'</p>'+(o.total===null?'<small>Условия заказа, минимальная сумма или доставка требуют уточнения.</small>':'')+o.items.map(x=>C.mode==='live'&&C.safeUrl(x.offer.url)?'<p><a href="'+esc(x.offer.url)+'" target="_blank" rel="noopener noreferrer nofollow sponsored">'+esc(o.shop)+' — проверить предложение ↗</a><br><small>Обновлено: '+esc(new Date(x.offer.checkedAt).toLocaleString('ru-RU'))+' · '+esc(x.offer.region)+'</small></p>':'').join('')+'</section>').join('')+'<button class="primary" data-plan="'+i+'" aria-pressed="'+(preferred===i)+'">'+(preferred===i?'Выбран':'Выбрать вариант')+'</button></article>';}
 function renderBasket(){
   const focusedQuantity=dialog.contains(document.activeElement)?document.activeElement.dataset.quantity:null;
   const cart=carts[C.mode];if(lastMode!==C.mode){preferred=null;lastMode=C.mode;}
   document.querySelectorAll('[data-basket-open]').forEach(b=>b.textContent='Умная корзина ('+cart.reduce((s,x)=>s+x.quantity,0)+')');
   if(!dialog.open)return;
   const result=B.optimize(cart,C.products,getOffers,{maxCombinations:20000});
   dialog.innerHTML='<header><h2 id="basket-title">Умная корзина</h2><button data-basket-close aria-label="Закрыть умную корзину">Закрыть</button></header><p>'+(C.mode==='demo'?'<strong>Демонстрационные товары, цены и правила доставки.</strong>':'Реальные предложения. Автоматическое оформление заказов не выполняется.')+'</p><p class="filter-note">MVP: до 12 позиций, количество до 20. Каждая позиция целиком покупается в одном магазине. Сравниваем только точные группы каталога; похожие товары не подставляем.</p>'+cart.map(x=>{const p=C.products.find(p=>p.id===x.id);return '<div class="basket-item"><strong>'+esc(p?.displayName||p?.name||'Товар временно недоступен')+'</strong><label>Количество <input type="number" min="1" max="20" value="'+x.quantity+'" data-quantity="'+x.id+'"></label><button data-remove="'+x.id+'">Убрать</button></div>';}).join('')+'<div role="status">'+(result.status==='empty'?'Добавьте товары из каталога.':result.status==='limit'?'Слишком много комбинаций для точного расчёта. Сократите корзину; результат не выдаётся за оптимальный.':result.status!=='ok'?'Нет доступных предложений на всю корзину. Товары сохранены.':result.unknown?'Есть варианты с неизвестными условиями. Гарантированно самый дешёвый вариант определить нельзя.':'Все показанные итоги подтверждены правилами источников.')+'</div>'+(result.savings!==null?'<p>Экономия относительно лучшего подтверждённого заказа в одном магазине: <strong>'+rub(result.savings)+'</strong>.</p>':'<p>Подтверждённая экономия пока не рассчитана: нужен сопоставимый вариант в одном магазине.</p>')+'<div class="basket-plans">'+result.plans.map((p,i)=>planHTML(p,i,result)).join('')+'</div>';
   if(focusedQuantity)dialog.querySelector('[data-quantity="'+focusedQuantity+'"]')?.focus();
 }
 function adviceHTML(p){
   const offer=C.sortedOffers(p.id)[0],points=offer?p.history?.[offer.id]||[]:[],a=B.priceAdvice(points,offer?.price);
   const saved=targets[C.mode][p.id];
   let graph='';
   if(C.mode==='live'&&a.history.length>=2){const values=a.history.map(x=>x.price),lo=Math.min(...values),hi=Math.max(...values),n=values.length;
     const coords=values.map((v,i)=>(10+i*280/(n-1)).toFixed(1)+','+(100-(v-lo)*80/(hi-lo||1)).toFixed(1)).join(' ');
     graph='<svg class="kupiora-history" viewBox="0 0 300 120" role="img" aria-label="История цены одного предложения без доставки"><polyline points="'+coords+'" fill="none" stroke="#0875ff" stroke-width="3"/></svg><small>'+esc(a.history[0].at.slice(0,10))+' — '+esc(a.history.at(-1).at.slice(0,10))+' · '+esc(offer.shop)+' · без доставки</small>';
   }
   return '<section class="detail-section kupiora-advice"><h3>Стоит покупать сейчас?</h3><p><strong>'+(C.mode==='demo'?'Недостаточно реальных данных для рекомендации':esc(a.label))+'</strong></p><p>'+esc(C.mode==='demo'?'Демографик не подтверждает реальную скидку.':a.reason)+'</p>'+graph+(C.mode==='live'&&a.minimum!==null?'<p>Минимальная цена за доступный период: '+rub(B.cents(a.minimum))+'</p>':'')+(C.mode==='live'&&a.drop?'<p>Цена снизилась относительно предыдущего наблюдения этого предложения.</p>':'')+'<form data-target-form="'+p.id+'"><label>Целевая цена товара без доставки, ₽ <input name="target" type="number" min="0.01" max="100000000" step="0.01" value="'+(saved||'')+'" required></label><button class="primary">Сохранить цель</button><button type="button" data-clear-target="'+p.id+'">Удалить цель</button></form><p class="filter-note">Настройка сохраняется на этом устройстве. Серверные push/email-уведомления не подключены. Проверка цели доступна только при открытом приложении.</p>'+(saved&&C.mode==='live'&&offer&&offer.price<=saved?'<p role="status">Цель достигнута по текущей цене товара. Проверьте доставку и наличие в магазине.</p>':'')+'</section>';
 }
 function enhance(){
   document.querySelectorAll('.product-card[data-product]').forEach(card=>{if(card.querySelector('[data-cart-add]'))return;const b=document.createElement('button');b.className='basket-add';b.dataset.cartAdd=card.dataset.product;b.textContent='В умную корзину';card.append(b);});
   const detail=el('detail');if(!detail.hidden&&!detail.querySelector('.kupiora-advice')){const id=detail.querySelector('[data-favorite]')?.dataset.favorite,p=C.products.find(p=>String(p.id)===id);if(p)detail.insertAdjacentHTML('beforeend',adviceHTML(p));}
   renderBasket();
 }
 document.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-basket-open')){dialog.showModal();renderBasket();return;}
   if(button.hasAttribute('data-basket-close')){dialog.close();return;}
   if(button.dataset.cartAdd){const p=C.products.find(x=>String(x.id)===button.dataset.cartAdd);if(!p)return;const cart=carts[C.mode],item=cart.find(x=>x.id===p.id);if(item&&item.quantity<20)item.quantity++;else if(!item&&cart.length<12)cart.push({id:p.id,quantity:1});else {notify('Лимит: 12 позиций и 20 единиц каждой.');return;}persist();renderBasket();notify('Товар добавлен в умную корзину.');}
   if(button.dataset.remove){carts[C.mode]=carts[C.mode].filter(x=>String(x.id)!==button.dataset.remove);persist();renderBasket();}
   if(button.dataset.plan!==undefined){preferred=Number(button.dataset.plan);renderBasket();}
   if(button.dataset.clearTarget){delete targets[C.mode][button.dataset.clearTarget];if(!B.saveTargets(storage,C.mode,targets[C.mode]))notify('Настройка сохранена только до закрытия страницы.');el('detail').querySelector('.kupiora-advice')?.remove();enhance();}
 });
 dialog.addEventListener('input',e=>{if(!e.target.dataset.quantity)return;const value=Number(e.target.value);if(!Number.isInteger(value)||value<1||value>20)return;carts[C.mode].find(x=>String(x.id)===e.target.dataset.quantity).quantity=value;persist();renderBasket();});
 dialog.addEventListener('change',e=>{if(!e.target.dataset.quantity)return;const value=Number(e.target.value);if(!Number.isInteger(value)||value<1||value>20)notify('Количество: целое число от 1 до 20.');renderBasket();});
 document.addEventListener('submit',e=>{const form=e.target;if(!form.dataset.targetForm)return;e.preventDefault();const value=Number(new FormData(form).get('target'));if(B.cents(value)===null||value<=0)return;targets[C.mode][form.dataset.targetForm]=value;if(!B.saveTargets(storage,C.mode,targets[C.mode]))notify('Настройка сохранена только до закрытия страницы.');else notify('Целевая цена сохранена. Серверные уведомления пока не работают.');el('detail').querySelector('.kupiora-advice')?.remove();enhance();});
 const observer=new MutationObserver(enhance);observer.observe(el('grid'),{childList:true});observer.observe(el('detail'),{childList:true});
 window.addEventListener('storage',e=>{if(e.key?.startsWith('kupiora.')||e.key===null){carts.live=B.readCart(storage,'live');carts.demo=B.readCart(storage,'demo');targets.live=B.readTargets(storage,'live');targets.demo=B.readTargets(storage,'demo');renderBasket();}});
 enhance();
})();
