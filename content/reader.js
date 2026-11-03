(() => {
 const norm=s=>s.trim().toLowerCase();
 const variants=key=>[key];
 let records,articleDictionary;
 Promise.all(['search-index.json','article-dictionary.json'].map(async path=>{
  const response=await fetch(path); if(!response.ok)throw Error(path); return response.json();
 })).then(([index,dictionary])=>{records=index.records;articleDictionary=dictionary;setupLookup()})
 .catch(()=>{document.querySelector('#reader-status').textContent='查词数据加载失败，请刷新页面。'});
 // A non-modal dialog leaves the article scroll position intact and restores trigger focus.
 function setupLookup(){
  const paper=document.querySelector('#nap-text'),dialog=document.createElement('dialog');dialog.id='lookup-card';dialog.setAttribute('aria-label','单词中英释义');
  const close=document.createElement('button');close.textContent='关闭，返回原文';close.type='button';const body=document.createElement('div');dialog.append(close,body);document.body.append(dialog);let trigger;
  dialog.addEventListener('close',()=>{if(!dialog.open)trigger?.removeAttribute('aria-expanded')});
  function dismiss(){dialog.close();trigger?.focus({preventScroll:true});}close.onclick=dismiss;dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss()}});dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss()});
  const candidates=new Map();for(const [word,fields] of Object.entries(articleDictionary)){candidates.set(word,[{kind:'文章词典',title:word,fields}])}for(const row of records){if(['词汇辨析','多义词','阅读词汇'].includes(row.kind)&&row.fields['英文释义']&&/^[a-z]+$/i.test(row.title)){const key=norm(row.title);if(!candidates.has(key))candidates.set(key,[]);candidates.get(key).push(row)}}
  function followReference(target){const paragraph=trigger?.closest('.nap-paragraph');if(paragraph)history.replaceState(null,'','#'+paragraph.id);dialog.close();location.href=(target.startsWith('nap-')?'nap.html':'index.html')+'#'+target}
  function lookup(button){
   trigger?.removeAttribute('aria-expanded');trigger=button;trigger.setAttribute('aria-expanded','true');body.replaceChildren();const title=document.createElement('h2');title.textContent=button.textContent;body.append(title);
   const rows=candidates.get(button.dataset.lookup)||[];const exactReading=button.closest('#nap-text')?rows.filter(r=>r.kind==='阅读词汇'):[];const local=rows.filter(r=>r.kind==='文章词典');const chosen=exactReading.length?exactReading:local.length?local:rows;
   const note=document.createElement('p');note.textContent=exactReading.length?'本文收录释义':local.length?'文章词典 · 常用含义':'已收录的常见义项，请结合上下文理解。';body.append(note);
   for(const row of chosen){const p=document.createElement('dl');for(const [key,value] of Object.entries(row.fields)){if(key==='词条'||!value)continue;const label=document.createElement('dt'),text=document.createElement('dd');label.textContent=key==='释义'?'中文意思':key;text.textContent=value;p.append(label,text);}body.append(p);if(row.target){const link=document.createElement('a');link.href='#'+row.target;link.textContent='查看 '+row.kind;link.onclick=e=>{e.preventDefault();followReference(row.target)};body.append(link);}}
   for(const row of rows.filter(r=>r.target&&!chosen.includes(r))){const link=document.createElement('a');link.href='#'+row.target;link.textContent='相关 '+row.kind+' · '+row.title;link.onclick=e=>{e.preventDefault();followReference(row.target)};body.append(link);}
   if(!dialog.open)dialog.show();dialog.scrollTop=0;close.focus({preventScroll:true});
  }
  for(const p of [...document.querySelectorAll('#nap-text .nap-paragraph,.reading-text .nap-paragraph,.reading-title'),document.querySelector('#reader > .part-heading h2')].filter(Boolean)){
   const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode()){if(!walker.currentNode.parentElement.closest('strong,button,a,script,style,select,textarea,input,nav,.tools,footer,#count,#search-results'))nodes.push(walker.currentNode)}
   for(const node of nodes){const text=node.textContent;const re=/(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[-'’][A-Za-z]+)*/g;let m,at=0,changed=false;const fragment=document.createDocumentFragment();
    while((m=re.exec(text))){const token=norm(m[0]).replace(/’/g,"'");const key=variants(token).find(x=>candidates.has(x))||token;fragment.append(document.createTextNode(text.slice(at,m.index)));const b=document.createElement('button');b.className='lookup-word';b.type='button';b.textContent=m[0];b.dataset.lookup=key;b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-label','查看 '+m[0]+' 的中文意思和英文释义');b.onclick=e=>{e.preventDefault();e.stopPropagation();lookup(b)};fragment.append(b);at=m.index+m[0].length;changed=true;}
    if(changed){fragment.append(document.createTextNode(text.slice(at)));node.replaceWith(fragment);}
   }
  }
 }
})();
