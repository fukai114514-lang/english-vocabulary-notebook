// Execute the production pure matcher against the actual generated index.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('content/search.js','utf8');
const pure=source.slice(source.indexOf(' const norm='),source.indexOf(' function mark('));
const context={};vm.createContext(context);vm.runInContext(pure+';this.match=match;',context);
const rows=JSON.parse(fs.readFileSync('dist/search-index.json')).records;
const search=q=>rows.map(row=>({row,hit:context.match(row,q.toLowerCase())})).filter(x=>x.hit).sort((a,b)=>a.hit.score-b.hit.score);
for(const q of ['credit','nap','sleep','学分','power nap','brutal']){
 const hits=search(q);assert(hits.length>0,q);console.log(q,hits.length);
}
assert.equal(search('CREDIT').length,search('credit').length);
assert(search('credits').some(x=>x.row.title==='credit'&&x.hit.type==='词形匹配'));
assert(search('napping').some(x=>x.row.title==='nap'));
assert(search('cred').some(x=>x.hit.type==='词条前缀'));
for(const q of ['xyznotaword','[.*+?','<img src=x onerror=alert(1)>'])assert.equal(search(q).length,0,q);
assert.equal(search('credit')[0].hit.score,0);
console.log('PASS search matcher: required queries, casing, prefix, documented inflections, ranking, nonmatches, special and hostile input');
