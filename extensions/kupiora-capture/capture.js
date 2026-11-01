function captureProduct(){
 const host=location.hostname;
 if(!['ozon.ru','www.ozon.ru','wildberries.ru','www.wildberries.ru','market.yandex.ru','citilink.ru','www.citilink.ru'].includes(host))return {error:'Откройте карточку Ozon, Wildberries, Маркета или Ситилинка.'};
 if(!(/\/product\/|\/catalog\/\d+\/|\/card\/|\/product--/.test(location.pathname)))return {error:'Нужна карточка товара, а не поиск или короткая ссылка. Дождитесь открытия полного адреса.'};
 const items=[];
 function walk(x){if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object'){if(x['@type']==='Product'||Array.isArray(x['@type'])&&x['@type'].includes('Product'))items.push(x);if(x['@graph'])walk(x['@graph']);}}
 for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{walk(JSON.parse(s.textContent));}catch{}}
 const unique=new Map(items.map(x=>[String(x.name)+'|'+String(x.mpn||'')+'|'+String(x.gtin13||''),x]));
 if(unique.size>1)return {error:'На странице несколько товаров или модификаций. Не удалось выбрать однозначно.'};
 const x=[...unique.values()][0];
 const title=String(x?.name||document.querySelector('h1')?.innerText||'').trim();
 if(!title||/captcha|доступ ограничен|проверка безопасности|подтвердите/i.test(title))return {error:'Название товара недоступно. Откройте карточку обычным способом.'};
 let image=x?.image;if(Array.isArray(image))image=image[0];if(image&&typeof image==='object')image=image.url;
 image=image||document.querySelector('meta[property="og:image"]')?.content;
 return {title:title.slice(0,300),url:location.origin+location.pathname,image:typeof image==='string'&&image.startsWith('https://')?image.slice(0,2000):'',mpn:String(x?.mpn||'').slice(0,100),source:'user-browser',evidence:x?'Product metadata':'Visible page heading'};
}
