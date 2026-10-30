"use strict";
const form=document.getElementById('request'),input=document.getElementById('query'),status=document.getElementById('status'),results=document.getElementById('results');
let sequence=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('ru-RU')+' ₽';
function normalizeQuery(raw){
 if(!/^https?:\/\//i.test(raw))return raw.trim();
 const u=new URL(raw);if(u.protocol!=='https:')throw Error('Используйте HTTPS-ссылку.');
 const dl=u.searchParams.get('dl');if(dl)return normalizeQuery(dl);
 const parts=decodeURIComponent(u.pathname).split('/').filter(Boolean);let slug=parts.find(p=>p.length>20&&p.includes('-'))||parts.at(-1)||'';
 return slug.replace(/-\d{5,}$/, '').replace(/[-_]/g,' ').trim();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const turn=++sequence;results.replaceChildren();status.textContent='Ищем предложения…';
 try{
 const raw=input.value.trim(),q=normalizeQuery(raw);if(!q)throw Error('Укажите название модели.');
 const data=await window.loadPublicCatalog();if(turn!==sequence)return;
 const now=Date.now(),tokens=q.toLowerCase().split(/\s+/).filter(Boolean);
 const urlId=/\d{5,}/g;const ids=raw.match(urlId)||[];
 const ranked=data.products.map(p=>{const text=(p.name+' '+(p.mpn||'')).toLowerCase();const score=tokens.filter(t=>text.includes(t)).length;const offers=p.offers.filter(o=>o.available!==false&&Date.parse(o.validUntil)>now&&o.currency==='RUB'&&/^https:\/\//.test(o.url));return {p,score,offers,idMatch:ids.some(id=>p.offers.some(o=>o.id.endsWith(':'+id)))};}).filter(x=>x.offers.length&&(x.idMatch||x.score===tokens.length)).sort((a,b)=>Number(b.idMatch)-Number(a.idMatch)||b.score-a.score);
 status.textContent=ranked.length?'Найдено моделей: '+ranked.length+'. Выберите точную комплектацию.':'В подключённом источнике совпадений нет. Можно продолжить поиск в магазинах ниже.';
 results.innerHTML=ranked.slice(0,30).map(({p,offers})=>'<article>'+(/^https:\/\//.test(p.imageUrl)?'<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy">':'')+'<h2>'+esc(p.name)+'</h2><p>'+esc(p.mpn||'')+'</p><p>'+ (new Set(offers.map(o=>o.shop)).size<2?'Пока один магазин — сравнение недоступно.':'Предложения магазинов')+'</p>'+offers.map(o=>'<p><b>'+esc(o.shop)+' · '+money(o.price)+'</b><br><small>'+esc(o.region)+' · Доставка: '+(o.delivery===null?'уточняется':money(o.delivery))+'<br>Проверено источником: '+new Date(o.sourceUpdatedAt||o.checkedAt).toLocaleString('ru-RU')+'</small></p><a class="link" href="'+esc(o.url)+'" target="_blank" rel="noopener noreferrer sponsored nofollow">Проверить цену в магазине ↗</a>').join('')+'</article>').join('');
 const section=document.createElement('article');const heading=document.createElement('h2');heading.textContent='Продолжить поиск этой модели';section.append(heading);const note=document.createElement('p');note.textContent='Это ссылки на поиск. Цены этих магазинов ещё не получены и не сравнивались.';section.append(note);const links=document.createElement('div');links.className='links';
 for(const [shop,url] of [['Яндекс Маркет','https://market.yandex.ru/search?text='],['Ozon','https://www.ozon.ru/search/?text='],['DNS','https://www.dns-shop.ru/search/?q=']]){const a=document.createElement('a');a.textContent=shop+' ↗';a.href=url+encodeURIComponent(q);a.target='_blank';a.rel='noopener noreferrer';links.append(a);}section.append(links);results.append(section);
 }catch(e){if(turn===sequence)status.textContent='Не удалось получить предложения. '+(e.message.includes('HTTPS')?e.message:'Попробуйте ещё раз или уточните модель.');}
});
