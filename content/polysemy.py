"""Build the separate screenshot vocabulary Part without changing old groups."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
esc = html.escape

def load_entries():
    entries = []
    for line in (ROOT / 'content/polysemy.txt').read_text().splitlines():
        if line.startswith('# '):
            entries.append({'word': line[2:], 'notes': '', 'senses': []})
        elif line.startswith('提示：'):
            entries[-1]['notes'] = line[3:]
        elif line:
            pos, zh, definition, en, translation = line.split('|')
            entries[-1]['senses'].append({'partOfSpeech': pos, 'meaningZh': zh,
                'definitionEn': definition, 'example': {'en': en, 'zh': translation}})
    expected = '''credit aggressive acquaintance dash recourse discourse fly itself drop glow catch just throw point last page pass over break taste cross shuttle lie level lot ticket blow dive material reserve paper practice port junior consider used zoom cream figure full second sign balance stress due wave rank runner attachment spring live fork buck image universal strain bound band line lean post quarter'''.split()
    assert [e['word'] for e in entries] == expected
    assert len(set(expected)) == len(entries) == 62
    assert all(e['notes'] and len(e['senses']) >= 2 for e in entries)
    return entries

def add_part(page):
    entries = load_entries()
    cards = []
    variants = {'live': [('居住 /lɪv/', 'I live here.'), ('现场 /laɪv/', 'live music')],
                'used': [('二手 /juːzd/', 'a used car'), ('过去常常', 'I used to walk to school.')],
                'second': [('第二 /ˈsekənd/', 'the second time'), ('借调', 'She was seconded to the team.')]}
    for i, entry in enumerate(entries, 1):
        word = entry['word']
        speech = variants.get(word, [('朗读', word)])
        buttons = ''.join('<button type="button" class="speak" data-word="'+esc(phrase, quote=True)+'" aria-label="朗读 '+esc(word+' '+label, quote=True)+'" aria-pressed="false">▷ '+esc(label)+'</button>' for label, phrase in speech)
        senses = ''.join('<article class="sense"><h3><span class="sense-number">'+str(n)+'</span> <span lang="en" class="pos">'+esc(s['partOfSpeech'])+'</span> '+esc(s['meaningZh'])+'</h3><p class="definition" lang="en">'+esc(s['definitionEn'])+'</p><div class="example"><div class="en" lang="en">'+esc(s['example']['en'])+'</div><div class="zh">'+esc(s['example']['zh'])+'</div></div></article>' for n,s in enumerate(entry['senses'],1))
        cards.append('<details class="poly-entry" id="poly-'+word+'"><summary><span class="num">P'+str(i).zfill(2)+'</span>'+word+' <span class="sense-count">'+str(len(entry['senses']))+' 义项</span></summary><div class="body"><div class="word-card-header"><h2 lang="en">'+word+'</h2><div class="pronunciation-options">'+buttons+'</div></div>'+senses+'<aside class="selection"><h2>搭配、语法与易错点</h2><p>'+esc(entry['notes'])+'</p></aside></div></details>')
    heading = '<div id="poly-heading" class="part-heading"><div class="eyebrow">PART · POLYSEMY</div><h2>多义词详解 · 截图收藏</h2><p>62 个单词 · '+str(sum(len(e['senses']) for e in entries))+' 个主要义项 · 按词性查阅英文释义与双语例句</p><p class="sub">两页重叠词已合并；与旧词组中重复的单词仍在本 Part 集中详解。收录常见义及部分专业用法；专业、正式或口语用法已标注。朗读使用设备语音，多音词提供语境短句。</p></div>'
    page = page.replace('</section><footer>', heading+''.join(cards)+'</section><footer>', 1)
    page = page.replace('<section id="list">', '<section id="list"><div id="original-heading" class="part-heading"><div class="eyebrow">ORIGINAL PARTS</div><h2>原有词汇辨析 · 113 组</h2></div>', 1)
    page = page.replace('<div class="tools">', '<nav class="part-tabs" aria-label="选择词汇 Part"><button data-part="all" aria-pressed="true">全部内容</button><button data-part="original" aria-pressed="false">原有辨析 · 113组</button><button data-part="poly" aria-pressed="false">新 Part · 多义词62词</button></nav><div class="tools">', 1)
    start = page.index("const items=[...document.querySelectorAll('details')]")
    end = page.index('</script>', start)
    page = page[:start] + """
