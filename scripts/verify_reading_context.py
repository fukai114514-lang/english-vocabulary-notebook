"""Check contextual phrases against their exact paragraphs in the published pages."""
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read_json(path):
    return json.loads((ROOT / path).read_text())

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.context = None
        self.in_context = False

    def handle_starttag(self, tag, attrs):
        ident = dict(attrs).get('id')
        if ident:
            self.ids.add(ident)
        if tag == 'script':
            self.in_context = ident == 'reading-context'

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_context = False

    def handle_data(self, data):
        if self.in_context:
            self.context = json.loads(data)

articles = read_json('content/reading_articles.json')
articles.append({'id': 'nap', **read_json('content/nap_article.json')})
expected = read_json('content/reading-context.json')
seen = {}
for article in articles:
    slug = article['id']
    page = Page()
    page.feed((ROOT / 'dist' / (slug + '.html')).read_text())
    assert 'reader-size' in page.ids and page.context
    for letter in article['paragraphs']:
        assert {f'{slug}-{letter}', f'{slug}-zh-{letter}'} <= page.ids
    for key, entries in page.context.items():
        assert key in page.ids
        paragraph = article['paragraphs'][key.rsplit('-', 1)[1]].lower()
        for surface, label, zh, en in entries:
            assert surface.lower() in paragraph and label and zh and en, (key, surface)
        seen[key] = entries
assert seen == expected
for key, surface in [('vpn-privacy-E', 'turn off'), ('vpn-privacy-B', 'rolled back'), ('motherhood-N', 'run deep')]:
    assert any(entry[0] == surface for entry in seen[key])
print('PASS contextual senses, original and translated paragraph anchors, and font controls')
