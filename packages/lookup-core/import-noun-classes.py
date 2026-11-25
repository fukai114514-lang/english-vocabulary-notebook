"""Derive selectional classes for the context ranker from OEWN 2025 noun hypernyms."""
import gzip
import hashlib
import json
from functools import lru_cache
from pathlib import Path
import re
import sys
from zipfile import ZipFile

here = Path(__file__).resolve().parent
archive = Path(sys.argv[1])
assert hashlib.sha256(archive.read_bytes()).hexdigest() == '38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93'
# Stable WNDB offsets for organizational units, equipment, routes, people and distance units.
roots = {
    'organization': {'07394720', '07402980', '01099740'},
    'equipment': {'03074929', '03166689', '03543584', '03838819', '03059840'},
    'route': {'03470137', '07912041', '03797675'},
    'person': {'00008121'},
    'distance': {'10896415'},
}
parents = {}
with ZipFile(archive) as source:
    for line in source.read('oewn2025/data.noun').decode().splitlines():
        if not line.strip() or line.startswith(' '):
            continue
        fields = line.partition('|')[0].split()
        at = 4 + 2 * int(fields[3], 16)
        parents[fields[0]] = [fields[j + 1] for j in range(at + 1, at + 1 + 4 * int(fields[at]), 4)
                              if fields[j] in {'@', '@i'} and fields[j + 2] == 'n']

    @lru_cache(maxsize=None)
    def classes(offset):
        result = {name for name, seeds in roots.items() if offset in seeds}
        for parent in parents[offset]:
            result.update(classes(parent))
        return result

    labels = {}
    for line in source.read('oewn2025/index.noun').decode().splitlines():
        if not line.strip() or line.startswith(' '):
            continue
        word, _, _, pointers, *rest = line.split()
        if len(word) < 2 or not re.fullmatch('[a-z]+(?:-[a-z]+)*', word):
            continue
        # First listed noun sense keeps remotely related homographs out of hard grammar cues.
        group = classes(rest[int(pointers) + 2])
        if group:
            labels[word] = sorted(group)
raw = json.dumps(labels, sort_keys=True, separators=(',', ':')).encode()
(here / 'data/oewn-noun-classes.json.gz').write_bytes(gzip.compress(raw, mtime=0))
print(len(labels), 'local noun-class hints')
