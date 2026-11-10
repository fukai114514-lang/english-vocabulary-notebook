"""Freeze learning data and verify exact bilingual text and relative assets."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
def verify():
 baseline=json.loads((ROOT/'migration/ui-content-baseline.json').read_text())
 for name,sha in baseline.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,('Changed learning content',name)
 class Content(HTMLParser):
  def __init__(self):super().__init__();self.paragraph=None;self.text={};self.ids=[];self.assets=[]
  def handle_starttag(self,t,a):
   a=dict(a)
   if a.get('id'):self.ids.append(a['id'])
   if t=='p' and a.get('class')=='nap-paragraph':self.paragraph=a['id'];self.text[self.paragraph]=''
   if t in ['script','link'] and (a.get('src') or urlsplit(a.get('href','')).path.endswith('.css')):self.assets.append(a.get('src') or a['href'])
  def handle_endtag(self,t):
   if t=='p':self.paragraph=None
  def handle_data(self,s):
   if self.paragraph:self.text[self.paragraph]+=s
 articles=[{'id':'nap',**json.loads((ROOT/'content/nap_article.json').read_text())}]+json.loads((ROOT/'content/reading_articles.json').read_text());count=0
 for a in articles:
  parser=Content();parser.feed((ROOT/'dist'/f'{a["id"]}.html').read_text())
  for letter,text in a['paragraphs'].items():
   assert parser.text[f'{a["id"]}-{letter}']==f'[{letter}] {text}'
   assert parser.text[f'{a["id"]}-zh-{letter}']==f'[{letter}] {a["translationZh"][letter]}'
   count+=1
 for file in (ROOT/'dist').glob('*.html'):
  parser=Content();page=file.read_text();parser.feed(page)
  assert len(parser.ids)==len(set(parser.ids)),file
  assert '<style>' not in page,'legacy inline styles leaked'
  assert 'viewport-fit=cover' in page
  for asset in parser.assets:assert not asset.startswith('/') and (file.parent/urlsplit(asset).path).is_file(),(file,asset)
  for href in re.findall(r'href="([^"]+\.html)(?:#[^"]*)?"',page):assert (file.parent/href).is_file(),href
 print(f'PASS interface: frozen data; {count} exact original and translated paragraphs; relative assets/routes; no inline legacy CSS')
if __name__=='__main__':verify()
