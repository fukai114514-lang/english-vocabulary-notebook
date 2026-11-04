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
 start=page.index('<section id="nap-part"')
 end=page.index('</section><footer>',start)+len('</section>')
 nap=page[start:end].split('>',1)[1].removesuffix('</section>')
 nap_title=json.loads((ROOT/'content/nap_article.json').read_text())['title']
 pages=[('nap',nap_title,nap)]+[(a['id'],a['title'],body) for a,body in zip(articles,sections)]
 contexts=json.loads((ROOT/"content/reading-context.json").read_text())
 links=[]
 style=page.split('<style>',1)[1].split('</style>',1)[0]
 for slug,title,body in pages:
  filename=slug+'.html'
  links.append(f'<p><a href="{filename}">{e(title)}</a></p>')
  page_context={key:rows for key,rows in contexts.items() if key.startswith(slug+"-")}
  embedded=json.dumps(page_context,ensure_ascii=False).replace("<","\\u003c")
  document=(f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>'
            f'<style>{style}main{{max-width:800px;margin:auto;padding:18px}}</style>'
            '<link rel="stylesheet" href="./search.css"><main><a href="index.html#nap-part">← 阅读目录</a><label class="reader-settings">正文字号 <select id="reader-size"><option value="17">标准</option><option value="20">大</option><option value="23">特大</option></select></label><p id="reader-status" role="status"></p>'
            f'<section id="reader" class="nap-part">{body}</section><a href="index.html#nap-part">返回阅读目录</a></main><script id="reading-context" type="application/json">{embedded}</script><script src="./reader.js"></script></html>')
  (ROOT/'dist'/filename).write_text(document)
 directory='<section id="nap-part" class="nap-part"><h2>阅读目录</h2>'+''.join(links)+'</section>'
 page=page[:start]+directory+page[end:]
 page=page.replace('午睡文章 · A—T 段 · 词汇与短语','阅读文章 · 3 篇')
 p.write_text(page)
 for name in ['reader.js','reading_articles.json']:
  (ROOT/'dist'/name).write_bytes((ROOT/'content'/name).read_bytes())
