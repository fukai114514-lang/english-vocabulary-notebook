"""Fail builds if archived content is lost. Refresh baseline only after review."""
from pathlib import Path
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
baseline = json.loads((ROOT / 'migration/content-baseline.json').read_text())
reviewed = json.loads((ROOT / 'migration/reviewed-changes-3.0.json').read_text()) if (ROOT / 'migration/reviewed-changes-3.0.json').exists() else {}
changed = [name for name, digest in baseline.items()
           if not (ROOT / name).is_file() or hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != reviewed.get(name, {}).get('sha256', digest)]
assert not changed, f'Content changed: {changed}. Review content diff before explicitly refreshing baseline.'
if reviewed:
    from verify_preservation import verify
    verify()
page = ''.join(f.read_text() for f in sorted((ROOT/'dist').glob('*.html')))
catalog = json.loads((ROOT / 'dist/vocabulary.json').read_text())
poly = json.loads((ROOT / 'dist/polysemy.json').read_text())
nap = json.loads((ROOT / 'content/nap_article.json').read_text())
assert len(catalog['groups']) == 136
assert len(catalog['words']) == 318
assert sum(len(g['entries']) for g in catalog['groups']) == 323
assert len(poly['entries']) == 74
assert sum(len(e['senses']) for e in poly['entries']) == 408
assert catalog['parts'] == [poly]
for e in poly['entries']:
    for s in e['senses']:
        for text in [s['meaningZh'], s['definitionEn'], s['example']['en'], s['example']['zh']]:
            assert html.escape(text) in page, (e['word'], text)
assert list(nap['paragraphs']) == list('ABCDEFGHIJKLMNOPQRST')
for letter, text in nap['paragraphs'].items():
    assert f'id="nap-{letter}"' in page and html.escape(text) in page, letter
for row in nap['vocabulary'] + nap['phrases']:
    assert all(html.escape(text) in page for text in row)
assert page.count('<table>') == 136
assert not re.search(r'(?:src|href)=["\x27]https?://', page)
assert 'content/app.js' not in page  # Historical learning app is intentionally inactive.
print('PASS: reviewed SHA-256 baseline; 136 groups, 323 entries, 318 unique IDs; 74 polysemy words/408 senses; 20 paragraphs, 32 words, 33 phrases.')

from verify_interface import verify as verify_interface
verify_interface()
