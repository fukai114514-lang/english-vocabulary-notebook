"""UI conversion must never translate matching vocabulary/reading text."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'content'))
from english_ui import EnglishUI, CATALOG

def convert(value):
    parser=EnglishUI();parser.feed(value);return ''.join(parser.out)
assert convert('<button>关闭</button><label>外观</label>')=='<button>Close</button><label>Appearance</label>'
for markup in ['<p class="nap-paragraph">原文</p>','<div class="sense"><h3>大</h3><p>标准</p></div>','<table><tbody><tr><th>大</th><td>原文</td></tr></tbody></table>','<p class="zh">关闭</p>','<p class="word-caption">原文</p>']:
    assert convert(markup)==markup,markup
assert convert('<p class="zh">原文</p><button>关闭</button>')=='<p class="zh">原文</p><button>Close</button>'
assert convert('<script>"原文"</script>')=='<script>"原文"</script>'
assert 'Original · A–T' in convert('<p>A—T 段原文 · 32 个词汇 · 33 个短语</p>')
assert all(k in CATALOG['labels'] for k in CATALOG['legacyRuntimeKeys'])
print('PASS UI-only translation, protected learning subtrees, metadata and shared catalog')
