"""Learn local collocation counts for run from SemCor documents outside the gold set."""
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sys
from xml.etree import ElementTree
from zipfile import ZipFile

root = Path(__file__).resolve().parent
gold = [json.loads(line) for line in (root / 'gold.jsonl').read_text().splitlines()]
blocked = {row['source'].split('#')[0].removeprefix('SemCor/') for row in gold if row['source'].startswith('SemCor/')}
blocked_hashes = {row['textSHA256'] for row in gold}
semcor, wordnet = map(Path, sys.argv[1:])
assert hashlib.sha256(semcor.read_bytes()).hexdigest() == '126fa2e829ab63edd5b3fd9de45ef1d60d6880e01e25abc55b5ac7918a824655'
assert hashlib.sha256(wordnet.read_bytes()).hexdigest() == '38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93'
with ZipFile(wordnet) as archive:
    offsets = {line.split()[0]: line.split()[1] for line in archive.read('oewn2025/index.sense').decode().splitlines()
               if line.startswith('run%2:')}
counts = Counter()
features = defaultdict(Counter)
docs = set()
with ZipFile(semcor) as archive:
    for path in sorted(archive.namelist()):
        if not path.endswith('.xml') or path in blocked:
            continue
        for sentence in ElementTree.fromstring(archive.read(path)).iter('s'):
            words = list(sentence)
            surfaces = [(word.text or '').replace('_', ' ') for word in words]
            if hashlib.sha256(' '.join(surfaces).encode()).hexdigest() in blocked_hashes:
                continue
            for i, word in enumerate(words):
                if word.get('lemma') != 'run' or not word.get('pos', '').startswith('VB'):
                    continue
                label = offsets.get('run%' + word.get('lexsn', ''))
                if not label:
                    continue
                counts[label] += 1
                docs.add(path)
                window = []
                for side, sequence in [('L', surfaces[:i][::-1]), ('R', surfaces[i+1:])]:
                    terms = []
                    for token in sequence:
                        if not re.fullmatch(r"[a-zA-Z' -]+", token):
                            break
                        pieces = token.lower().split()
                        terms.extend(pieces[::-1] if side == 'L' else pieces)
                        if len(terms) >= 5:
                            break
                    for j, term in enumerate(terms[:5]):
                        if j < 2:
                            window.append(f'{side}{j+1}:{term}')
                        window.append(f'{side}:{term}')
                for feature in set(window):
                    features[feature][label] += 1

model = {'sourceId': 'semcor', 'documents': len(docs), 'examples': sum(counts.values()), 'counts': dict(sorted(counts.items())),
         'features': {key: dict(sorted(value.items())) for key, value in sorted(features.items()) if sum(value.values()) >= 2}}
target = root.parent / 'data/run-context.json'
target.write_text(json.dumps(model, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
print(model['documents'], model['examples'], len(model['features']))
