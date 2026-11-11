"""Check production cache keys and cache invalidation after asset changes."""
import hashlib
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import sys,tempfile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'content'))
from asset_versions import version_assets
class Assets(HTMLParser):
 def __init__(self):super().__init__();self.urls=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);u=a.get('src') if tag=='script' else a.get('href') if tag=='link' else None
  if u and urlsplit(u).path.endswith(('.js','.css')):self.urls.append(u)
count=0
for page in (ROOT/'dist').glob('*.html'):
 p=Assets();p.feed(page.read_text())
 for u in p.urls:
  split=urlsplit(u);assert parse_qs(split.query).get('v')==[hashlib.sha256((page.parent/split.path).read_bytes()).hexdigest()],(page.name,u)
  count+=1
assert count==24,count
with tempfile.TemporaryDirectory() as tmp:
 d=Path(tmp);(d/'index.html').write_text('<script src="./interface.js"></script><script src="./reader.js"></script>')
 for name in ['interface.js','reader.js']:(d/name).write_text('old')
 version_assets(d);first=(d/'index.html').read_text();version_assets(d);assert first==(d/'index.html').read_text()
 (d/'interface.js').write_text('new');version_assets(d);p=Assets();p.feed((d/'index.html').read_text());old=Assets();old.feed(first)
 assert p.urls[0]!=old.urls[0] and p.urls[1]==old.urls[1]
print(f'PASS {count} versioned asset references; deterministic output and selective cache invalidation')
