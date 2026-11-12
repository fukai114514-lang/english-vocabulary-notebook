"""Verify search coverage, target anchors and translated paragraph correspondence."""
from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import json,re
ROOT=Path(__file__).resolve().parents[1]
def load(p):return json.loads((ROOT/p).read_text())
page=''.join(f.read_text() for f in sorted((ROOT/'dist').glob('*.html')));idx=load('dist/search-index.json')['records'];poly=load('dist/polysemy.json');nap=load('dist/nap_article.json')
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.text=[]
 def handle_starttag(self,t,a):self.ids.extend(v for k,v in a if k=='id')
 def handle_data(self,d):self.text.append(d)
p=Parser();p.feed(page);assert all(len(one.ids)==len(set(one.ids)) for f in (ROOT/'dist').glob('*.html') for one in [Parser()] if one.feed(f.read_text()) is None),'duplicate anchors'
assert all(r['target'] in p.ids for r in idx),'broken search target'
assert len({r['id'] for r in idx})==len(idx)
reading_paragraphs=len(nap['paragraphs'])+sum(len(article['paragraphs']) for article in load('content/reading_articles.json'))
counts=Counter(r['kind'] for r in idx);assert counts=={'词汇辨析':sum(1+len(g['entries']) for g in load('content/vocabulary.json')['groups']),'多义词':428,'阅读文章':reading_paragraphs,'阅读词汇':32,'短语':33+len(load('content/phrases.json')['entries'])},counts
assert list(nap['translationZh'])==list('ABCDEFGHIJKLMNOPQRST')
assert all(nap['translationZh'][k].strip() for k in nap['paragraphs'])
assert page.index('id="nap-T"') < page.index('id="nap-translation"')
for letter in nap['paragraphs']:assert 'nap-zh-'+letter in p.ids
assert len({s['id'] for e in poly['entries'] for s in e['senses']})==428
plain=' '.join(p.text)
normalize=lambda s:' '.join(s.split())
normalized_plain=normalize(plain)
for r in idx:
 for field,text in r['fields'].items():
  if field!='正文':assert normalize(text) in normalized_plain,(r['id'],field)
for name in ['search.js','search.css','search-index.json','nap_article.json']:
 assert (ROOT/'dist'/name).stat().st_size>0
assert './search.js' in page and './search.css' in page
assert 'innerHTML' not in (ROOT/'content/search.js').read_text()
print('PASS upgrade: all index records, all targets present; 428 unique stable sense IDs; A–T translations after complete English text; index fields found in HTML')
