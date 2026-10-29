from pathlib import Path
import re, html, json
root=Path(__file__).resolve().parents[1]
p=root/'dist/index.html'; s=(root/'content/base.html').read_text()
groups={}; group=None
for line in (root/'content/comparisons.txt').read_text().splitlines():
 if line.startswith('# '): group=int(line[2:]); groups[group]=[]
 else: groups[group].append(line.split('|'))
notes={int(l.split('|',1)[0]):l.split('|',1)[1] for l in (root/'content/selection-notes.txt').read_text().splitlines()}
assert set(groups)==set(notes)==set(range(1,len(groups)+1))
captions=dict(l.split('|',1) for l in (root/'content/english-captions.txt').read_text().splitlines())
assert all(r[0] in captions for rows in groups.values() for r in rows)
blocks=re.findall(r'<details\b.*?</details>',s,re.S); assert len(blocks)==len(groups)
for i,old in enumerate(blocks,1):
 assert all(len(r)==5 for r in groups[i])
 title=html.unescape(re.sub('<[^>]+>','',re.search(r'</span>(.*?)</summary>',old,re.S)[1])).replace(' 新增详解','').strip()
 expected=[w.strip() for w in title.split('/')]
 assert expected==[r[0] for r in groups[i]],(i,expected)
 rows=[]
 for word,meaning,focus,colloc,example in groups[i]:
  en,zh=example.split(' → ',1)
  rows.append('<tr><th scope="row">'+html.escape(word)+'</th><td><strong>'+html.escape(meaning)+'</strong><p>'+html.escape(focus)+'</p></td><td>'+html.escape(colloc)+'</td><td><div class="table-en">'+html.escape(en)+'</div><div class="zh">'+html.escape(zh)+'</div></td></tr>')
 table='<h2>逐词对比</h2><p class="table-hint">手机可左右滑动表格，横向比较用法与例句。</p><div class="table-scroll" tabindex="0" role="region" aria-label="'+html.escape(title,quote=True)+' 对比表"><table><caption>'+html.escape(title)+' · 用法对照</caption><thead><tr><th scope="col">单词 / 表达</th><th scope="col">词性、含义与侧重点</th><th scope="col">常见搭配 / 句型</th><th scope="col">中英例句</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></div>'
 note='<div class="selection"><h2>怎么选？易错点在哪？</h2><p>'+html.escape(notes[i])+'</p></div>'
 cards='<div class="word-cards">'+''.join('<article class="word-card"><div class="word-card-header"><h3 lang="en">'+html.escape(r[0])+'</h3><button type="button" class="speak" data-word="'+html.escape(r[0],quote=True)+'" aria-label="朗读 '+html.escape(r[0],quote=True)+'" aria-pressed="false">▷ 朗读</button></div><p class="word-caption" lang="en">'+html.escape(captions[r[0]])+'</p></article>' for r in groups[i])+'</div>'
 new=old.replace('<div class="body">','<div class="body">'+cards+table,1)
 # Keep all original explanations/examples and add the group-specific decision note.
 new=new[:-len('</div></details>')]+note+'</div></details>'
 new=re.sub(r' <span class="badge">新增详解</span>','',new)
 s=s.replace(old,new,1)
