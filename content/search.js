/* Shared Spotlight search retains the existing index and matcher. */
(() => {
 'use strict';
 const dialog=document.querySelector('#search-dialog'),q=document.querySelector('#search'),groups=document.querySelector('#search-groups'),status=document.querySelector('#search-status');
 const articles=JSON.parse(document.querySelector('#site-meta').textContent).articles;
 let records=[],loaded=false,loadFailed=false,opener,lastScroll=0,timer;
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
  if(title.includes(key))return {score:2,type:'标题',text:row.title,term:key};
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

 function readerURL(target){if(target==='nap-part')return '';const article=articles.find(id=>target.startsWith(id+'-'));return article?article+'.html#'+target:''}
 function reveal(target){const url=readerURL(target);if(url){location.href=url;return}if(document.querySelector('#reader')){location.href='index.html#'+target;return}close();history.pushState(null,'','#'+target);window.notebook.reveal(target)}
 function search(){
  const key=norm(q.value);groups.replaceChildren();if(!key){status.textContent='Search words, examples, and articles';return}
  if(!loaded){status.textContent=loadFailed?'Could not load search. Close and try again.':'Loading search…';return}
  const hits=records.map(row=>({row,hit:match(row,key)})).filter(x=>x.hit).sort((a,b)=>a.hit.score-b.hit.score);
  const targets=new Set(hits.filter(x=>!x.row.id.startsWith('comparison-body-')).map(x=>x.row.target));
  const visibleHits=hits.filter(x=>!x.row.id.startsWith('comparison-body-')||!targets.has(x.row.target));
  status.textContent=visibleHits.length?visibleHits.length+' matches':'No matches. Try another spelling or a Chinese keyword.';
  for(const kind of ['精确词条','词汇辨析','多义词','阅读文章','阅读词汇','短语']){
   const subset=visibleHits.filter(x=>x.hit.type==='精确词条'?kind==='精确词条':x.row.kind===kind);if(!subset.length)continue;
   const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=window.notebookUILabel(kind)+' · '+subset.length;section.append(heading);
   for(const {row,hit} of subset){
    const card=document.createElement('article'),link=document.createElement('a');link.href=readerURL(row.target)||'index.html#'+row.target;mark(link,row.title,hit.term);link.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();reveal(row.target)};
    const type=document.createElement('small');type.textContent=' · '+window.notebookUILabel(hit.type);
    const snippet=document.createElement('p');const context=hit.score<=1?[row.fields['词性'],row.fields['释义'],row.fields['英文释义']].filter(Boolean).join(' · ')||hit.text:hit.text;const at=context.toLowerCase().indexOf(hit.term),start=Math.max(0,at-45);mark(snippet,(start?'…':'')+context.slice(start,start+170)+(context.length>start+170?'…':''),hit.term);card.append(link,type,snippet);section.append(card);
   }groups.append(section);
  }
 }
 function load(){if(loaded)return;loadFailed=false;fetch('./search-index.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(d=>{records=d.records;loaded=true;search()}).catch(()=>{loadFailed=true;search()})}
 function open(button){if(dialog.open)return;opener=button||document.activeElement;lastScroll=scrollY;document.body.style.position='fixed';document.body.style.top=-lastScroll+'px';document.body.style.width='100%';dialog.showModal();q.focus({preventScroll:true});load();search()}
 function restorePage(){if(document.body.style.position!=='fixed')return;document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo({top:lastScroll,behavior:'instant'});opener?.focus({preventScroll:true})}
 function close(){dialog.close();restorePage()}
 dialog.addEventListener('close',restorePage);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>open(b));document.querySelector('#search-close').onclick=close;
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
 q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,70)});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}const links=[...groups.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(e.key==='ArrowDown'&&links.length){e.preventDefault();links[(i+1)%links.length].focus()}if(e.key==='ArrowUp'&&links.length){e.preventDefault();if(i<=0)q.focus();else links[i-1].focus()}if(e.key==='Enter'&&document.activeElement===q&&links[0]){e.preventDefault();links[0].click()}});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?close():open()}});
 const resize=()=>document.documentElement.style.setProperty('--visual-height',(window.visualViewport?.height||innerHeight)+'px');window.visualViewport?.addEventListener('resize',resize);resize();
 if(!document.querySelector('#reader')){const redirect=()=>{const url=readerURL(location.hash.slice(1));if(url)location.replace(url)};redirect();addEventListener('hashchange',redirect)}
})();
