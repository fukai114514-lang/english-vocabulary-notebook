/* Static reference search: no query HTML interpolation or user-created regex. */
(() => {
 'use strict';
 const q=document.querySelector('#search');
 const results=document.createElement('section');results.id='search-results';results.hidden=true;results.setAttribute('aria-label','全站搜索结果');
 const status=document.createElement('p');status.setAttribute('role','status');results.append(status);
 const groups=document.createElement('div');results.append(groups);document.querySelector('.tools').after(results);
 q.setAttribute('aria-label','全站搜索');q.placeholder='搜索单词、中文、例句或文章';q.setAttribute('aria-controls','search-results');
 let articleDictionary={},dictionaryLoaded=false;
 let records=[],loaded=false,revealing=false,loadFailed=false;
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
 function readerURL(target){
  if(target==='nap-part')return '';
  const article=['vpn-privacy','motherhood','nap'].find(id=>target.startsWith(id+'-'));
  return article ? article+'.html#'+target : '';
 }
 function restoreReading(){const url=readerURL(location.hash.slice(1));if(url)location.replace(url)}
 restoreReading();window.addEventListener('hashchange',restoreReading);
 function reveal(target){
  const url=readerURL(target);if(url){location.href=url;return}

  resetQuery();const el=document.getElementById(target);if(!el)return;
  const part=el.closest('#nap-part')?'nap':el.closest('.poly-entry')?'poly':'original';
  revealing=true;document.querySelector('[data-part="'+part+'"]').click();revealing=false;
  for(let node=el;node;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;}
  if(location.hash!=='#'+target)location.hash=target;
  el.setAttribute('tabindex','-1');el.focus({preventScroll:true});el.scrollIntoView({block:'start'});
 }
 function search(){
  const key=norm(q.value);groups.replaceChildren();results.hidden=!key;
  if(!key)return;
  document.querySelector('#list').hidden=true;document.querySelector('#nap-part').hidden=true;
  if(!loaded){status.textContent=loadFailed?'搜索暂不可用，请刷新重试；也可清空搜索后按 Part 查阅。':'正在加载全站索引…';return;}
  const hits=records.map(row=>({row,hit:match(row,key)})).filter(x=>x.hit).sort((a,b)=>a.hit.score-b.hit.score);
  const specificTargets=new Set(hits.filter(x=>!x.row.id.startsWith('comparison-body-')).map(x=>x.row.target));
  const visibleHits=hits.filter(x=>!x.row.id.startsWith('comparison-body-')||!specificTargets.has(x.row.target));
  status.textContent=visibleHits.length?visibleHits.length+' 条匹配记录':'没有找到匹配内容，请尝试其他关键词。';document.querySelector('#count').textContent='全站搜索 · '+visibleHits.length+' 条匹配记录';
  for(const kind of ['词汇辨析','多义词','阅读文章','阅读词汇','短语']){
   const subset=visibleHits.filter(x=>x.row.kind===kind);if(!subset.length)continue;
   const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=kind+' · '+subset.length;section.append(heading);
   for(const {row,hit} of subset){
    const card=document.createElement('article'),link=document.createElement('a');link.href=readerURL(row.target)||'#'+row.target;mark(link,row.title,hit.term);link.onclick=e=>{e.preventDefault();reveal(row.target)};
    const type=document.createElement('small');type.textContent=' · '+hit.type;
    const snippet=document.createElement('p');const context=hit.score<=1?[row.fields['词性'],row.fields['释义'],row.fields['英文释义']].filter(Boolean).join(' · ')||hit.text:hit.text;let at=context.toLowerCase().indexOf(hit.term);let start=Math.max(0,at-45);mark(snippet,(start?'…':'')+context.slice(start,start+170)+(context.length>start+170?'…':''),hit.term);
    card.append(link,type,snippet);section.append(card);
   }groups.append(section);
  }
 }
 q.addEventListener('input',search);
 q.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const link=groups.querySelector('a');if(link){e.preventDefault();link.focus()}}if(e.key==='Escape')resetQuery()});
 document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>{
  if(q.value)resetQuery();
  if(revealing)return;
  const card=document.querySelector('#lookup-card');if(card?.open)card.close();
  const targets={all:'list',original:'original-heading',poly:'poly-heading',nap:'nap-part'};
  const target=targets[b.dataset.part];if(target&&location.hash!=='#'+target)location.hash=target;
 }));
 window.addEventListener('hashchange',()=>{if(q.value)resetQuery();});
 fetch('./search-index.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{records=data.records;loaded=true;search();}).catch(()=>{loadFailed=true;results.hidden=false;status.textContent='搜索索引加载失败，请刷新；清空搜索后仍可按 Part 查阅。'});
})();
