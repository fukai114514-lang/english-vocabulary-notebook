/* Prepare the existing bilingual index once, when Spotlight first opens. */
(() => {
 'use strict';
 const norm = value => value.toLowerCase().trim();
 const pageSize = 24;
 const kinds = new Map([
  ['词汇辨析','Word Comparisons'], ['多义词','Word Meanings'],
  ['阅读文章','Reading'], ['阅读词汇','Reading'], ['短语','Phrases']
 ]);
 const past = new Map(Object.entries({
  be:'was were been', go:'went gone', run:'ran', take:'took taken', come:'came',
  get:'got gotten', do:'did done', have:'had', make:'made', give:'gave given',
  write:'wrote written', read:'read', eat:'ate eaten', see:'saw seen',
  sleep:'slept', speak:'spoke spoken', think:'thought', find:'found',
  hold:'held', bring:'brought', buy:'bought', teach:'taught', catch:'caught',
  stand:'stood', leave:'left', feel:'felt', meet:'met', keep:'kept',
  choose:'chose chosen', break:'broke broken', drive:'drove driven',
  fall:'fell fallen', rise:'rose risen', fly:'flew flown', grow:'grew grown',
  know:'knew known', throw:'threw thrown', wear:'wore worn', steal:'stole stolen',
  sit:'sat', swim:'swam swum', begin:'began begun', forget:'forgot forgotten',
  put:'put', cut:'cut', set:'set', hit:'hit', let:'let', hurt:'hurt',
  build:'built', send:'sent', spend:'spent', lead:'led', pay:'paid',
  bind:'bound', wind:'wound', spin:'spun', spring:'sprang sprung', leap:'leapt leaped'
 }));
 const plurals = new Map(Object.entries({
  child:'children', person:'people', man:'men', woman:'women', tooth:'teeth',
  foot:'feet', mouse:'mice', goose:'geese', analysis:'analyses', basis:'bases',
  crisis:'crises', criterion:'criteria', phenomenon:'phenomena', sheep:'sheep'
 }));
 const double = new Set('run nap stop hop plan grab grip plug drop skip slip clap wrap rip rub rob nod tap jog drag snap spot step stir admit prefer refer occur begin forget sit swim spin cut put set hit let ban pin fit shut shop chat pat trip trap'.split(' '));
 function forms(word, fields) {
  const pos = fields['词性'] || fields['释义']?.match(/^(?:[a-z]+\.(?:\s*\/\s*)?)+/i)?.[0] || '';
  const result = [];
  const noun = /\bn\./.test(pos);
  const verb = /\bv(?:t|i)?\./.test(pos) || word === 'nap';
  if (verb && word==='be') return new Set(['am','are','is','was','were','been','being']);
  const plural = /[^aeiou]y$/.test(word) ? word.slice(0,-1)+'ies'
   : /(?:s|x|z|ch|sh)$/.test(word) || ['go','do','echo'].includes(word) ? word+'es' : word+'s';
  if (noun) result.push(plurals.get(word) || plural);
  if (verb) {
   const doubled = double.has(word) || /^[^aeiouy]*[aeiou][bdgklmnprstz]$/.test(word);
   const stem = doubled ? word+word.slice(-1) : word;
   const ed = /[^aeiou]y$/.test(word) ? word.slice(0,-1)+'ied' : stem+(word.endsWith('e')?'d':'ed');
   const ing = word.endsWith('ie') ? word.slice(0,-2)+'ying'
    : /[^eoy]e$/.test(word) && !['singe','dye'].includes(word) ? word.slice(0,-1)+'ing' : stem+'ing';
   result.push(...(past.get(word) || ed).split(' '), ing);
   result.push(word==='have'?'has':plural);
  }
  if (word==='good' && /\badj\./.test(pos)) result.push('better','best');
  return new Set(result);
 }
 function fieldScore(field) {
  if (field==='词条') return 3;
  if (['释义','英文释义','词性','用法释义','辨析释义'].includes(field)) return 4;
  if (['原文','正文','译文'].includes(field)) return 6;
  return 5;
 }
 function prepare(records) {
  const lexicon = new Map(), aliases = new Map();
  const rows = records.map(row => {
   const title = norm(row.title), entry = !!row.fields['词条'];
   const category = kinds.get(row.kind);
   const inflections = entry && /^[a-z]+$/.test(title) ? forms(title,row.fields) : new Set();
   if (entry && /^[a-z]+$/.test(title)) {
    if (!lexicon.has(title)) lexicon.set(title,new Set());
    lexicon.get(title).add(category);
    for (const form of inflections) {
     if (!aliases.has(form)) aliases.set(form,new Set());
     aliases.get(form).add(title);
    }
   }
   const fields = Object.entries(row.fields).map(([type,text]) => ({
    type,text,lower:norm(text),score:fieldScore(type)
   })).sort((a,b)=>a.score-b.score);
   return {row,title,entry,category,fields,inflections};
  });
  return {rows,lexicon,aliases};
 }
 function whole(text,term) {
  let start=0, at;
  while ((at=text.indexOf(term,start))!==-1) {
   start=at+term.length;
   if (!/[a-z]/.test(text[at-1]||'') && !/[a-z]/.test(text[start]||'')) return true;
  }
  return false;
 }
 function match(item,key,terms) {
  const {row,title,entry,inflections}=item;
  if (entry && title===key) return {score:0,type:'精确词条',text:row.title,term:key};
  if (inflections.has(key)) return {score:1,type:'词形匹配',text:row.title,term:title};
  if (entry && title.startsWith(key)) return {score:2,type:'词条前缀',text:row.title,term:key};
  if (title.includes(key)) return {score:3,type:'标题',text:row.title,term:key};
  for (const field of item.fields) {
   if (field.lower.includes(key)) return {...field,term:key};
   for (const term of terms) if (whole(field.lower,term)) return {...field,term};
  }
  return null;
 }
 // One insertion, deletion, substitution, or adjacent transposition.
 function near(a,b) {
  if (a.length>b.length) return near(b,a);
  if (b.length-a.length>1) return false;
  let i=0;
  while (i<a.length && a[i]===b[i]) i++;
  if (a.length!==b.length) return a.slice(i)===b.slice(i+1);
  return a.slice(i+1)===b.slice(i+1) ||
   (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
 }
 function searchIndex(index,input,category='All') {
  const key=norm(input), hits=[], suggestions=[];
  if (!key) return {hits,suggestions};
  const terms=['better','best'].includes(key) ? [] : index.aliases.get(key)||[];
  for (const item of index.rows) {
   if (category!=='All' && category!==item.category) continue;
   const hit=match(item,key,terms);
   if (hit) hits.push({row:item.row,hit});
  }
  hits.sort((a,b)=>a.hit.score-b.hit.score);
  const targets=new Set(hits.filter(x=>!x.row.id.startsWith('comparison-body-')).map(x=>x.row.target));
  const seen=new Set();
  const unique=hits.filter(({row})=>{
   if (row.id.startsWith('comparison-body-') && targets.has(row.target)) return false;
   const identity=row.target+'|'+norm(row.title);
   if (seen.has(identity)) return false;
   seen.add(identity);
   return true;
  });
  if (/^[a-z]{4,32}$/.test(key) && !index.lexicon.has(key) && !index.aliases.has(key) && !unique.some(x=>x.hit.score<=2)) {
   for (const [word,categories] of index.lexicon) {
    if (category!=='All' && !categories.has(category)) continue;
    if (key.length===4 && (word.length!==4 || key[0]!==word[0] || key[3]!==word[3])) continue;
    if (near(key,word)) suggestions.push(word);
   }
   suggestions.sort((a,b)=>Number(b[0]===key[0])-Number(a[0]===key[0]) || a.localeCompare(b,'en'));
  }
  return {hits:unique,suggestions:suggestions.slice(0,2)};
 }
 function readerURL(target,articles) {
  if (target==='nap-part') return '';
  const article=articles.find(id=>target.startsWith(id+'-'));
  return article?article+'.html#'+target:'';
 }
 if (typeof module==='object' && module.exports) {
  module.exports={prepare,searchIndex,readerURL,pageSize};
  return;
 }
 const dialog=document.querySelector('#search-dialog'),q=document.querySelector('#search'),groups=document.querySelector('#search-groups'),status=document.querySelector('#search-status');
 const articles=JSON.parse(document.querySelector('#site-meta').textContent).articles;
 function mark(parent,text,term){
  let at=0,next;const lower=text.toLowerCase();
  while((next=lower.indexOf(term,at))!==-1){parent.append(document.createTextNode(text.slice(at,next)));const m=document.createElement('mark');m.textContent=text.slice(next,next+term.length);parent.append(m);at=next+term.length;}
  parent.append(document.createTextNode(text.slice(at)));
 }

 function reveal(target){
  // Release the modal and scroll lock before any navigation. Back can restore
  // this exact document from the browser cache, including its inline styles.
  close();
  const url=readerURL(target,articles);
  if(url){location.href=url;return}
  if(!document.querySelector('#home')){location.href='index.html#'+target;return}
  history.pushState(null,'','#'+target);window.notebook.reveal(target);
 }
 let index, loading, failed=false, opener, lastScroll=0, timer, composing=false;
 let category='All', previousKey, previousCategory, hits=[], shown=0;
 function button(label,onClick) {
  const b=document.createElement('button');
  b.type='button';b.textContent=label;b.onclick=onClick;return b;
 }
 const filters=document.createElement('div');
 filters.className='search-filters';
 filters.setAttribute('role','group');
 filters.setAttribute('aria-label','Search category');
 for (const name of ['All',...new Set(kinds.values())]) {
  const control=button(name,()=>{
   category=name;
   for (const b of filters.children) b.setAttribute('aria-pressed',String(b===control));
   search();
  });
  control.setAttribute('aria-pressed',String(name===category));
  filters.append(control);
 }
 dialog.querySelector('.search-head').after(filters);
 const suggestions=document.createElement('div');
 status.after(suggestions);
 const more=button('Show more',()=>appendPage(true));
 more.hidden=true;groups.after(more);

 function appendPage(moveFocus=false) {
  const fragment=document.createDocumentFragment();
  const end=Math.min(shown+pageSize,hits.length);
  let first;
  for (;shown<end;shown++) {
   const {row,hit}=hits[shown];
   const card=document.createElement('article'),link=document.createElement('a');
   link.href=readerURL(row.target,articles)||'index.html#'+row.target;
   mark(link,row.title,hit.term);
   link.onclick=e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();reveal(row.target);
   };
   const type=document.createElement('small');
   type.textContent=' · '+kinds.get(row.kind)+' · '+window.notebookUILabel(hit.type);
   const context=hit.score<=2?[row.fields['词性'],row.fields['释义'],row.fields['英文释义']].filter(Boolean).join(' · ')||hit.text:hit.text;
   const snippet=document.createElement('p'),start=Math.max(0,context.toLowerCase().indexOf(hit.term)-45);
   mark(snippet,(start?'…':'')+context.slice(start,start+170)+(context.length>start+170?'…':''),hit.term);
   card.append(link,type,snippet);fragment.append(card);
   first ||= link;
  }
  groups.append(fragment);more.hidden=shown>=hits.length;
  if(moveFocus)first?.focus();
 }
 function search() {
  if (!dialog.open || composing) return;
  const key=norm(q.value);
  if (index && key===previousKey && category===previousCategory) return;
  previousKey=index?key:undefined;previousCategory=category;
  groups.replaceChildren();suggestions.replaceChildren();more.hidden=true;
  document.querySelector('#search-results').scrollTop=0;
  if (!key) {status.textContent=window.notebookText.searchHint;return}
  if (!index) {status.textContent=failed?window.notebookText.searchError:window.notebookText.searchLoading;return}
  const result=searchIndex(index,key,category);
  hits=result.hits;shown=0;
  status.textContent=hits.length?hits.length+(hits.length===1?window.notebookText.match:window.notebookText.matches):window.notebookText.searchEmpty;
  for(const word of result.suggestions) suggestions.append(button('Did you mean: '+word+'?',()=>{
   q.value=word;search();q.focus({preventScroll:true});
  }));
  appendPage();
 }
 function load() {
  if(index||loading)return;
  failed=false;
  loading=window.notebook.loadSearchIndex().then(data=>{
   index=prepare(data.records);
  }).catch(()=>{failed=true}).finally(()=>{loading=null;search()});
 }

 function open(button){
  if(dialog.open)return;
  document.dispatchEvent(new Event('notebook:search-open'));
  opener=button||document.activeElement;
  lastScroll=scrollY;
  document.body.style.position='fixed';document.body.style.top=-lastScroll+'px';document.body.style.width='100%';
  document.documentElement.classList.add('search-open');
  dialog.showModal();q.focus({preventScroll:true});load();search();
 }
 function restorePage(){document.documentElement.classList.remove('search-open');if(document.body.style.position!=='fixed')return;document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo({top:lastScroll,behavior:'instant'});opener?.focus({preventScroll:true})}
 function close(){clearTimeout(timer);composing=false;dialog.close();restorePage()}
 // A queued close event must not unlock a subsequently reopened search.
 dialog.addEventListener('close',()=>{if(!dialog.open)restorePage()});dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>open(b));document.querySelector('#search-close').onclick=close;
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
 function schedule(){clearTimeout(timer);if(!composing)timer=setTimeout(search,70)}
 q.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer)});
 q.addEventListener('compositionend',()=>{composing=false;schedule()});
 q.addEventListener('input',e=>{if(!e.isComposing)schedule()});
 dialog.addEventListener('keydown',e=>{if(e.isComposing||composing||e.keyCode===229)return;if(['Enter','ArrowDown','ArrowUp'].includes(e.key)&&document.activeElement===q)search();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}const links=[...groups.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(e.key==='ArrowDown'&&links.length){e.preventDefault();links[(i+1)%links.length].focus()}if(e.key==='ArrowUp'&&links.length){e.preventDefault();if(i<=0)q.focus();else links[i-1].focus()}if(e.key==='Enter'&&document.activeElement===q&&links[0]){e.preventDefault();links[0].click()}});
 document.addEventListener('keydown',e=>{if(!e.isComposing&&!composing&&!e.repeat&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();dialog.open?close():open()}});
 if(!document.querySelector('#reader')){const redirect=()=>{const url=readerURL(location.hash.slice(1),articles);if(url)location.replace(url)};redirect();addEventListener('hashchange',redirect)}
})();
