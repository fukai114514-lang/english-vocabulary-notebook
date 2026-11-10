"""Validate every generated local link/resource and legacy article redirect."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=set();self.links=[];self.resources=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.add(a['id'])
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag in ('script','link','img') and (a.get('src') or a.get('href')):self.resources.append(a.get('src') or a['href'])
pages={}
for path in DIST.glob('*.html'):
    if path.name.startswith('__'):continue
    p=Page();p.feed(path.read_text());pages[path.name]=p
links=resources=aliases=0
for filename,p in pages.items():
    for href in p.links+p.resources:
        url=urlsplit(href)
        if url.scheme or url.netloc:continue
        assert not url.path.startswith('/'),('project-path incompatible URL',filename,href)
        name=unquote(url.path) or filename
        assert (DIST/name).is_file(),('missing local target',filename,href)
        if href in p.resources:resources+=1
        else:links+=1
        if url.fragment:
            anchor=unquote(url.fragment)
            if anchor not in pages[name].ids:
                matching=[n for n,doc in pages.items() if name=='index.html' and n!='index.html' and anchor.startswith(n[:-5]+'-') and anchor in doc.ids]
                assert matching,('broken anchor',filename,href)
                aliases+=1
print(json.dumps({'pages':len(pages),'links':links,'resources':resources,'legacy_article_redirects':aliases,'passed':True}))
