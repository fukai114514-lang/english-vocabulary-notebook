"""Add the nap reading archive as a separate reference Part."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'content/nap_article.json').read_text())
assert list(data['paragraphs']) == list('ABCDEFGHIJKLMNOPQRST')
assert len(data['vocabulary']) == len({row[0] for row in data['vocabulary']})
e = html.escape
page_path = ROOT / 'dist/index.html'
page = page_path.read_text()

article = ''.join(f'<p class="nap-paragraph" id="nap-{letter}"><strong>[{letter}]</strong> {e(text)}</p>' for letter, text in data['paragraphs'].items())
words = ''.join(f'<details class="nap-entry"><summary><span lang="en">{e(word)}</span> · {e(zh)}</summary><div class="body"><p lang="en" class="definition">{e(definition)}</p><p><b>原文搭配 / 常见搭配：</b>{e(collocation)}</p></div></details>' for word, zh, definition, collocation in data['vocabulary'])
phrases = ''.join(f'<li><span lang="en">{e(phrase)}</span><span>{e(zh)}</span></li>' for phrase, zh in data['phrases'])
section = (f'<section id="nap-part" class="nap-part"><div class="part-heading"><div class="eyebrow">PART · READING</div>'
           f'<h2>{e(data["title"])}</h2><p>A—T 段原文 · {len(data["vocabulary"])} 个词汇 · {len(data["phrases"])} 个短语</p>'
           '<p class="sub">阅读原文按图片转录。O 段的 “at the at the” 是纸面重复，按原样保留；图片中的中文注释和手写批注未录入。</p></div>'
           '<div class="nap-jump"><a href="#nap-text">原文</a><a href="#nap-words">词汇</a><a href="#nap-phrases">短语</a></div>'
           f'<div id="nap-text" class="nap-paper"><h3>原文 · A—T</h3>{article}</div>'
           f'<div id="nap-words"><h3>词汇 · 英文释义</h3>{words}</div>'
           f'<div id="nap-phrases"><h3>短语 · 中文释义</h3><ul class="nap-phrases">{phrases}</ul></div></section>')
assert '<section id="nap-part"' not in page
page = page.replace('</section><footer>', '</section>' + section + '<footer>', 1)
page = page.replace('</nav><div class="tools">', '<button data-part="nap" aria-pressed="false">新 Part · 午睡文章</button></nav><div class="tools">', 1)
page = page.replace("let recentOnly=false, part='all';", "let recentOnly=false, part='all'; const napPart=document.querySelector('#nap-part');")
page = page.replace("function filter(){const key=q.value.trim().toLowerCase();let original=0,poly=0;", "function filter(){const key=q.value.trim().toLowerCase();napPart.hidden=part!=='nap';document.querySelector('#list').hidden=part==='nap';document.querySelector('#recent').hidden=part==='nap';document.querySelector('#expand').hidden=part==='nap';document.querySelector('#collapse').hidden=part==='nap';let original=0,poly=0;")
page = page.replace("count.textContent='显示 '+original+' / 113 组辨析", "count.textContent=part==='nap'?'午睡文章 · A—T 段 · 词汇与短语': '显示 '+original+' / 113 组辨析")
page = page.replace('新增独立 Part 收录两页截图的62个多义词，可用上方按钮切换。', '独立 Part 收录62个多义词和午睡阅读文章，可用上方按钮切换。')
css = '''
.nap-part{margin:20px 0 35px}.nap-part h3{font-size:19px;color:#285b41;margin:28px 0 12px}.nap-jump{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.nap-jump a{background:#eaf2e5;color:#285b41;padding:7px 15px;border-radius:20px;text-decoration:none}.nap-paper{background:#fff;border:1px solid #dce4d9;border-radius:12px;padding:20px 24px}.nap-paragraph{font:18px/1.85 Georgia,serif;overflow-wrap:anywhere;margin:15px 0}.nap-paragraph strong{font:700 14px system-ui;color:#28664f;margin-right:7px}.nap-entry summary{font-size:16px}.nap-phrases{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.nap-phrases li{background:white;border:1px solid #dce4d9;border-radius:9px;padding:10px 14px;display:flex;justify-content:space-between;gap:12px}.nap-phrases li span:first-child{font-family:Georgia,serif;font-size:17px}.nap-phrases li span:last-child{font-size:14px;color:#617266}@media(max-width:620px){.nap-paper{padding:16px}.nap-paragraph{font-size:17px}.nap-phrases{grid-template-columns:1fr}}@media print{.nap-jump{display:none}}
'''
page = page.replace('</style>', css + '</style>', 1)
# Restore the correct Part before revealing a direct hash target.
page = page.replace('</body>', """<script>
function restoreReferenceAnchor(){
  const id=decodeURIComponent(location.hash.slice(1));
  const target=document.getElementById(id);
  if(!target)return;
  const part=id.startsWith('nap-')?'nap':id.startsWith('poly-')?'poly':id.startsWith('group-')?'original':null;
  if(!part)return;
  document.querySelector('[data-part="'+part+'"]').click();
  const detail=target.closest('details');if(detail)detail.open=true;
  requestAnimationFrame(()=>target.scrollIntoView());
}
window.addEventListener('hashchange',restoreReferenceAnchor);
restoreReferenceAnchor();
</script></body>""")
page_path.write_text(page)
print(f'Nap archive: {len(data["paragraphs"])} paragraphs, {len(data["vocabulary"])} words, {len(data["phrases"])} phrases')
