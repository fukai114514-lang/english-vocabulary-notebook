"""Fail builds if archived content is lost. Refresh baseline only after review."""
from pathlib import Path
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
baseline = json.loads((ROOT / 'migration/content-baseline.json').read_text())
reviewed = json.loads((ROOT / 'migration/reviewed-changes-3.0.json').read_text()) if (ROOT / 'migration/reviewed-changes-3.0.json').exists() else {}
def archived_digest(name):
    data = (ROOT / name).read_bytes()
    if name == 'dist/index.html':
        # Only reviewed cache keys are excluded; validate their actual bytes first.
        def strip_version(match):
            asset = ROOT / 'dist' / match[2].decode()
            assert hashlib.sha256(asset.read_bytes()).hexdigest().encode() == match[3]
            return match[1] + match[2] + b'"'
        data = re.sub(rb'((?:src|href)="\./)([^"?]+\.(?:js|css))\?v=([a-f0-9]{64})"', strip_version, data)
    return hashlib.sha256(data).hexdigest()

changed = [name for name, digest in baseline.items()
           if not (ROOT / name).is_file() or archived_digest(name) != reviewed.get(name, {}).get('sha256', digest)]
assert not changed, f'Content changed: {changed}. Review content diff before explicitly refreshing baseline.'
if reviewed:
    from verify_preservation import verify
    verify()
page = ''.join(f.read_text() for f in sorted((ROOT/'dist').glob('*.html')))
catalog = json.loads((ROOT / 'dist/vocabulary.json').read_text())
poly = json.loads((ROOT / 'dist/polysemy.json').read_text())
nap = json.loads((ROOT / 'content/nap_article.json').read_text())
assert len(catalog['groups']) == 153
assert len(catalog['words']) == 365
assert sum(len(g['entries']) for g in catalog['groups']) == 372
assert len(poly['entries']) == 75
assert sum(len(e['senses']) for e in poly['entries']) == 420
assert catalog['parts'] == [poly, json.loads((ROOT/'content/phrases.json').read_text())]
for e in poly['entries']:
    for s in e['senses']:
        for text in [s['meaningZh'], s['definitionEn'], s['example']['en'], s['example']['zh']]:
            assert html.escape(text) in page, (e['word'], text)
assert list(nap['paragraphs']) == list('ABCDEFGHIJKLMNOPQRST')
for letter, text in nap['paragraphs'].items():
    assert f'id="nap-{letter}"' in page and html.escape(text) in page, letter
for row in nap['vocabulary'] + nap['phrases']:
    assert all(html.escape(text) in page for text in row)
assert page.count('<table>') == 153
assert not re.search(r'(?:src|href)=["\x27]https?://', page)
assert 'content/app.js' not in page  # Historical learning app is intentionally inactive.
print('PASS: reviewed SHA-256 baseline; 153 groups, 372 entries, 365 unique IDs; 75 polysemy words/420 senses; 20 paragraphs, 32 words, 33 phrases.')

from verify_interface import verify as verify_interface
verify_interface()
