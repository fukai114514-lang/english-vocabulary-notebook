"""Independent upgrade comparison against the original main, without renewing snapshots.

Requires Git history (fetch the original main commit in a shallow checkout).
Prints JSON evidence; does not modify content or the working tree.
"""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'b2e55d047e53b1183a30c8dc0cdea818b7df1b0b'


def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.raw = 0
        self.text = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.raw += 1
        self.ids.extend(value for key, value in attrs if key == 'id')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.raw -= 1

    def handle_data(self, text):
        if not self.raw and text.strip():
            self.text.append(text.strip())


freeze = json.loads((ROOT / 'docs/audit-20261109-freeze.json').read_text())
frozen = []
for name, digest in freeze['frozen_files'].items():
    old = original(name)
    # Independently verify that the freeze actually represents original main.
    assert hashlib.sha256(old).hexdigest() == digest, ('Invalid freeze', name)
    assert old == (ROOT / name).read_bytes(), ('Changed content/guard', name)
    frozen.append(name)

pages = []
old_names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE, 'dist'], cwd=ROOT, text=True)
old_html = {p for p in old_names.splitlines() if p.endswith('.html')}
assert old_html == {p.relative_to(ROOT).as_posix() for p in (ROOT / 'dist').glob('*.html')}
for name in sorted(old_html):
    before, after = Page(), Page()
    before.feed(original(name).decode())
    after.feed((ROOT / name).read_text())
    assert before.ids == after.ids, ('Missing/reordered/added anchors', name)
    approved_ui = []
    if name == 'dist/nap.html':
        source = 'A—T 段原文 · 32 个词汇 · 33 个短语'
        target = 'Original · A–T · 32 vocabulary items · 33 phrases'
        assert before.text.count(source) == after.text.count(target) == 1
        before.text[before.text.index(source)] = target
        approved_ui.append({'before': source, 'after': target})
    # Ordered sequences catch removal, insertion, duplication and reordering.
    assert before.text == after.text, ('Changed generated text', name)
    pages.append({'path': name, 'ordered_text_segments': len(after.text),
                  'anchors': len(after.ids), 'duplicate_ids': [k for k, v in Counter(after.ids).items() if v > 1],
                  'approved_ui_changes': approved_ui})
    assert not pages[-1]['duplicate_ids'], ('Duplicate anchor', name)
print(json.dumps({'passed': True, 'original_main': BASE, 'frozen_files_verified_against_git': frozen,
                  'pages': pages}, ensure_ascii=False, indent=2))
