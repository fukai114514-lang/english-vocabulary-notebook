// Exercise the production matcher with the shipped index and isolated grammar fixtures.
const assert = require('node:assert/strict');
const {prepare,searchIndex,readerURL,pageSize} = require('../content/search.js');
const data = require('../dist/search-index.json');
assert.equal(data.schemaVersion,1);
const index = prepare(data.records);
const search = (q,category) => searchIndex(index,q,category).hits;
for (const q of ['credit','nap','sleep','学分','power nap','brutal']) assert.ok(search(q).length,q);
assert.deepEqual(search(' CREDIT '),search('credit'));
assert.ok(search('credits').some(x=>x.row.title==='credit'&&x.hit.type==='词形匹配'));
assert.ok(search('napping').some(x=>x.row.title==='nap'));
assert.ok(search('cred').some(x=>x.hit.type==='词条前缀'));
for(const q of ['','xyznotaword','[.*+?','<img src=x onerror=alert(1)>']) assert.equal(search(q).length,0,q);
assert.equal(search('credit')[0].hit.score,0);
assert.ok(search('the').length>pageSize*4);
const allIds=new Set(search('e').map(x=>x.row.id));
for(const category of ['Word Comparisons','Word Meanings','Reading','Phrases']) {
 const matches=search('e',category);
 assert.ok(matches.length,category);
 assert.ok(matches.every(x=>allIds.has(x.row.id)));
}
function entry(title,pos,extra={}) {
 return {id:title,target:title,title,kind:'多义词',fields:{'词条':title,'词性':pos},...extra};
}
const fixtures=[entry('run','v.'),entry('running','n.'),entry('runner','n.'),entry('study','v.'),
 entry('go','v.'),entry('good','adj.'),entry('good','n.',{target:'noun-good'}),entry('friend','n.'),
 entry('make','v.'),entry('child','n.'),entry('plan','v.'),entry('story','n.'),entry('bus','n.')];
const testIndex=prepare([...fixtures,fixtures[0]]);
for(const [form,lemma] of Object.entries({running:'run',ran:'run',studies:'study',studied:'study',
 gone:'go',went:'go',better:'good',making:'make',children:'child',planned:'plan',stories:'story',buses:'bus'})){
 const found=searchIndex(testIndex,form).hits.filter(x=>x.hit.type==='词形匹配');
 assert.equal(found.length,1,form);
 assert.equal(found[0].row.title,lemma);
}
for (const bad of ['goed','runned','studyed','makedup','runnning','storying','buss']) {
 assert.ok(!searchIndex(testIndex,bad).hits.some(x=>x.hit.type==='词形匹配'),bad);
}
assert.equal(searchIndex(testIndex,'running').hits[0].row.title,'running');
assert.equal(searchIndex(testIndex,'run').hits.filter(x=>x.row.target==='run').length,1);
assert.deepEqual(searchIndex(testIndex,'freind').suggestions,['friend']);
for(const key of ['friend','frie','xy','go','中文词','中文friend','qqqqqqqq'])
 assert.deepEqual(searchIndex(testIndex,key).suggestions,[],key);
assert.deepEqual(searchIndex(testIndex,'freind','Reading').suggestions,[]);
assert.deepEqual(searchIndex(prepare([]),'freind').suggestions,[]);
const rank=prepare([
 entry('cat','n.'),entry('cats','n.'),entry('catsup','n.'),entry('more cats here','',{fields:{}}),
 ...['释义','搭配','译文'].map(field=>entry(field,'',{fields:{[field]:'cats'}}))
]);
assert.deepEqual(searchIndex(rank,'cats').hits.map(x=>x.hit.score),[0,1,2,3,4,5,6]);
assert.equal(readerURL('nap-part',['nap']),'');
assert.equal(readerURL('nap-A',['nap']),'nap.html#nap-A');
assert.equal(readerURL('motherhood-F',['nap','motherhood']),'motherhood.html#motherhood-F');
assert.equal(readerURL('group-001',['nap']),'');
console.log('PASS index, morphology, spelling, categories, bilingual ranking, deduplication, large queries, routes and literal hostile input');
require('./test_search_dialog.cjs')().catch(error=>{console.error(error);process.exitCode=1});
