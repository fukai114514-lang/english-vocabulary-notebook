"""Shared UI shell; original learning content and stable anchors are preserved."""
from pathlib import Path
import re,json,html
ROOT=Path(__file__).resolve().parents[1]
e=html.escape
ICONS={'home':'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>','original':'<path d="M4 6h7M4 12h5M4 18h7M15 6h5M13 12h7M15 18h5"/><path d="m12 8 3-2-3-2M12 16l-3 2 3 2"/>','poly':'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h5M8 16h7"/>','nap':'<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>','phrases':'<path d="M4 5h16v12H9l-5 4z"/><path d="M8 9h8M8 13h5"/>','search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'}
ICONS['library'] = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M12 8h6m-6 4h6m-6 4h6"/>'
LEARNING_AREAS = (
 ('Word Knowledge', ('original', 'poly', 'word-families')),
 ('Language in Use', ('collocations', 'word-patterns', 'phrasal-verbs', 'common-mistakes',
                      'register-and-tone', 'idioms-and-expressions', 'phrases')),
 ('Practice & Reading', ('nap', 'pronunciation-lab')),
)
def icon(k):return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[k]+'</svg>'
def themes():return '<select class="theme-picker" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>'
def shell(current_view):
 destinations = (
  ('home', 'home', 'Home'),
  ('library', 'library-title', 'Library index'),
  ('original', 'original-heading', 'Word Comparisons'),
  ('poly', 'poly-heading', 'Word Meanings'),
  ('nap', 'nap-part', 'Reading'),
  ('phrases', 'phrases-heading', 'Phrases'),
 )
 links = []
 for key, target, label in destinations:
  prefix = '' if key == 'library' and current_view == 'home' else 'index.html'
  view = '' if key == 'library' else f' data-view="{key}"'
  current = ' aria-current="page"' if key == current_view else ''
  links.append(f'<a href="{prefix}#{target}"{view}{current}>{icon(key)}<span>{label}</span></a>')
 return ('<a class="skip-link" href="#main">Skip to content</a><aside class="sidebar"><a class="brand" href="index.html#home"><span>TAsLEXICON</span></a><p class="sidebar-label">Library</p><nav class="primary-nav" aria-label="Main navigation">'+''.join(links)+'<button type="button" data-search>'+icon('search')+'<span>Search</span><kbd>⌘ K</kbd></button></nav><div class="sidebar-foot"><label>Appearance'+themes()+'</label></div></aside><div class="topbar"><a href="index.html#home" class="mobile-brand">TAsLEXICON</a><span class="desktop-context">Personal library</span><div><label class="mobile-theme"><span class="sr-only">Appearance</span>'+themes()+'</label><button type="button" class="search-trigger" aria-label="Search library" data-search>'+icon('search')+'<span>Search library</span><kbd>⌘ K</kbd></button></div></div>')
