(() => {
 'use strict';
 const $=s=>document.querySelector(s),root=document.documentElement;
 const pickers=[...document.querySelectorAll('.theme-picker')];
 pickers.forEach(p=>{p.value=root.dataset.theme||'system';p.addEventListener('change',()=>{root.dataset.theme=p.value;pickers.forEach(o=>o.value=p.value);try{localStorage.setItem('vocab.theme',p.value)}catch{}})});
 const reader=!!$('#reader'),positions=new Map();let current='home';
 const items=[...document.querySelectorAll('#list>details')],keys={home:'home',original:'original-heading',poly:'poly-heading',nap:'nap-part',all:'list'};
 function viewFor(id){if(id==='list')return'all';if(id.startsWith('group-')||id==='original-heading')return'original';if(id.startsWith('sense-')||id.startsWith('poly-'))return'poly';return id==='nap-part'?'nap':'home'}
 function show(view,{restore=true,historyMode='push'}={}){
  if(reader)return;positions.set(current,scrollY);current=view;
  $('#home').hidden=view!=='home';$('#reference').hidden=!['all','original','poly'].includes(view);$('#nap-part').hidden=view!=='nap';
  items.forEach(d=>d.hidden=view==='original'?d.classList.contains('poly-entry'):view==='poly'?!d.classList.contains('poly-entry'):false);
  $('#original-heading').hidden=view==='poly';$('#poly-heading').hidden=view==='original';
  $('#view-title').textContent=view==='poly'?'一词多义':view==='all'?'全部词汇':'词汇辨析';
  $('#count').textContent=items.filter(d=>!d.hidden).length+(view==='poly'?' 个单词 · 常见义与扩展用法':' 组 · 释义、搭配与双语例句');
  document.querySelectorAll('.primary-nav [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(historyMode==='push')history.pushState({view},'','#'+keys[view]);
  if(restore)window.scrollTo({top:positions.get(view)||0,behavior:'instant'});
 }
 function reveal(id){if(reader)return;show(viewFor(id),{restore:false,historyMode:'none'});const target=document.getElementById(id);if(!target)return;for(let n=target;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;if(!Object.values(keys).includes(id)){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}))}}
 window.notebook={show,reveal,viewFor};
 if(!reader){document.addEventListener('click',ev=>{const a=ev.target.closest('[data-view]');if(!a||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;ev.preventDefault();show(a.dataset.view)});$('#expand').onclick=()=>items.filter(d=>!d.hidden).forEach(d=>d.open=true);$('#collapse').onclick=()=>items.forEach(d=>d.open=false);
 const route=()=>{let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}if(id!=='main')reveal(id||'home')};addEventListener('hashchange',route);addEventListener('popstate',()=>{route();window.scrollTo({top:positions.get(current)||0,behavior:'instant'})});route();}
 document.addEventListener('toggle',ev=>{if(ev.target.tagName!=='DETAILS'||!ev.target.open||matchMedia('(prefers-reduced-motion: reduce)').matches)return;ev.target.querySelector(':scope>.body')?.animate([{opacity:.25},{opacity:1}],{duration:160,easing:'ease-out'})},true);
 if(reader)$('#paragraph-jump').onchange=ev=>{if(ev.target.value)location.hash=ev.target.value};
})();