const items=[...document.querySelectorAll('#list > details')], q=document.querySelector('#search'), count=document.querySelector('#count');
let recentOnly=false, part='all';
const recent=document.querySelector('#recent');
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=b.dataset.part;document.querySelectorAll('[data-part]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));recentOnly=false;recent.setAttribute('aria-pressed','false');filter()});
recent.onclick=()=>{recentOnly=!recentOnly;if(recentOnly){part='original';document.querySelectorAll('[data-part]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.part===part)))}recent.setAttribute('aria-pressed',String(recentOnly));filter()};
function filter(){const key=q.value.trim().toLowerCase();let original=0,poly=0;items.forEach(d=>{const isPoly=d.classList.contains('poly-entry');d.hidden=!d.textContent.toLowerCase().includes(key)||(part==='original'&&isPoly)||(part==='poly'&&!isPoly)||(recentOnly&&!d.classList.contains('new-entry'));if(!d.hidden){if(isPoly)poly++;else original++}});document.querySelector('#original-heading').hidden=original===0;document.querySelector('#poly-heading').hidden=poly===0;count.textContent='显示 '+original+' / 113 组辨析 · '+poly+' / 62 个多义词'+(original+poly===0?' · 没有找到匹配内容':'')}
q.addEventListener('input',filter);
document.querySelector('#expand').onclick=()=>items.filter(d=>!d.hidden).forEach(d=>d.open=true);
document.querySelector('#collapse').onclick=()=>items.forEach(d=>d.open=false);
filter();
""" + page[end:]
    css = '''
.part-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 12px}.part-tabs button{border:1px solid #b9cdb9;border-radius:20px;background:#f7faf3;color:#335d41;padding:10px 14px;cursor:pointer}.part-tabs button[aria-pressed=true]{background:#285b41;color:#fff;border-color:#285b41}.part-heading{margin:28px 0 16px;padding:18px 20px;border-radius:12px;background:#eaf2e5;border:1px solid #d3e1cd}.part-heading h2{font-size:21px;margin:5px 0 10px}.part-heading p{margin:6px 0}.sense{padding:14px 0;border-top:1px solid #e1e8de}.sense h3{font-size:16px;line-height:1.7;margin:0 0 7px}.sense .pos{font-size:13px;color:#547260}.sense-number{display:inline-block;min-width:23px;color:#417354}.definition{font:17px/1.6 Georgia,serif;color:#3d6250;margin:7px 0 10px}.sense-count{font-size:12px;font-weight:400;color:#6c8172;margin-left:10px}.pronunciation-options{display:flex;gap:6px;flex-wrap:wrap}.poly-entry>.body{overflow-wrap:anywhere}.poly-entry .word-card-header{flex-wrap:wrap;gap:10px;margin-bottom:12px}.poly-entry .word-card-header h2{font-size:24px;margin:0}#list>[hidden]{display:none!important}@media(max-width:520px){.part-tabs button{flex:1 1 auto;font-size:12px;padding:10px}.part-heading{padding:14px}.sense h3{font-size:15px}.definition{font-size:16px}.poly-entry .speak{font-size:12px}.poly-entry .num{min-width:34px}}@media print{.part-tabs,.pronunciation-options{display:none}.sense{break-inside:avoid}}
'''
    page = page.replace('</style>', css+'</style>', 1)
    page = page.replace('词汇查阅版 · 113 组 · 277 个词条 · 英文释义与发音', '词汇查阅版 · 113 组辨析 + 62 个多义词详解 · 英文释义与双语例句')
    page = page.replace('2026.10.27', '2026.10.28')
    page = page.replace('点击“近期修订的 15 组”查看。', '点击“近期修订的 15 组”查看。新增独立 Part 收录两页截图的62个多义词，可用上方按钮切换。')
    data={'id':'polysemy-20261028','title':'多义词详解 · 截图收藏','date':'2026-10-28','entries':entries}
    (ROOT/'dist/polysemy.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    return page, data