def search_dialog():return '<dialog id="search-dialog" class="glass" aria-labelledby="search-title"><div class="search-head">'+icon('search')+'<h2 id="search-title" class="sr-only">Search library</h2><input id="search" type="search" autocomplete="off" spellcheck="false" placeholder="Words, Chinese meanings, articles…" aria-label="Search library" aria-controls="search-results"><button id="search-close" aria-label="Close search">Cancel</button></div><section id="search-results" aria-label="Search results"><p role="status" id="search-status">Search words, examples, and articles</p><div id="search-groups"></div></section><div class="search-foot">↑ ↓ Navigate · Enter Open · Esc Close</div></dialog>'
def build():
 catalog=json.loads((ROOT/'dist/vocabulary.json').read_text());poly=json.loads((ROOT/'dist/polysemy.json').read_text());articles=[{'id':'nap',**json.loads((ROOT/'content/nap_article.json').read_text())}]+json.loads((ROOT/'content/reading_articles.json').read_text())
 meta=json.dumps({'articles':[a['id'] for a in articles]});boot=(ROOT/'content/theme.js').read_text()+'\n'
 ui=json.loads((ROOT/'content/ui-labels.json').read_text())
 boot+='window.notebookUILabel = text => ('+json.dumps({k:ui['labels'][k] for k in ui['legacyRuntimeKeys']},ensure_ascii=False)+')[text] || text;\n'
 def document(title,body,reader=False,context='',part_description=None):
  standalone = part_description is not None
  page_title = title+' — TAsLEXICON' if reader or standalone else 'TAsLEXICON — Words, refined.'
  description = part_description or 'TAsLEXICON: a personal language library for word meanings, comparisons, and bilingual reading.'
  metadata = '<meta property="og:site_name" content="TAsLEXICON"><meta property="og:type" content="website"><meta property="og:title" content="'+e(page_title)+'"><meta property="og:description" content="'+e(description)+'">'
  current_view = 'nap' if reader else None if standalone else 'home'
  adapter = '' if standalone else '<script src="./'+('reader' if reader else 'pronunciation')+'.js" defer></script>'
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><meta name="description" content="'+e(description)+'"><title>'+e(page_title)+'</title>'+metadata+'<link rel="icon" href="data:,"><script>'+boot+'</script><link rel="stylesheet" href="./search.css"></head><body'+(' class="reader-page"' if reader else '')+'>'+shell(current_view)+'<main id="main" tabindex="-1">'+body+'</main>'+search_dialog()+'<script id="site-meta" type="application/json">'+meta+'</script>'+context+'<script src="./interface.js" defer></script><script src="./search.js" defer></script>'+adapter+'</body></html>'
 p=ROOT/'dist/index.html';page=p.read_text();listing=re.search(r'<section id="list">(.*?)</section><section id="nap-part"',page,re.S)[1]
 from phrases import render as render_phrases
 listing+=render_phrases()
 parts = {}
 reserved_slugs = {'index', *(a['id'] for a in articles)}
 for source_path in sorted((ROOT/'content/learning-parts').glob('*.json')):
  part = json.loads(source_path.read_text())
  slug = part['id']
  if slug != source_path.stem or not re.fullmatch(r'[a-z]+(?:-[a-z]+)*', slug):
   raise ValueError(f'Invalid learning part ID: {source_path.name}')
  if slug in reserved_slugs:
   raise ValueError(f'Learning part conflicts with an existing page: {slug}')
  parts[slug] = part

 existing_collections = {
  'original': ('original-heading', 'Word Comparisons'),
  'poly': ('poly-heading', 'Word Meanings'),
  'nap': ('nap-part', 'Reading'),
  'phrases': ('phrases-heading', 'Phrases'),
 }
 part_areas = {key: area for area, keys in LEARNING_AREAS for key in keys if key not in existing_collections}
 if parts.keys() != part_areas.keys():
  raise ValueError('Every learning part needs a library area')
 collections = []
 for area, keys in LEARNING_AREAS:
  links = []
  for key in keys:
   if key in existing_collections:
    target, title = existing_collections[key]
    attributes = f'href="#{target}" data-view="{key}"'
   else:
    title = parts[key]['title']
    attributes = f'href="{key}.html"'
   links.append(f'<li><a {attributes}>{e(title)}</a></li>')
  collections.append(
   f'<section class="collection-group"><h3 class="eyebrow">{e(area)}</h3>'
   '<ul class="collection-links" role="list">' + ''.join(links) + '</ul></section>'
  )
 reading_links=[f'<a class="reading-link" href="{a["id"]}.html"><span class="reading-number">{n:02}</span><span><strong lang="en">{e(a["title"])}</strong><small>{e(a.get("titleZh","Reading"))} · {len(a["paragraphs"])} paragraphs</small></span><span aria-hidden="true">↗</span></a>' for n,a in enumerate(articles,1)]
 latest=''.join(f'<a href="#{g["id"]}"><span>{e(" / ".join(w["lemma"] for w in catalog["words"] if w["id"] in g["wordIds"]))}</span><span aria-hidden="true">›</span></a>' for g in catalog['groups'][-4:][::-1])
 body = (
  '<section id="home"><header class="home-header">'
  '<p class="eyebrow">English vocabulary notebook</p>'
  '<h1><span>Words,</span> <span>refined.</span></h1>'
  '<div class="home-aside"><p class="home-intro">Discover meanings. Explore differences. Build understanding.</p>'
  '<button type="button" class="home-search" data-search>'+icon('search')+
  '<span>Search library</span><kbd>⌘ K</kbd></button></div></header>'
  '<section aria-labelledby="library-title"><div class="section-title"><h2 id="library-title">Library index</h2>'
  '</div><div class="collections">'+''.join(collections)+'</div></section>'
  '<div class="home-bottom"><section><div class="section-title"><h2>Recently added comparisons</h2>'
  '<a href="#original-heading" data-view="original">View all</a></div><div class="recent-list">'+latest+
  '</div></section><section><div class="section-title"><h2>Featured reading</h2></div>'+
  reading_links[-1]+'</section></div></section>'
 )
 body+='<section id="reference" hidden><div class="reference-head"><h1 id="view-title">Word Comparisons</h1><p id="count" role="status"></p></div><div class="reference-tools"><div class="speech-settings"><label for="accent">Pronunciation</label><select id="accent"><option value="en-US">American · US</option><option value="en-GB">British · UK</option></select></div><div><button id="expand">Expand all</button><button id="collapse">Collapse all</button></div></div><p id="speech-status" role="status">Uses your device’s English voices</p><section id="list">'+listing+'</section></section><section id="nap-part" hidden><header class="page-header"><p class="eyebrow">PART 03 · READING</p><h1>Reading</h1><p>Read at your own pace. Let context guide your understanding.</p></header><div class="reading-directory">'+''.join(reading_links)+'</div><p class="reading-hint">Tap any English word for English and Chinese definitions.</p></section><footer>TAsLEXICON · Made for reference and reading</footer>'
 p.write_text(document('English Vocabulary & Reading',body))
 for a in articles:
  p=ROOT/'dist'/f'{a["id"]}.html';old=p.read_text();body=re.search(r'<main>(.*?)</main>',old,re.S)[1]
  body=body.replace('<a href="index.html#nap-part">', '<a class="back-link" href="index.html#nap-part">').replace('<div id="nap-text" class="nap-paper">','<div id="nap-text" class="nap-paper" lang="en">')
  body=re.sub(r'<h2([^>]*)>(.*?)</h2>', r'<h1\1>\2</h1>', body, count=1, flags=re.S)
  jump='<label class="paragraph-picker">段落 <select id="paragraph-jump"><option value="">Choose a paragraph</option>'+''.join(f'<option value="{a["id"]}-{letter}">{letter}</option>' for letter in a['paragraphs'])+'</select></label>'
  body='<div class="reader-tools">'+body.replace('<p id="reader-status"',jump+'</div><p id="reader-status"',1)
  context=re.search(r'<script id="reading-context".*?</script>',old,re.S)[0]
  p.write_text(document(a['title'],body,True,context))
 for slug, part in parts.items():
  body = (
   '<article class="learning-part">'
   '<a class="back-link" href="index.html#library-title">Back to library</a>'
   '<header class="learning-part-header">'
   '<p class="eyebrow">'+e(part_areas[slug])+'</p>'
   '<h1>'+e(part['title'])+'</h1><p class="learning-part-intro">'+e(part['description'])+'</p>'
   '</header><section class="learning-part-empty" aria-labelledby="empty-title">'
   '<h2 id="empty-title">No entries yet.</h2>'
   '<p>This section is ready for future additions.</p>'
   '</section></article>'
  )
  (ROOT/'dist'/f'{slug}.html').write_text(document(part['title'], body, part_description=part['description']))
 # Bundle shared audio before the two page adapters while retaining versioned URLs.
 shared = ['speech.js', 'practice-recording.js', 'practice.js', 'interface.js']
 source = '\n'.join((ROOT/'content'/name).read_text() for name in shared)
 (ROOT/'dist/interface.js').write_text('window.notebookText = '+json.dumps(ui['text'],ensure_ascii=False)+';\n'+source)
 # The legacy build still reads pronunciation.js from the archived sources.
 (ROOT/'dist/pronunciation.js').write_text('window.notebookSpeech.bindReferenceWords();\n')
 print('Interface:',len(catalog['groups']),'groups,',len(poly['entries']),'words,',len(articles),'readers')
