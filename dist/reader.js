(() => {
 'use strict';
 const contexts=JSON.parse(document.querySelector('#reading-context').textContent);
 const paragraphs=[...document.querySelectorAll('#nap-text .nap-paragraph,.reading-text .nap-paragraph')];
 const font=document.querySelector('#reader-size');
 const fontKey='vocab.reader.font-size';
 function applyFont(value){
  if(!['17','20','23'].includes(value))value='20';
  font.value=value;
  document.documentElement.style.setProperty('--reader-size',value+'px');
 }
 try{applyFont(localStorage.getItem(fontKey))}catch{}
 font.onchange=()=>{applyFont(font.value);try{localStorage.setItem(fontKey,font.value)}catch{}};
 for(const p of paragraphs){
  const translation=document.getElementById(p.id.replace(/-([A-Z])$/,'-zh-$1'));
  if(!translation)continue;
  const details=document.createElement('details'),summary=document.createElement('summary');
  details.className='para-translation';summary.textContent='Show translation';
  const copy=document.createElement('p');copy.lang='zh-CN';
  copy.textContent=translation.textContent.replace(/^\[[A-Z]\]\s*/,'');
  details.append(summary,copy);p.after(details);
  details.ontoggle=()=>{summary.textContent=details.open?'Hide translation':'Show translation'};
 }

 function addText(parent,tag,value,style){
  if(!value)return;
  const el=document.createElement(tag);el.textContent=value;
  if(style)el.className=style;
  parent.append(el);return el;
 }
 async function fetchJSON(path){
  const response=await fetch(path);if(!response.ok)throw Error(path);
  return response.json();
 }
 Promise.all([fetchJSON('search-index.json'),fetchJSON('article-dictionary.json')])
  .then(([index,dictionary])=>setupLookup(index.records,dictionary))
  .catch(()=>{document.querySelector('#reader-status').textContent='Could not load the dictionary. Please refresh the page.'});

 function setupLookup(records,dictionary){
  const candidates=new Map();
  for(const [word,fields] of Object.entries(dictionary))candidates.set(word,[{kind:'文章词典',fields}]);
  for(const row of records){
   if(!['词汇辨析','多义词','阅读词汇'].includes(row.kind)||!row.fields['英文释义']||!/^[a-z]+$/i.test(row.title))continue;
   const key=row.title.toLowerCase();
   if(!candidates.has(key))candidates.set(key,[]);
   candidates.get(key).push(row);
  }
  const dialog=document.createElement('dialog'),body=document.createElement('div');
  dialog.id='lookup-card';dialog.className='glass';dialog.setAttribute('aria-label','English and Chinese definitions');
  const close=addText(dialog,'button','Close');close.setAttribute('aria-label','Close definitions and return to the article');close.type='button';
  dialog.append(body);document.body.append(dialog);
  let trigger,active=[];
  function position(){
   if(!dialog.open||!trigger)return;
   const r=trigger.getBoundingClientRect(),mobile=innerWidth<=760||(innerWidth<=1000&&innerHeight<=500),vv=window.visualViewport,top=vv?.offsetTop||0,height=vv?.height||innerHeight;
   dialog.style.maxHeight=(mobile?Math.min(height*.4,340):Math.min(height*.5,440))+'px';
   const h=dialog.offsetHeight,w=dialog.offsetWidth;let y=r.bottom+10;
   if(y+h>top+height-16)y=r.top-h-10;
   if(mobile)y=r.top>top+height*.5?top+76:top+height-h-100;
   dialog.style.top=Math.max(top+12,Math.min(y,top+height-h-12))+'px';dialog.style.left=(mobile?12:Math.max(12,Math.min(r.left,innerWidth-w-12)))+'px';
  }
  document.addEventListener('pointerdown',ev=>{if(dialog.open&&!dialog.contains(ev.target)&&!ev.target.closest('.lookup-word'))dismiss(false)});
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true});
  dialog.addEventListener('toggle',position,true);new ResizeObserver(position).observe(body);

  function clearSelection(){
   for(const b of active)b.classList.remove('phrase-active');
   trigger?.removeAttribute('aria-expanded');active=[];
  }
  function dismiss(focus=true){clearSelection();dialog.close();if(focus)trigger?.focus({preventScroll:true})}
  close.onclick=()=>dismiss();window.addEventListener('hashchange',()=>{if(dialog.open)dismiss(false)});window.addEventListener('pagehide',()=>{if('speechSynthesis' in window)speechSynthesis.cancel()});
  dialog.oncancel=e=>{e.preventDefault();dismiss()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open){e.preventDefault();dismiss()}});
  function lookup(button,context,group){
   clearSelection();trigger=button;active=group||[button];
   for(const b of active)b.classList.add('phrase-active');
   button.setAttribute('aria-expanded','true');body.replaceChildren();
   const rows=candidates.get(button.dataset.lookup)||[];
   const primary=(button.closest('#nap-text')&&rows.find(r=>r.kind==='阅读词汇'))||rows.find(r=>r.kind==='文章词典')||rows[0];
   const fields=primary?.fields||{};
   const lemma=fields['词条']||button.textContent;
   addText(body,'h2',context?.[0]||lemma);
   const ipa=fields['音标']||fields['IPA'];if(ipa)addText(body,'p',ipa,'sense-note');
   if('speechSynthesis' in window){const speak=addText(body,'button','▷ Listen','lookup-speech');speak.type='button';const speechStatus=addText(body,'p',' ','lookup-status');speechStatus.setAttribute('role','status');speak.onclick=()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(context?.[0]||lemma);let accent='en-US';try{accent=localStorage.getItem('vocab-accent')||accent}catch{}u.lang=accent;u.rate=.85;u.onend=()=>speechStatus.textContent='Finished reading';u.onerror=()=>speechStatus.textContent='Could not read aloud. Check your device’s voice settings.';speechStatus.textContent='Reading aloud';speechSynthesis.speak(u)}}

   addText(body,'p',context?'In this sentence · '+context[1]:[fields['词性'],primary?.kind==='阅读词汇'?'Meaning in this article':'Common meaning'].filter(Boolean).join(' · '),'sense-note');
   addText(body,'p',context?.[2]||fields['中文意思']||fields['释义']);
   addText(body,'p',context?.[3]||fields['英文释义']);
   const more=document.createElement('details');addText(more,'summary','Explore “'+button.textContent+'”: definitions and collocations');
   for(const row of rows){
    const dl=document.createElement('dl');
    for(const [label,value] of Object.entries(row.fields)){
     if(label==='词条'||!value||(!context&&row===primary&&['释义','中文意思','英文释义','词性'].includes(label)))continue;
     addText(dl,'dt',window.notebookUILabel(label));addText(dl,'dd',value);
    }
    if(dl.childElementCount)more.append(dl);
    if(row.target){
     const link=addText(more,'a','View '+window.notebookUILabel(row.kind));
     link.href=(row.target.startsWith('nap-')?'nap.html':'index.html')+'#'+row.target;
     link.onclick=()=>{const p=trigger.closest('.nap-paragraph');if(p)history.replaceState(null,'','#'+p.id)};
    }
   }
   if(more.childElementCount>1)body.append(more);
   if(!dialog.open)dialog.show();dialog.scrollTop=0;position();
  }
  const headings=document.querySelectorAll('.reading-title,#reader > .part-heading h1');
  for(const p of [...paragraphs,...headings]){
   const entries=contexts[p.id]||[];
   for(const node of [...p.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)){
    const text=node.textContent,fragment=document.createDocumentFragment();
    const spans=[];
    for(const entry of entries){
     const lower=text.toLowerCase(),phrase=entry[0].toLowerCase();
     let at=lower.indexOf(phrase);
     while(at!==-1){
      const end=at+phrase.length;
      if(!/[a-z]/i.test(text[at-1]||'')&&!/[a-z]/i.test(text[end]||''))spans.push({at,end,entry,buttons:[]});
      at=lower.indexOf(phrase,end);
     }
    }
    spans.sort((a,b)=>(b.end-b.at)-(a.end-a.at));
    let start=0;
    for(const match of text.matchAll(/(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[-'’][A-Za-z]+)*/g)){
     fragment.append(document.createTextNode(text.slice(start,match.index)));
     const b=addText(fragment,'button',match[0],'lookup-word');
     b.type='button';b.dataset.lookup=match[0].toLowerCase().replace(/’/g,"'");
     const span=spans.find(s=>match.index>=s.at&&match.index+match[0].length<=s.end);
     if(span)span.buttons.push(b);
     b.setAttribute('aria-label','Look up '+(span?.entry[0]||match[0]));
     b.setAttribute('aria-haspopup','dialog');b.onclick=ev=>{lookup(b,span?.entry,span?.buttons);if(ev.detail===0)close.focus({preventScroll:true})};
     start=match.index+match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(start)));node.replaceWith(fragment);
   }
  }
 }
})();
