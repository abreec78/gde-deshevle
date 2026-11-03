(async()=>{
const feed=document.getElementById('source-feed'),catalog=document.getElementById('source-catalog');
const text=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e};
function link(name,url,parent){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=text('a',name,parent);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer'}catch{}}
try{
const responses=await Promise.all(['feed.json','source-registry.json'].map(x=>fetch(x,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})));
feed.replaceChildren();const [data,registry]=responses;
for(const source of data.sources){const details=document.createElement('details');feed.append(details);text('summary',source.name+' · '+(source.status==='ok'?'Загружено':'Ошибка обновления')+(source.fetchedAt?' · '+new Date(source.fetchedAt).toLocaleString('ru-RU'):''),details);
text('p','Тема: '+source.topic+' · Это подборка первоисточника, без автоматических выводов и прогнозов.',details);
if(source.status!=='ok')text('p','Новые данные недоступны. '+(source.fetchedAt?'Показан предыдущий снимок.':'Успешных загрузок ещё нет.'),details);
if(!source.items.length)text('p','В этой выборке записей нет.',details);
for(const item of source.items){const p=text('p','',details);link(item.title,item.url,p);if(item.date)text('small',' · '+item.date,p)}
link('Первоисточник',source.url,details)}
for(const source of [...registry.feeds,...registry.directories]){const p=text('p','',catalog);link(source.name,source.url,p);if(source.status)text('small',' · '+source.status,p)}
}catch{feed.textContent='Снимок источников недоступен. Попробуйте обновить страницу позже.'}
})();
