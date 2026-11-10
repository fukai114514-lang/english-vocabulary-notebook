"""English interface labels; bilingual learning content is preserved."""
from pathlib import Path
from html.parser import HTMLParser
import re,html,json
ROOT=Path(__file__).resolve().parents[1]
CATALOG=json.loads((ROOT/'content/ui-labels.json').read_text())
LABELS={k:v for k,v in CATALOG['labels'].items() if k not in CATALOG['learningTerms']}
def label(text):
 stripped=text.strip();value=LABELS.get(stripped)
 stats=re.fullmatch(r'([A-Z])—([A-Z]) 段原文 · (\d+) 个词汇 · (\d+) 个短语',stripped)
 if stats:return CATALOG['text']['articleStats'].format(*stats.groups())
 if value is not None:return text.replace(stripped,value,1)
 for pattern,replacement in [
  (r'(\d+) 组辨析',r'\1 comparisons'),
  (r'(\d+) 个单词 · (\d+) 个义项',r'\1 words · \2 meanings'),
  (r'(\d+) 篇双语文章',r'\1 bilingual articles'),
  (r'(\d+) 义项',r'\1 meanings'),
  (r'词汇辨析 · (\d+) 组',r'Word Comparisons · \1 groups'),
  (r'(\d+) 个单词 · (\d+) 个主要义项 · 常见义项与扩展用法，支持逐项查阅',r'\1 words · \2 meanings · Common and extended uses'),
  (r'▷ (.+)',lambda m:'▷ '+LABELS.get(m[1],m[1])),
  (r'(.+) · 用法对照',r'\1 · Usage comparison')]:
  if re.fullmatch(pattern,stripped):return re.sub(pattern,replacement,stripped)
 return text
class EnglishUI(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.out=[];self.raw=0;self.stack=[]
 def handle_starttag(self,t,attrs):
  attrs_dict=dict(attrs)
  classes=set(attrs_dict.get('class','').split())
  protected=(self.stack and self.stack[-1][1]) or t in {'td','tbody'} or bool(classes & {'nap-paragraph','sense','word-caption','zh','table-en','definition'})
  if t not in {'meta','link','br','hr','img','input','source','wbr'}:self.stack.append((t,protected))
  raw=self.get_starttag_text()
  for key,value in attrs:
   if key in ('aria-label','placeholder','title','content') and value:
    translated=label(value)
    if value.startswith('朗读 '):translated='Listen to '+value[3:].replace(' 朗读','')
    if value.endswith(' 对比表'):translated=value[:-4]+' comparison table'
    raw=raw.replace(key+'="'+html.escape(value,quote=True)+'"',key+'="'+html.escape(translated,quote=True)+'"')
  if t=='html':raw=raw.replace('lang="zh-CN"','lang="en"')
  self.out.append(raw)
  if t in ('script','style'):self.raw+=1
 def handle_startendtag(self,t,a):self.handle_starttag(t,a)
 def handle_endtag(self,t):
  self.out.append('</'+t+'>')
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==t:del self.stack[i:];break
  if t in ('script','style'):self.raw-=1
 def handle_data(self,s):self.out.append(s if self.raw or (self.stack and self.stack[-1][1]) else label(s))
 def handle_entityref(self,n):self.out.append('&'+n+';')
 def handle_charref(self,n):self.out.append('&#'+n+';')
 def handle_decl(self,s):self.out.append('<!'+s+'>')
 def handle_comment(self,s):self.out.append('<!--'+s+'-->')
def build():
 for p in (ROOT/'dist').glob('*.html'):
  parser=EnglishUI();parser.feed(p.read_text());p.write_text(''.join(parser.out))
 from asset_versions import version_assets
 version_assets(ROOT/'dist')
