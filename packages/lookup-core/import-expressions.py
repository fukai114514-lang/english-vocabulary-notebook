"""Build source-attested multiword entries whose components occur in the site lexicon."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile

here = Path(__file__).resolve().parent
source = Path(sys.argv[1])
base = json.loads((here / 'data/oewn-2025.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest() == base['archiveSha256']
vocabulary = set(base['grammar']) | set('in out on off the of for at up a an by under over into without with from to as and'.split())
entries = {}
with ZipFile(source) as archive:
    for part in ('noun', 'verb', 'adj', 'adv'):
        index = {}
        for line in archive.read('oewn2025/index.' + part).decode().splitlines():
            if not line or line.startswith(' '):
                continue
            word, _, _, pointers, *rest = line.split()
            components = word.split('_')
            if 2 <= len(components) <= 4 and all(w in vocabulary for w in components):
                index[' '.join(components)] = rest[int(pointers) + 2:][:3]
        offsets = {offset for senses in index.values() for offset in senses}
        glosses = {}
        for line in archive.read('oewn2025/data.' + part).decode().splitlines():
            if line[:8] in offsets:
                definition, *examples = re.split(r';\s+"', line.partition('|')[2].strip())
                glosses[line[:8]] = [definition, [e.removesuffix('"') for e in examples[:1]]]
        for word, senses in index.items():
            entries.setdefault(word, {})[part] = [[offset, *glosses[offset]] for offset in senses]
raw = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
(here / 'data/oewn-expressions.json.gz').write_bytes(gzip.compress(raw, mtime=0))
print(len(entries), 'lexicalized expressions')
