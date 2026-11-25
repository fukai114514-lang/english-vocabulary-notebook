"""Count annotated versus literal uses of OEWN phrase spellings in separate STREUSLE reviews."""
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import sys

here = Path(__file__).resolve().parent
corpus = Path(sys.argv[1])
inventory = set(json.loads(gzip.decompress((here.parent / 'data/oewn-expressions.json.gz').read_bytes())))
def read_partition(name, digest):
    raw = (corpus / name / ('streusle.ud_' + name + '.json')).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == digest
    return json.loads(raw)

def fingerprint(row):
    return hashlib.sha256(' '.join(t['word'] for t in row['toks']).encode()).hexdigest()

gold = [json.loads(line) for line in (here / 'gold.jsonl').read_text().splitlines()]
blocked_docs = {r['source'].split('/')[-1].rsplit('-', 1)[0] for r in gold if r['source'].startswith('STREUSLE/')}
blocked_hashes = {r['textSHA256'] for r in gold}
for row in read_partition('test', 'f8144e6227db2e845cda4aa832f8d5644cb40b9e743d1dbe05663dd687d2c70c'):
    blocked_docs.add(row['sent_id'].rsplit('-', 1)[0])
    blocked_hashes.add(fingerprint(row))
counts = Counter()
hits = Counter()
documents = set()
sentences = 0
for row in read_partition('train', '36aef0205a6e2e154b681d7520858693a264d3c40ba7d97c089345bbd1149a22'):
    doc = row['sent_id'].rsplit('-', 1)[0]
    if doc in blocked_docs or fingerprint(row) in blocked_hashes:
        continue
    documents.add(doc)
    sentences += 1
    words = [t['lemma'].lower() for t in row['toks']]
    annotated = {(m['lexlemma'].lower(), tuple(m['toknums']))
                 for m in [*row['smwes'].values(), *row['wmwes'].values()]}
    for i in range(len(words)):
        for n in range(2, min(4, len(words) - i) + 1):
            phrase = ' '.join(words[i:i+n])
            if phrase in inventory:
                counts[phrase] += 1
                if (phrase, tuple(range(i + 1, i + n + 1))) in annotated:
                    hits[phrase] += 1
stats = {lemma: [hit, counts[lemma]] for lemma, hit in sorted(hits.items()) if hit >= 3}
result = {'sourceId': 'streusle-5', 'documents': len(documents), 'sentences': sentences, 'counts': stats}
(here.parent / 'data/expression-support.json').write_text(json.dumps(result, indent=2) + '\n')
print(len(documents), sentences, len(stats))