s=s.replace('详解复习版 · 100 组 · 辨析、搭配与双语例句',f'词汇查阅版 · {len(groups)} 组 · {sum(map(len,groups.values()))} 个词条 · 英文释义与发音')
s=s.replace('本次新增 23 组，并深化 20 组原有词条。点击“本次新增”查看近期补充。','全部词组均含英文释义、读音、对比表、搭配与双语例句。原第77组已拆为第77组 clip / bump 和第113组 vessel / cabin；其他组号不变。点击“近期修订的 15 组”查看。')
s=s.replace('>本次新增</button>','>近期修订的 15 组</button>')
s=s.replace('100组英语易混词，详细辨析、常见搭配、易错提醒与双语例句。','113组英语词汇详解，277个词条，含英文释义、朗读、对比表与双语例句。')
css='''
h2{font-size:15px;line-height:1.5;margin:18px 0 9px;color:var(--green)}.body>h2:first-child{margin-top:3px}.table-hint{font-size:12px;color:#718575;margin:0 0 8px}.table-scroll{overflow-x:auto;border:1px solid #dce4d9;border-radius:9px;margin-bottom:20px;scrollbar-width:thin}.table-scroll:focus-visible{outline:3px solid #72a18a;outline-offset:3px}table{width:100%;min-width:720px;border-collapse:collapse;text-align:left;font-size:14px;line-height:1.65}caption{text-align:left;padding:10px 13px;font-size:12px;color:#5e7065;background:#fafcf8}th,td{padding:12px 13px;border-top:1px solid #e1e8de;vertical-align:top}thead th{background:#eaf1e6;font-size:12px;color:#3f634b}tbody th{font-weight:700;color:#24583f;width:14%;overflow-wrap:anywhere}td:nth-child(2){width:31%}td:nth-child(3){width:23%}td:nth-child(4){width:32%}td strong{font-weight:600}td p{margin:5px 0 0;color:#617266;font-size:13px}tr:nth-child(even){background:#fafcf8}.table-en{font:16px/1.6 Georgia,serif;margin-bottom:5px}.selection{background:#edf4e8;border-radius:9px;padding:1px 15px 10px;margin-top:18px}.selection p{font-size:14px}.selection h2{margin-top:12px}@media print{.table-hint{display:none}.table-scroll{overflow:visible}table{min-width:0;font-size:10px}th,td{padding:5px}.table-en{font-size:11px}details{break-inside:auto}tr{break-inside:avoid}}'''
s=s.replace('</style>',css+'</style>')
s=s.replace('</style>',(root/'content/pronunciation.css').read_text()+'</style>')
s=s.replace('</header>','<div class="speech-settings"><label for="accent">单词读音</label><select id="accent"><option value="en-US">美式英语 · US</option><option value="en-GB">英式英语 · UK</option></select><span class="sub">展开词组，点击 ▷ 朗读；再次点击停止。</span></div><p id="speech-status" role="status" aria-live="polite">使用设备英语合成语音；英文释义对应本页常见用法。</p></header>')
s=s.replace('</body>','<script>'+(root/'content/pronunciation.js').read_text()+'</script></body>')
s=s.replace('<head>','<head><link rel="icon" href="data:,">',1)
s=s.replace('<body>','<body>',1)
s=s.replace('247 个词条逐项对比','247 个词条 · 逐项对比、英文释义与发音')
s=s.replace('2026.10.25','2026.10.27')
from polysemy import add_part
s, polysemy_part = add_part(s)
p.write_text(s)
import runpy
runpy.run_path(str(root/'content/nap.py'))
# Refuse to publish stale structured data alongside corrected tables.
catalog=json.loads((root/'content/vocabulary.json').read_text())
by_id={w['id']:w for w in catalog['words']}
assert len(catalog['groups'])==len(groups)
for g in catalog['groups']:
 n=g['number']
 assert g['selectionNote']==notes[n], ('stale note',n)
 assert [by_id[wid]['lemma'] for wid in g['wordIds']]==[r[0] for r in groups[n]], ('membership',n)
 assert len(g['entries'])==len(groups[n])
 for e,r in zip(g['entries'],groups[n]):
  en,zh=r[4].split(' → ',1)
  assert e['meaningZh']==r[1] and e['scenario']==r[2], ('stale meaning',n,r[0])
  assert e['definitionEn']==captions[r[0]], ('stale definition',n,r[0])
  assert e['collocations']==r[3].split('; ') and e['examples']==[{'en':en,'zh':zh}], ('stale example',n,r[0])
catalog['parts'] = [polysemy_part]
(root/'dist/vocabulary.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'groups':len(groups),'word_rows':sum(map(len,groups.values())),'tables':s.count('<table>'),'selection_notes':s.count('class="selection"')},ensure_ascii=False))
