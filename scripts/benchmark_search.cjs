// Run from the repository root. The historical matcher is read from Git, never shipped.
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {prepare,searchIndex,pageSize}=require('../content/search.js');
const {records}=require('../dist/search-index.json');
const base='a4a597bc09f4a9e621d1a063e4a7fddb5896f065';
const source=execFileSync('git',['show',base+':content/search.js'],{encoding:'utf8'});
const match=new Function(source.slice(source.indexOf(' const norm='),source.indexOf(' function mark('))+';return match')();
function before(key) {
 const hits=records.map(row=>({row,hit:match(row,key)})).filter(x=>x.hit).sort((a,b)=>a.hit.score-b.hit.score);
 const targets=new Set(hits.filter(x=>!x.row.id.startsWith('comparison-body-')).map(x=>x.row.target));
 return hits.filter(x=>!x.row.id.startsWith('comparison-body-')||!targets.has(x.row.target));
}
const start=performance.now(), index=prepare(records), preparationMs=performance.now()-start;
const after=key=>searchIndex(index,key).hits;
const queries=['a','the','credit','credits','napping','cred','学分','插入','power nap','brutal','freind','xyznotaword'];
const samples={before:[],after:[]};
for(let round=0;round<25;round++) {
 for(const key of queries) {
  for(const version of round%2?['before','after']:['after','before']) {
   const t=performance.now();
   (version==='before'?before:after)(key);
   if(round>=5)samples[version].push(performance.now()-t);
  }
 }
}
function summary(times) {
 const sorted=times.sort((a,b)=>a-b);
 return {p50:sorted[Math.ceil(times.length*.50)-1],p95:sorted[Math.ceil(times.length*.95)-1]};
}
console.log(JSON.stringify({node:process.version,records:records.length,queries,samplesPerVersion:samples.after.length,
 preparationMs,beforeMs:summary(samples.before),afterMs:summary(samples.after),
 firstPageForA:{before:before('a').length,after:Math.min(after('a').length,pageSize)}},null,2));
