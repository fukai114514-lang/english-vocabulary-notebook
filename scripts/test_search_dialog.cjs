// Minimal DOM for exercising the shipped dialog handlers with deterministic input and fetch timing.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const data=require('../dist/search-index.json');
const labels=require('../content/ui-labels.json').text;
const source=fs.readFileSync(require.resolve('../dist/search.js'),'utf8');
async function run(reader=false) {
 let active, top=123, requests=0, grant, timer, revealed;
 class Element extends EventTarget {
  constructor(tag) {super();this.tag=tag;this.children=[];this.value='';this.style={setProperty(){}};this.classList={add(){},remove(){}}}
  append(...nodes) {for(const n of nodes)this.children.push(...(n.tag==='fragment'?n.children:[n]))}
  replaceChildren(){this.children=[]}
  after(n){this.next=n}
  setAttribute(k,v){this[k]=v}
  focus(){active=this}
  showModal(){this.open=true}
  close(){this.open=false}
  click(){this.onclick({preventDefault(){}})}
  querySelector(k){return elements[k]}
  querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)])}
 }
 const elements=Object.fromEntries(['#search-dialog','#search','#search-groups','#search-status','#site-meta','#search-close','.search-head','#search-results'].map(k=>[k,new Element(k)]));
 if(reader)elements['#reader']=new Element('reader');
 elements['#site-meta'].textContent=JSON.stringify({articles:['nap']});
 const launch=new Element('button'), doc=new Element('document');
 Object.defineProperty(doc,'activeElement',{get:()=>active});
 Object.assign(doc,{body:new Element('body'),documentElement:new Element('html'),
  querySelectorAll:()=>[launch],createElement:t=>new Element(t),createTextNode:t=>Object.assign(new Element('text'),{textContent:t}),createDocumentFragment:()=>new Element('fragment')});
 const location={hash:'',href:''},history={pushState(_state,_title,hash){location.hash=hash}};
 const sandbox={Event,document:doc,location,history,innerHeight:800,scrollY:top,addEventListener(){},
  fetch(){requests++;return new Promise(resolve=>{grant=()=>resolve({ok:true,json:async()=>data})})},
  setTimeout(fn){timer=fn;return 1},clearTimeout(){timer=null},
  window:{notebookText:labels,notebookUILabel:x=>x,scrollTo:o=>{top=o.top},notebook:{reveal:id=>{revealed=id},loadSearchIndex:()=>sandbox.fetch().then(r=>r.json())}}};
 vm.runInNewContext(source,sandbox);
 const dialog=elements['#search-dialog'],q=elements['#search'],groups=elements['#search-groups'];
 function key(target,name,props={}) {
  target.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:name,...props}));
 }
 function input(value){q.value=value;q.dispatchEvent(new Event('input'))}
 function flush(){const fn=timer;timer=null;fn?.()}
 key(doc,'k',{ctrlKey:true});
 assert.ok(dialog.open);
 key(dialog,'Escape');
 launch.click();
 dialog.dispatchEvent(new Event('close')); // queued event from the previous opening
 assert.equal(doc.body.style.position,'fixed');
 assert.equal(requests,1);
 input('cr');input('cred');input('credit');
 grant();await new Promise(resolve=>setImmediate(resolve));flush();
 const links=()=>groups.querySelectorAll('a');
 assert.match(links()[0].href,/index.html#sense-credit/);
 assert.ok(groups.querySelectorAll('mark').length);
 const first=links()[0];
 input(' credit ');flush();assert.equal(links()[0],first);
 key(dialog,'ArrowDown');assert.equal(active,first);
 key(dialog,'ArrowUp');assert.equal(active,q);
 q.dispatchEvent(new Event('compositionstart'));input('学');flush();
 assert.equal(links()[0],first);key(dialog,'Enter',{isComposing:true});assert.ok(dialog.open);
 q.value='学分';q.dispatchEvent(new Event('compositionend'));flush();
 assert.ok(links().length);assert.notEqual(links()[0],first);
 input('a');flush();
 assert.equal(links().length,24);
 const original=links()[0];
 groups.next.click();
 assert.equal(links().length,48);assert.equal(links()[0],original);
 const filters=elements['.search-head'].next;
 filters.children.find(n=>n.textContent==='Reading').click();
 assert.equal(q.value,'a');assert.ok(links().every(n=>!n.href.startsWith('index.html')));
 const expected=require('../content/search.js').searchIndex(require('../content/search.js').prepare(data.records),'a','Reading').hits.length;
 assert.equal(elements['#search-status'].textContent,expected+' matches');
 filters.children[0].click();
 input('nothingzz');flush();assert.equal(links().length,0);
 input('creidt');flush();
 assert.equal(q.value,'creidt');assert.ok(dialog.open);assert.equal(location.href,'');
 const suggestion=elements['#search-status'].next.children.find(n=>n.textContent.includes('credit?'));
 assert.ok(suggestion);suggestion.click();assert.equal(q.value,'credit');
 input(reader?'credit':'Take Naps');q.focus();key(dialog,'Enter');
 assert.equal(dialog.open,false);assert.equal(doc.body.style.position,'');assert.equal(active,launch);assert.equal(top,123);
 assert.match(location.href,reader?/^index.html#sense-credit/:/^nap.html#nap-/);
 if(!reader){
  launch.click();input('credit');key(dialog,'Enter');
  assert.equal(location.hash,'#'+revealed);
 }
}
module.exports=async()=>{await run();await run(true);console.log('PASS production dialog handlers: fetch coalescing, fast input, IME, filters, pagination, explicit suggestions, keyboard, routes, scroll and focus restoration')};
