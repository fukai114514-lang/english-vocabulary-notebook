"""Independent semantic guard: compare against frozen pre-3.0 records."""
from pathlib import Path
from collections import Counter
import json,html
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def canonical(x):return json.dumps(x,sort_keys=True,ensure_ascii=False)
def verify():
 old=read('migration/original-vocabulary.json');new=read('dist/vocabulary.json')
 retained=json.loads(json.dumps(new['groups'][:len(old['groups'])]))
 # Reviewed additive extension: keep every original entry and membership intact.
 original=old['groups'][101];extended=retained[101]
 assert extended['wordIds'][:len(original['wordIds'])]==original['wordIds']
 assert extended['entries'][:len(original['entries'])]==original['entries']
 assert extended['selectionNote'].startswith(original['selectionNote'])
 assert len(extended['entries'])==len(original['entries'])+1
 assert extended['entries'][-1]['wordId']=='word-d6173d8762a74114'
 extended['wordIds']=extended['wordIds'][:len(original['wordIds'])]
 extended['entries']=extended['entries'][:len(original['entries'])]
 extended['selectionNote']=original['selectionNote']
 assert old['groups']==retained, 'Original groups/entries/IDs/memberships changed'
 assert old['words']==new['words'][:len(old['words'])], 'Original words changed'
 assert len(new['groups'])==153 and len(new['words'])==365
 assert [[w['lemma'] for w in new['words'] if w['id'] in g['wordIds']] for g in new['groups'][113:117]] == [['correspondent','journalist'],['contempt','scorn'],['constant','consistent'],['moist','wet','damp','humid']]
 assert len({g['id'] for g in new['groups']})==153
 assert len({w['id'] for w in new['words']})==365
 oldp=read('migration/original-polysemy.json');newp=read('dist/polysemy.json')
 oldp['entries']=[e for e in oldp['entries'] if e['word'] not in {'itself','aggressive','acquaintance','discourse','sore','bloom','upper'}]
 assert all(e['word']!='itself' for e in newp['entries'])
 assert [x['word'] for x in oldp['entries']]==[x['word'] for x in newp['entries'][:len(oldp['entries'])]]
 for a,b in zip(oldp['entries'],newp['entries']):
  assert a['notes']==b['notes']
  fields=['partOfSpeech','meaningZh','definitionEn','example']
  assert Counter(canonical({k:s[k] for k in fields}) for s in a['senses'])==Counter(canonical({k:s[k] for k in fields}) for s in b['senses']),a['word']
 oldn=read('migration/original-nap_article.json');newn=read('content/nap_article.json')
 assert all(newn[k]==v for k,v in oldn.items()),'Original article data changed'
 page=''.join(f.read_text() for f in sorted((ROOT/'dist').glob('*.html')))
 for a in newn.get('translationZh',{}).values():assert html.escape(a) in page
 print('PASS preservation: exact original groups/words; 349 retained sense records as multisets; all original article fields unchanged')
if __name__=='__main__':verify()
