"""Deterministic index built exclusively from the rendered reference content."""
import json,re,html
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,d):self.parts.append(d)
def plain(s):
 p=Text();p.feed(s);return ' '.join(p.parts)
def build():
 def read(p):return json.loads((ROOT/p).read_text())
 catalog=read('dist/vocabulary.json');poly=read('dist/polysemy.json');nap=read('content/nap_article.json');page=(ROOT/'dist/index.html').read_text();rows=[]
 def add(id,kind,title,target,fields):rows.append(dict(id=id,kind=kind,title=title,target=target,fields=fields))
 words={w['id']:w for w in catalog['words']}
 for g in catalog['groups']:
  target=g['id']
  # Existing HTML uses zero-padded IDs; resolve actual anchor rather than invent one.
  blocks=re.findall(r'<details\b[^>]*id="([^"]+)"[^>]*>(.*?)</details>',page,re.S)
  block=next(((i,b) for i,b in blocks if re.search(r'class="num">0*'+str(g['number'])+r'</span>',b)),None)
  assert block,g['number'];target=block[0]
  for n,e in enumerate(g['entries']):
   w=words[e['wordId']] if 'wordId' in e else words[g['wordIds'][n]]
   add(f"comparison-{g['number']}-{n}",'词汇辨析',w['lemma'],target,{'词条':w['lemma'],'释义':e['meaningZh'],'英文释义':e['definitionEn'],'搭配':'; '.join(e['collocations']),'例句':' '.join(x['en'] for x in e['examples']),'例句译文':' '.join(x['zh'] for x in e['examples'])})
  add('comparison-body-'+str(g['number']),'词汇辨析',' / '.join(words[i]['lemma'] for i in g['wordIds']),target,{'正文':plain(block[1])})
 for e in poly['entries']:
  for s in e['senses']:
   add(s['id'],'多义词',e['word'],s['id'],{'词条':e['word'],'词性':s['partOfSpeech'],'释义':s['meaningZh'],'英文释义':s['definitionEn'],'搭配':e['notes'],'例句':s['example']['en'],'例句译文':s['example']['zh']})
 for letter,text in nap['paragraphs'].items():add('article-'+letter,'阅读文章',nap['title']+' ['+letter+']','nap-'+letter,{'原文':text,'译文':nap.get('translationZh',{}).get(letter,'')})
 for article in read('content/reading_articles.json'):
  for letter,text in article['paragraphs'].items():add(article['id']+'-'+letter,'阅读文章',article['title']+' ['+letter+']',article['id']+'-'+letter,{'原文':text,'译文':article['translationZh'][letter]})
 for n,row in enumerate(nap['vocabulary']):add('reading-word-'+str(n),'阅读词汇',row[0],'nap-word-'+str(n),dict(zip(['词条','释义','英文释义','搭配'],row)))
 for n,row in enumerate(nap['phrases']):add('reading-phrase-'+str(n),'短语',row[0],'nap-phrase-'+str(n),{'词条':row[0],'释义':row[1]})
 from phrases import index_records
 rows.extend(index_records())
 (ROOT/'dist/search-index.json').write_text(json.dumps({'schemaVersion':1,'records':rows},ensure_ascii=False,indent=2)+'\n')
 (ROOT/'dist/article-dictionary.json').write_bytes((ROOT/'content/article-dictionary.json').read_bytes())
 for ext in ['js','css']:(ROOT/('dist/search.'+ext)).write_bytes((ROOT/('content/search.'+ext)).read_bytes())
 page=page.replace('</head>','<link rel="stylesheet" href="./search.css"></head>',1).replace('</body>','<script src="./search.js" defer></script></body>',1)
 (ROOT/'dist/index.html').write_text(page)
