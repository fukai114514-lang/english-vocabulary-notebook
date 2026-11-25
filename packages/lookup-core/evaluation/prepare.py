"""Recreate frozen test inputs from human annotations, without running the detector."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

streusle, semcor, wordnet, output = map(Path, sys.argv[1:])
targets = {'pick up', 'put off', 'come up with', 'in charge of', 'take into account',
           'take for granted', 'by no means', 'at odds with', 'in light of', 'bank account', 'over time'}
# Predicate tokens in related but ordinary uses provide difficult word-only controls.
confusable = {'pick', 'put', 'account', 'charge', 'off', 'up', 'means', 'odds', 'light', 'granted'}
run_groups = {'02517831': 'manage', '01986651': 'motion', '01975082': 'motion',
              '01576673': 'operate', '01577333': 'operate', '02768999': 'extend'}
cases = []


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def emit(tokens, indices, label, source, category):
    # Both input and gold use identical space-joined original token surfaces.
    text = ' '.join(tokens)
    spans = []
    for index in indices:
        start = sum(len(token) + 1 for token in tokens[:index])
        offset = len(text[:start].encode('utf-16-le')) // 2
        spans.append([offset, offset + len(tokens[index].encode('utf-16-le')) // 2])
    cases.append(dict(source=source, text=text, spans=spans, label=label, category=category))


for split in ('test', 'dev', 'train'):
    counts = Counter()
    for row in json.loads(next((streusle / split).glob('*.json')).read_text()):
        tokens = [t['word'] for t in row['toks']]
        source = f"STREUSLE/{split}/{row['sent_id']}"
        for collection in ('smwes', 'wmwes'):
            for unit in row[collection].values():
                if unit['lexlemma'] not in targets:
                    continue
                indices = [n - 1 for n in unit['toknums']]
                category = 'continuous' if len(indices) == indices[-1] - indices[0] + 1 else 'discontinuous'
                emit(tokens, indices, unit['lexlemma'], source, category)
        for i, token in enumerate(row['toks']):
            if token['smwe'] or token['wmwe']:
                continue
            lemma = token['lemma'].lower()
            ordinary = lemma in {'customer', 'food', 'people'}
            if (lemma in confusable or ordinary) and counts[lemma] < 2:
                emit(tokens, [i], None, source, 'ordinary' if ordinary else 'confusable')
                counts[lemma] += 1

assert digest(semcor) == '126fa2e829ab63edd5b3fd9de45ef1d60d6880e01e25abc55b5ac7918a824655'
assert digest(wordnet) == '38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93'
with ZipFile(wordnet) as archive:
    offsets = {line.split()[0]: line.split()[1] for line in archive.read('oewn2025/index.sense').decode().splitlines()
               if line.startswith('run%2:')}
counts = Counter()
with ZipFile(semcor) as archive:
    for path in sorted(archive.namelist()):
        if not path.endswith('.xml'):
            continue
        for sentence in ElementTree.fromstring(archive.read(path)).iter('s'):
            tokens = []
            labels = []
            for word in sentence:
                surface = (word.text or '').split('_')
                indices = list(range(len(tokens), len(tokens) + len(surface)))
                lemma = word.get('lemma', '').replace('_', ' ')
                category = 'continuous'
                label = lemma
                if lemma == 'run' and word.get('pos', '').startswith('VB'):
                    label = run_groups.get(offsets.get('run%' + word.get('lexsn', '')))
                    category = 'sense'
                elif lemma not in targets or len(surface) < 2:
                    label = None
                if label and counts[(category, label)] < 25:
                    labels.append((indices, label, category))
                    counts[(category, label)] += 1
                tokens.extend(surface)
            for indices, label, category in labels:
                emit(tokens, indices, label, f"SemCor/{path}#{sentence.get('snum')}", category)

output.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + '\n')
print(len(cases), Counter(r['category'] for r in cases), Counter(r['label'] for r in cases if r['category'] == 'sense'))
