/* Static reference search: no query HTML interpolation or user-created regex. */
(() => {
 'use strict';
 const q=document.querySelector('#search');
 const results=document.createElement('section');results.id='search-results';results.hidden=true;results.setAttribute('aria-label','全站搜索结果');
 const status=document.createElement('p');status.setAttribute('role','status');results.append(status);
 const groups=document.createElement('div');results.append(groups);document.querySelector('.tools').after(results);
 q.setAttribute('aria-label','全站搜索');q.placeholder='搜索单词、中文、例句或文章';q.setAttribute('aria-controls','search-results');
 let records=[],loaded=false;
 const norm=s=>String(s).toLowerCase().trim();
 // Explicit limited rules. Irregular spellings are curated; no claim of full lemmatization.
 const irregular={slept:'sleep',sleeping:'sleep',naps:'nap',napping:'nap',napped:'nap',credits:'credit',credited:'credit',crediting:'credit'};
 const variants=key=>{
  const out=[key];if(irregular[key])out.push(irregular[key]);
  if(/^[a-z]+$/.test(key)){
   if(key.endsWith('ies')&&key.length>4)out.push(key.slice(0,-3)+'y');
   if(key.endsWith('s')&&!key.endsWith('ss')&&key.length>3)out.push(key.slice(0,-1));
   if(key.endsWith('ed')&&key.length>4)out.push(key.slice(0,-2),key.slice(0,-1));
   if(key.endsWith('ing')&&key.length>5)out.push(key.slice(0,-3),key.slice(0,-3)+'e');
  }return [...new Set(out)];
 };
 function match(row,key){
  const title=norm(row.title),terms=variants(key);
  for(const t of terms){if(title===t)return {score:0,type:t===key?'精确词条':'词形匹配',text:row.title,term:t};}
  if(title.startsWith(key))return {score:1,type:'词条前缀',text:row.title,term:key};
  const weights={'词条':2,'释义':3,'英文释义':3,'搭配':4,'例句':5,'原文':6,'译文':6,'正文':7};
  for(const field of Object.keys(row.fields).sort((a,b)=>(weights[a]??7)-(weights[b]??7))){
   const text=row.fields[field];
   for(const t of terms){
    const lower=norm(text);const at=lower.indexOf(t);
    if(at>=0){
     // Inflection expansion is only accepted as a whole English word.
     if(t!==key&&((at&&/[a-z]/.test(lower[at-1]))||/[a-z]/.test(lower[at+t.length]||'')))continue;
     return {score:weights[field]??7,type:field,text,term:t};
    }
   }
  }return null;
 }
 function mark(parent,text,term){
  let at=0,next;const lower=text.toLowerCase();
  while((next=lower.indexOf(term,at))!==-1){parent.append(document.createTextNode(text.slice(at,next)));const m=document.createElement('mark');m.textContent=text.slice(next,next+term.length);parent.append(m);at=next+term.length;}
  parent.append(document.createTextNode(text.slice(at)));
 }
 function resetQuery(){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));}
 function reveal(target){
  resetQuery();const el=document.getElementById(target);if(!el)return;
  const part=el.closest('#nap-part')?'nap':el.closest('.poly-entry')?'poly':'original';
  document.querySelector('[data-part="'+part+'"]').click();
  for(let node=el;node;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;}
  if(location.hash!=='#'+target)location.hash=target;
  el.setAttribute('tabindex','-1');el.focus({preventScroll:true});el.scrollIntoView({block:'start'});
 }
 function search(){
  const key=norm(q.value);groups.replaceChildren();results.hidden=!key;
  if(!key)return;
  document.querySelector('#list').hidden=true;document.querySelector('#nap-part').hidden=true;
  if(!loaded){status.textContent='正在加载全站索引…';return;}
  const hits=records.map(row=>({row,hit:match(row,key)})).filter(x=>x.hit).sort((a,b)=>a.hit.score-b.hit.score);
  status.textContent=hits.length?hits.length+' 条匹配记录':'没有找到匹配内容，请尝试其他关键词。';document.querySelector('#count').textContent='全站搜索 · '+hits.length+' 条匹配记录';
  for(const kind of ['词汇辨析','多义词','阅读文章','阅读词汇','短语']){
   const subset=hits.filter(x=>x.row.kind===kind);if(!subset.length)continue;
   const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=kind+' · '+subset.length;section.append(heading);
   for(const {row,hit} of subset){
    const card=document.createElement('article'),link=document.createElement('a');link.href='#'+row.target;mark(link,row.title,hit.term);link.onclick=e=>{e.preventDefault();reveal(row.target)};
    const type=document.createElement('small');type.textContent=' · '+hit.type;
    const snippet=document.createElement('p');let at=hit.text.toLowerCase().indexOf(hit.term);let start=Math.max(0,at-45);mark(snippet,(start?'…':'')+hit.text.slice(start,start+170)+(hit.text.length>start+170?'…':''),hit.term);
    card.append(link,type,snippet);section.append(card);
   }groups.append(section);
  }
 }
 q.addEventListener('input',search);
 q.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const link=groups.querySelector('a');if(link){e.preventDefault();link.focus()}}if(e.key==='Escape')resetQuery()});
 document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',e=>{
  if(q.value){resetQuery();b.click()}
  const card=document.querySelector('#lookup-card');if(card?.open)card.close();
  if(e.isTrusted){const targets={all:'original-heading',original:'original-heading',poly:'poly-heading',nap:'nap-part'};const target=targets[b.dataset.part];if(target&&location.hash!=='#'+target)location.hash=target;}
 }));
 window.addEventListener('hashchange',()=>{if(q.value)resetQuery();});
 fetch('./search-index.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{records=data.records;loaded=true;search();setupLookup()}).catch(()=>{results.hidden=false;status.textContent='搜索索引加载失败，请刷新；仍可按 Part 查阅。'});
 // A non-modal dialog leaves the article scroll position intact and restores trigger focus.
 function setupLookup(){
  const paper=document.querySelector('#nap-text'),dialog=document.createElement('dialog');dialog.id='lookup-card';dialog.setAttribute('aria-label','已收录词汇查阅');
  const close=document.createElement('button');close.textContent='关闭，返回原文';close.type='button';const body=document.createElement('div');dialog.append(close,body);document.body.append(dialog);let trigger;
  function dismiss(){dialog.close();trigger?.focus({preventScroll:true});}close.onclick=dismiss;dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss()});
  const candidates=new Map();for(const row of records){if(['词汇辨析','多义词','阅读词汇'].includes(row.kind)&&/^[a-z]+$/i.test(row.title)){const key=norm(row.title);if(!candidates.has(key))candidates.set(key,[]);candidates.get(key).push(row)}}
  function lookup(button){
   trigger=button;body.replaceChildren();const title=document.createElement('h2');title.textContent=button.textContent;body.append(title);
   const rows=candidates.get(button.dataset.lookup)||[];const exactReading=rows.filter(r=>r.kind==='阅读词汇');const chosen=exactReading.length?exactReading:rows;
   const note=document.createElement('p');note.textContent=exactReading.length?'本文收录释义':'以下为已收录释义；语境义项尚未确认。';body.append(note);
   for(const row of chosen){const p=document.createElement('p');p.textContent=Object.entries(row.fields).filter(([k])=>k!=='词条').map(([k,v])=>k+'：'+v).join(' · ');const link=document.createElement('a');link.href='#'+row.target;link.textContent='查看 '+row.kind;link.onclick=e=>{e.preventDefault();dialog.close();reveal(row.target)};body.append(p,link);}
   for(const row of rows.filter(r=>!chosen.includes(r))){const link=document.createElement('a');link.href='#'+row.target;link.textContent='相关 '+row.kind+' · '+row.title;link.onclick=e=>{e.preventDefault();dialog.close();reveal(row.target)};body.append(link);}
   if(!dialog.open)dialog.show();close.focus({preventScroll:true});
  }
  for(const p of paper.querySelectorAll('.nap-paragraph')){
   const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode()){if(!walker.currentNode.parentElement.closest('strong'))nodes.push(walker.currentNode)}
   for(const node of nodes){const text=node.textContent;const re=/[A-Za-z]+(?:'[A-Za-z]+)?/g;let m,at=0,changed=false;const fragment=document.createDocumentFragment();
    while((m=re.exec(text))){const key=variants(norm(m[0])).find(x=>candidates.has(x));if(!key)continue;fragment.append(document.createTextNode(text.slice(at,m.index)));const b=document.createElement('button');b.className='lookup-word';b.type='button';b.textContent=m[0];b.dataset.lookup=key;b.setAttribute('aria-haspopup','dialog');b.onclick=()=>lookup(b);fragment.append(b);at=m.index+m[0].length;changed=true;}
    if(changed){fragment.append(document.createTextNode(text.slice(at)));node.replaceWith(fragment);}
   }
  }
 }
})();
