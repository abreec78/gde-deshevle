(async()=>{'use strict';
const $=id=>document.getElementById(id),feed=$('source-feed'),catalog=$('source-catalog');
const text=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e};
function safeLink(name,url,parent){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=text('a',name,parent);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a}catch{}}
function date(value){if(!value)return 'Дата публикации не указана';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}
try{
const [data,registry]=await Promise.all(['feed.json','source-registry.json'].map(x=>fetch(x,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})));
for(const source of data.sources){const option=text('option',source.name,$('news-source'));option.value=source.id}
function render(){feed.replaceChildren();const q=$('news-search').value.toLocaleLowerCase('ru').trim(),filter=$('news-source').value;let count=0;
const records=data.sources.flatMap(source=>source.items.map(item=>({source,item}))).sort((a,b)=>(Date.parse(b.item.date)||0)-(Date.parse(a.item.date)||0));
for(const {source,item} of records){if(filter&&filter!==source.id)continue;if(q&&!(`${item.title} ${source.name}`).toLocaleLowerCase('ru').includes(q))continue;
const card=document.createElement('article');card.className='news-card';text('div',source.name,card).className='news-kicker';const h=text('h3','',card);if(!safeLink(item.title,item.url,h))continue;count++;
text('p',date(item.date),card).className='muted';if(source.id==='pubmed')text('p','PubMed может ограничивать доступ (403). Это ограничение внешнего сайта.',card).className='muted';text('p','Снимок загружен: '+new Date(source.fetchedAt).toLocaleString('ru-RU')+(source.status==='error'?' · Обновление не удалось, показана предыдущая загрузка.':''),card).className='muted';safeLink('Открыть публикацию ↗',item.url,card);feed.append(card)}
$('news-count').textContent='Публикаций: '+count;if(!count)text('p','По этому фильтру публикаций нет. Попробуй другой источник или запрос.',feed);
for(const source of data.sources.filter(s=>(!filter||s.id===filter)&&(s.status==='error'||!s.items.length))){text('p',source.name+': '+(source.status==='error'?'обновление недоступно.':'в текущей выборке записей нет.'),feed).className='muted'}}
$('news-search').oninput=render;$('news-source').onchange=render;render();
for(const source of [...registry.feeds,...registry.directories]){const p=text('p','',catalog);safeLink(source.name,source.url,p);if(source.status)text('small',' · '+source.status,p)}
function openCatalog(){if(location.hash==='#source-catalog')catalog.closest('details').open=true}window.addEventListener('hashchange',openCatalog);openCatalog();
}catch{feed.textContent='Не удалось загрузить новости. ';const retry=text('button','Повторить загрузку',feed);retry.onclick=()=>location.reload()}
})();
