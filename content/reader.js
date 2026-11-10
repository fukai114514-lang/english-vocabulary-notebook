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
  details.className='para-translation';summary.textContent=window.notebookText.showTranslation;
  const copy=document.createElement('p');copy.lang='zh-CN';
  copy.textContent=translation.textContent.replace(/^\[[A-Z]\]\s*/,'');
  details.append(summary,copy);p.after(details);
  details.ontoggle=()=>{summary.textContent=details.open?window.notebookText.hideTranslation:window.notebookText.showTranslation};
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
  dialog.id='lookup-card';dialog.className='dictionary-panel';dialog.setAttribute('aria-label',window.notebookText.dictionaryTitle);
  const close=addText(dialog,'button',window.notebookText.close);close.setAttribute('aria-label',window.notebookText.closeDictionary);close.type='button';
  body.className='lookup-body';dialog.append(body);document.body.append(dialog);
  const announcement=document.createElement('span');announcement.className='sr-only';announcement.setAttribute('role','status');document.body.append(announcement);
  let trigger,active=[];
  const help=addText(document.body,'span','Use Left and Right arrows to choose a word in this paragraph, Enter for definitions, and Escape to return.','sr-only');help.id='lookup-help';
  function position(){
   if(!dialog.open||!trigger)return;
   const r=trigger.getBoundingClientRect(),mobile=innerWidth<=760||(innerWidth<=1000&&innerHeight<=500),vv=window.visualViewport,top=vv?.offsetTop||0,height=vv?.height||innerHeight;
   const panelHeight=mobile?Math.min(height*.42,360):Math.min(height*.6,480);
   dialog.style.maxHeight=panelHeight+'px';
   dialog.style.height=mobile?panelHeight+'px':'auto';
   const h=dialog.offsetHeight,w=dialog.offsetWidth;
   let y=mobile?top+height-h-8:r.bottom+10;
   if(!mobile&&y+h>top+height-12)y=r.top-h-10;
   dialog.style.top=Math.max(top+8,Math.min(y,top+height-h-8))+'px';
   const excerpt=body.querySelector('.lookup-source');if(excerpt)excerpt.hidden=!mobile||r.bottom<y;
   dialog.style.left=(mobile?12:Math.max(12,Math.min(r.left,innerWidth-w-12)))+'px';
  }
  document.addEventListener('pointerdown',ev=>{if(dialog.open&&!dialog.contains(ev.target)&&!ev.target.closest('.lookup-word'))dismiss(false)});
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);window.addEventListener('scroll',position,{passive:true});
  dialog.addEventListener('toggle',position,true);new ResizeObserver(position).observe(body);

  function clearSelection(){
   for(const b of active)b.classList.remove('phrase-active');
   trigger?.removeAttribute('aria-expanded');active=[];
  }
  function dismiss(focus=true){const y=scrollY;clearSelection();if('speechSynthesis' in window)speechSynthesis.cancel();dialog.close();document.documentElement.classList.remove('lookup-open');if(focus)trigger?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'})}
  close.onclick=()=>dismiss();window.addEventListener('hashchange',()=>{if(dialog.open)dismiss(false)});window.addEventListener('pagehide',()=>{if('speechSynthesis' in window)speechSynthesis.cancel()});
  dialog.oncancel=e=>{e.preventDefault();dismiss()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open){e.preventDefault();dismiss()}});
  function lookup(button,context,group){
   const readingY=scrollY;
   if('speechSynthesis' in window)speechSynthesis.cancel();
   clearSelection();trigger=button;active=group||[button];
   for(const b of active)b.classList.add('phrase-active');
   button.setAttribute('aria-expanded','true');body.replaceChildren();
   const rows=candidates.get(button.dataset.lookup)||[];
   const primary=(button.closest('#nap-text')&&rows.find(r=>r.kind==='阅读词汇'))||rows.find(r=>r.kind==='文章词典')||rows[0];
   const fields=primary?.fields||{};
   const lemma=fields['词条']||button.textContent;
   const title=addText(body,'h2',context?.[0]||lemma);title.id='lookup-title';dialog.setAttribute('aria-labelledby','lookup-title');
   announcement.textContent='Definitions for '+(context?.[0]||lemma);
   const paragraph=button.closest('.nap-paragraph');
   if(paragraph){
    const range=document.createRange();range.setStart(paragraph,0);range.setEndBefore(button);
    const at=range.toString().length,text=paragraph.textContent,start=Math.max(0,at-55),end=Math.min(text.length,at+button.textContent.length+65);
    const excerpt=addText(body,'blockquote',(start?'…':'')+text.slice(start,end)+(end<text.length?'…':''),'lookup-source');excerpt.hidden=true;excerpt.setAttribute('aria-label','Selected passage');
   }
   const ipa=fields['音标']||fields['IPA'];if(ipa)addText(body,'p',ipa,'sense-note');
   if('speechSynthesis' in window){const speak=addText(body,'button',window.notebookText.listen,'lookup-speech');speak.type='button';const speechStatus=addText(body,'p',' ','lookup-status');speechStatus.setAttribute('role','status');speechStatus.hidden=true;speak.onclick=()=>{speechStatus.hidden=false;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(context?.[0]||lemma);let accent='en-US';try{accent=localStorage.getItem('vocab-accent')||accent}catch{}u.lang=accent;u.rate=.85;u.onend=()=>speechStatus.textContent='Finished reading';u.onerror=()=>speechStatus.textContent='Could not read aloud. Check your device’s voice settings.';speechStatus.textContent='Reading aloud';speechSynthesis.speak(u)}}

   addText(body,'p',context?'In this sentence · '+context[1]:[fields['词性'],primary?.kind==='阅读词汇'?window.notebookText.articleMeaning:window.notebookText.commonMeaning].filter(Boolean).join(' · '),'sense-note');
   addText(body,'p',context?.[2]||fields['中文意思']||fields['释义'],'lookup-meaning');
   addText(body,'p',context?.[3]||fields['英文释义'],'lookup-definition');
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
   if(!dialog.open){dialog.show();button.focus({preventScroll:true})}
   document.documentElement.classList.add('lookup-open');body.scrollTop=0;position();window.scrollTo({top:readingY,behavior:'instant'});
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
     b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','lookup-card');b.setAttribute('aria-describedby','lookup-help');b.onclick=ev=>{lookup(b,span?.entry,span?.buttons);if(ev.detail===0)close.focus({preventScroll:true})};
     start=match.index+match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(start)));node.replaceWith(fragment);
   }
   const words=[...p.querySelectorAll('.lookup-word')];
   words.forEach((word,i)=>{
    word.tabIndex=i===0?0:-1;
    word.addEventListener('focus',()=>words.forEach(w=>w.tabIndex=w===word?0:-1));
    word.addEventListener('keydown',ev=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)||ev.altKey||ev.ctrlKey||ev.metaKey)return;
     ev.preventDefault();const next=ev.key==='Home'?0:ev.key==='End'?words.length-1:Math.max(0,Math.min(words.length-1,i+(ev.key==='ArrowRight'?1:-1)));
     words[next].focus({preventScroll:true});
    });
   });
  }
 }
})();
