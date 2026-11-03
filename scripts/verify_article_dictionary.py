"""Ensure every token in the archived article has a bilingual definition."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
article=read('content/nap_article.json')
articles=[article]+read('content/reading_articles.json')
dictionary=read('content/article-dictionary.json')
known={r['title'].lower():r['fields'] for r in read('dist/search-index.json')['records'] if r['kind'] in ['词汇辨析','多义词','阅读词汇'] and re.fullmatch('[a-z]+',r['title'],re.I)}
fields={**known,**dictionary}
words={w.lower().replace('’',"'") for w in re.findall("(?:[A-Za-z]\\.){2,}|[A-Za-z]+(?:[-'’][A-Za-z]+)*",' '.join(a['title']+' '+' '.join(a['paragraphs'].values()) for a in articles))}
for word in words:
 assert word in fields,word
 assert fields[word].get('中文意思') or fields[word].get('释义'),word
 assert fields[word].get('英文释义'),word
for name in ['article-dictionary.json','search.js','search.css']:
 assert (root/'content'/name).read_bytes()==(root/'dist'/name).read_bytes(),name
print(f'PASS article dictionary: {len(words)} distinct tokens have Chinese and English definitions; source and deployment files match')
