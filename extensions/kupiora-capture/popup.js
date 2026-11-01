let product;
(async()=>{try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureProduct});
 product=result.result;
 document.getElementById('status').textContent=product.error||'Проверьте название перед передачей:';
 document.getElementById('title').textContent=product.title||'';
 document.getElementById('send').disabled=Boolean(product.error||!product.title);
}catch{document.getElementById('status').textContent='Не удалось прочитать вкладку. Откройте карточку и нажмите расширение снова.';}})();
document.getElementById('send').onclick=()=>{
 if(!product||product.error)return;
 chrome.tabs.create({url:'https://kupiora-preview.onrender.com/#capture='+encodeURIComponent(JSON.stringify(product))});
};
