(() => {
 'use strict';
 const $=s=>document.querySelector(s),root=document.documentElement;
 const pickers=[...document.querySelectorAll('.theme-picker')];
 pickers.forEach(p=>{p.value=root.dataset.theme||'system';p.addEventListener('change',()=>{root.dataset.theme=p.value;pickers.forEach(o=>o.value=p.value);try{localStorage.setItem('vocab.theme',p.value)}catch{}})});
 const reader=!!$('#reader'),positions=new Map();let current='home';
 const items=[...document.querySelectorAll('#list>details')],keys={home:'home',original:'original-heading',poly:'poly-heading',nap:'nap-part',phrases:'phrases-heading',all:'list'};
 function viewFor(id){if(id==='list')return'all';if(id.startsWith('phrase-')||id==='phrases-heading')return'phrases';if(id.startsWith('group-')||id==='original-heading')return'original';if(id.startsWith('sense-')||id.startsWith('poly-'))return'poly';return id==='nap-part'?'nap':'home'}
 function show(view,{restore=true,historyMode='push'}={}){
  if(reader)return;
  if(view===current&&historyMode==='push')return;
  positions.set(current,scrollY);current=view;
  $('#home').hidden=view!=='home';$('#reference').hidden=!['all','original','poly','phrases'].includes(view);$('#nap-part').hidden=view!=='nap';
  items.forEach(d=>d.hidden=view==='original'?d.classList.contains('poly-entry')||d.classList.contains('phrase-entry'):view==='poly'?!d.classList.contains('poly-entry'):view==='phrases'?!d.classList.contains('phrase-entry'):false);
  $('#original-heading').hidden=['poly','phrases'].includes(view);$('#poly-heading').hidden=['original','phrases'].includes(view);$('#phrases-heading').hidden=['original','poly'].includes(view);
  $('#view-title').textContent=view==='phrases'?'Phrases':view==='poly'?'Word Meanings':view==='all'?'All vocabulary':'Word Comparisons';
  $('#count').textContent=items.filter(d=>!d.hidden).length+(view==='phrases'?(items.filter(d=>!d.hidden).length===1?' phrase':' phrases')+' · meaning, usage, and bilingual examples':view==='poly'?' words · common meanings and extended uses':' comparisons · meanings, collocations, and bilingual examples');
  document.querySelectorAll('.primary-nav [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(historyMode==='push')history.pushState({view},'','#'+keys[view]);
  if(restore)window.scrollTo({top:positions.get(view)||0,behavior:'instant'});
 }
 function reveal(id){if(reader)return;show(viewFor(id),{restore:false,historyMode:'none'});const target=document.getElementById(id);if(!target)return;for(let n=target;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;if(!Object.values(keys).includes(id)){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}))}}
 window.notebook={show,reveal,viewFor};
 if(!reader){document.addEventListener('click',ev=>{const a=ev.target.closest('[data-view]');if(!a||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;ev.preventDefault();show(a.dataset.view)});$('#expand').onclick=()=>items.filter(d=>!d.hidden).forEach(d=>d.open=true);$('#collapse').onclick=()=>items.forEach(d=>d.open=false);
 const route=()=>{let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}if(id==='main')return;if(!id||Object.values(keys).includes(id)){show(viewFor(id||'home'),{restore:true,historyMode:'none'})}else reveal(id)};
 // pushState navigation does not emit hashchange; native Back/Forward does.
 // One handler avoids saving the destination position twice.
 history.scrollRestoration='manual';addEventListener('hashchange',route);route();}
 document.addEventListener('toggle',ev=>{if(ev.target.tagName!=='DETAILS'||!ev.target.open||matchMedia('(prefers-reduced-motion: reduce)').matches)return;ev.target.querySelector(':scope>.body')?.animate([{opacity:.25},{opacity:1}],{duration:160,easing:'ease-out'})},true);

 // Keep destinations separate from actions, while retaining every existing route.
 document.querySelectorAll('.primary-nav a').forEach(a=>a.setAttribute('aria-label',a.textContent.trim()));
 const searchAction=document.querySelector('.primary-nav [data-search]');
 if(searchAction){
  searchAction.classList.add('sidebar-search');
  document.querySelector('.primary-nav').after(searchAction);
  const mobile=searchAction.cloneNode(true);
  mobile.className='mobile-search';mobile.setAttribute('aria-label','Search library');
  mobile.querySelector('kbd')?.remove();document.body.append(mobile);
 }
 // Reuse table cells verbatim. Only presentation labels and a view control are added.
 for(const scroller of document.querySelectorAll('.table-scroll')){
  const table=scroller.querySelector('table');if(!table)continue;
  const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent);
  table.setAttribute('role','table');
  table.querySelectorAll('thead,tbody').forEach(n=>n.setAttribute('role','rowgroup'));
  table.querySelectorAll('tr').forEach(n=>n.setAttribute('role','row'));
  table.querySelectorAll('thead th').forEach(n=>n.setAttribute('role','columnheader'));
  table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,i)=>{
   cell.setAttribute('role',i?'cell':'rowheader');if(i)cell.dataset.label=labels[i];
  }));
  const toggle=document.createElement('button');toggle.type='button';toggle.className='comparison-view';
  toggle.textContent=window.notebookText.comparisonFull;toggle.setAttribute('aria-pressed','false');
  toggle.onclick=()=>{
   const top=toggle.getBoundingClientRect().top;
   const full=scroller.classList.toggle('full-comparison');
   toggle.textContent=full?window.notebookText.comparisonCards:window.notebookText.comparisonFull;toggle.setAttribute('aria-pressed',String(full));
   window.scrollBy({top:toggle.getBoundingClientRect().top-top,behavior:'instant'});
  };
  scroller.classList.add('comparison-ready');
  scroller.before(toggle);
 }
 // Native details already keep their summary in place. Do not scroll or focus on toggle.
 // Measure real chrome rather than guessing Safari's changing toolbar height.
 const topbar=document.querySelector('.topbar');
 const updateInsets=()=>{
  root.style.setProperty('--topbar-height',topbar.getBoundingClientRect().height+'px');
  const vv=window.visualViewport;
  root.style.setProperty('--visual-top',(vv?.offsetTop||0)+'px');
  root.style.setProperty('--visual-height',(vv?.height||innerHeight)+'px');
  root.classList.toggle('keyboard-open',!!vv&&innerHeight-vv.height>140&&/INPUT|TEXTAREA/.test(document.activeElement?.tagName||''));
 };
 new ResizeObserver(updateInsets).observe(topbar);
 window.visualViewport?.addEventListener('resize',updateInsets);
 window.visualViewport?.addEventListener('scroll',updateInsets);
 window.addEventListener('resize',updateInsets);
 document.addEventListener('focusin',updateInsets);document.addEventListener('focusout',()=>requestAnimationFrame(updateInsets));updateInsets();

 if(reader)$('#paragraph-jump').onchange=ev=>{if(ev.target.value)location.hash=ev.target.value};
})();
