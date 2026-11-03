"""Append complete reading texts and translations to the existing reading Part."""
import html,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def add_readings():
 articles=json.loads((ROOT/'content/reading_articles.json').read_text());p=ROOT/'dist/index.html';page=p.read_text();e=html.escape
 sections=[]
 for a in articles:
  key=a['id'];assert a['paragraphs'].keys()==a['translationZh'].keys()
  en=''.join(f'<p class="nap-paragraph" id="{key}-{n}"><strong>[{n}]</strong> {e(t)}</p>' for n,t in a['paragraphs'].items())
  zh=''.join(f'<p class="nap-paragraph" id="{key}-zh-{n}"><strong>[{n}]</strong> {e(t)}</p>' for n,t in a['translationZh'].items())
  note='<p class="sub">F 段末句按所提供的纸面原文保留；该句语句残缺。</p>' if key=='motherhood' else ''
  sections.append(f'<article id="{key}-article"><h2 lang="en" class="reading-title">{e(a["title"])}</h2><p>{e(a["titleZh"])}</p><div class="nap-jump"><a href="#{key}-text">原文</a><a href="#{key}-translation">全文译文</a></div><div class="nap-paper reading-text" id="{key}-text" lang="en">{en}</div>{note}<div class="nap-paper" id="{key}-translation" lang="zh-CN"><h3>全文译文</h3>{zh}</div></article>')
 page=page.replace('<div id="nap-text"', '<div class="nap-jump" aria-label="阅读目录"><a href="#nap-text">午睡文章</a>'+''.join(f'<a href="#{a["id"]}-article">{e(a["titleZh"])}</a>' for a in articles)+'</div><div id="nap-text"',1)
 assert '</section><footer>' in page
 page=page.replace('</section><footer>',''.join(sections)+'</section><footer>',1)
 page=page.replace("id.startsWith('nap-')?'nap'", "(id.startsWith('nap-')||id.startsWith('motherhood-')||id.startsWith('vpn-privacy-'))?'nap'")
 page=page.replace('午睡文章 · A—T 段 · 词汇与短语','阅读文章 · 3 篇')
 p.write_text(page)
 (ROOT/'dist/reading_articles.json').write_bytes((ROOT/'content/reading_articles.json').read_bytes())
