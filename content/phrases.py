"""Independent phrase collection with stable anchors and search records."""
from pathlib import Path
import html,json
ROOT=Path(__file__).resolve().parents[1]
def load():return json.loads((ROOT/'content/phrases.json').read_text())
def render():
 e=html.escape
 items=[]
 for p in load()['entries']:
  examples=''.join('<div class="sense"><p class="table-en" lang="en">'+e(x['en'])+'</p><p class="zh">'+e(x['zh'])+'</p></div>' for x in p['examples'])
  items.append('<details class="phrase-entry" id="'+e(p['id'])+'"><summary><span class="num">01</span> '+e(p['phrase'])+'</summary><div class="body"><article class="word-card"><div class="word-card-header"><h2 lang="en">'+e(p['phrase'])+'</h2><button type="button" class="speak" data-word="'+e(p['phrase'])+'" aria-label="Listen to '+e(p['phrase'])+'" aria-pressed="false">▷ Listen</button></div><p class="word-caption" lang="en">'+e(p['definitionEn'])+'</p><p class="zh"><strong>'+e(p['meaningZh'])+'</strong></p></article><h2>Usage</h2><p lang="en">'+e(p['usageEn'])+'</p><p class="zh">'+e(p['usageZh'])+'</p><h2>Common combinations</h2><p lang="en">'+e(' · '.join(p['collocations']))+'</p><h2>Examples</h2>'+examples+'<div class="selection"><h2>Usage notes</h2><p lang="en">'+e(p['noteEn'])+'</p><p class="zh">'+e(p['noteZh'])+'</p></div></div></details>')
 return '<h2 id="phrases-heading" class="part-heading">PART 04 · PHRASES</h2>'+''.join(items)
def index_records():
 return [dict(id=p['id'],kind='短语',title=p['phrase'],target=p['id'],fields={'词条':p['phrase'],'释义':p['meaningZh'],'英文释义':p['definitionEn'],'搭配':' · '.join(p['collocations']),**{f'Example {n}':x['en'] for n,x in enumerate(p['examples'],1)},**{f'Translation {n}':x['zh'] for n,x in enumerate(p['examples'],1)},'用法':p['usageEn'],'用法释义':p['usageZh'],'辨析':p['noteEn'],'辨析释义':p['noteZh']}) for p in load()['entries']]
