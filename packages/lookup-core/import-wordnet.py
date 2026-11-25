"""Build the small Open English Wordnet extract used by the public lookup package."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZipFile

ARCHIVE_SHA = '38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93'
PARTS = ('noun', 'verb', 'adj', 'adv')
EXTRA = {'incur', 'phenomenon', 'assumption', 'well'}
ROOT = Path(__file__).resolve().parents[2]
WORD = re.compile(r"[a-z]+(?:['-][a-z]+)*\Z")


def read_json(path):
    return json.loads((ROOT / path).read_text())


def records(archive, path):
    for line in archive.read('oewn2025/' + path).decode().splitlines():
        if line and not line.startswith(' '):
            yield line


def extract(archive, words):
    grammar = {}
    extras = {}
    for part in PARTS:
        indexes = {}
        for line in records(archive, 'index.' + part):
            fields = line.split()
            if fields[0] in words:
                indexes[fields[0]] = fields[6 + int(fields[3]):]
        for lemma in indexes:
            grammar.setdefault(lemma, {})[part] = []
        for line in records(archive, part + '.exc'):
            form, *bases = line.split()
            if not WORD.fullmatch(form):
                continue
            for lemma in set(bases) & indexes.keys():
                grammar[lemma][part].append(form)
        offsets = {offset for lemma in EXTRA & indexes.keys() for offset in indexes[lemma]}
        if not offsets:
            continue
        senses = {}
        for line in records(archive, 'data.' + part):
            offset = line.split(maxsplit=1)[0]
            if offset in offsets:
                definition, *examples = re.split(r';\s+"', line.partition('|')[2].strip())
                senses[offset] = [offset, definition, [e.removesuffix('"') for e in examples]]
        for lemma in sorted(EXTRA & indexes.keys()):
            extras.setdefault(lemma, {})[part] = [senses[offset] for offset in indexes[lemma]]
    for parts in grammar.values():
        for part, values in parts.items():
            parts[part] = sorted(set(values))
    return {'archiveSha256': ARCHIVE_SHA, 'grammar': grammar, 'extraEntries': extras}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    if hashlib.sha256(args.archive.read_bytes()).hexdigest() != ARCHIVE_SHA:
        raise SystemExit('Unexpected Open English Wordnet archive SHA-256')
    words = set(read_json('content/article-dictionary.json')) | EXTRA
    for row in read_json('dist/search-index.json')['records']:
        if row['fields'].get('词条') and WORD.fullmatch(row['title'].lower()):
            words.add(row['title'].lower())
    with ZipFile(args.archive) as archive:
        data = extract(archive, words)
    target = ROOT / 'packages/lookup-core/data/oewn-2025.json'
    lines = ['{', f'  "archiveSha256": "{data["archiveSha256"]}",']
    for section in ('grammar', 'extraEntries'):
        rows = [f'    {json.dumps(key)}: {json.dumps(value, sort_keys=True, separators=(",", ":"))}'
                for key, value in sorted(data[section].items())]
        lines.append(f'  "{section}": {{\n' + ',\n'.join(rows) + '\n  }' + (',' if section == 'grammar' else ''))
    target.write_text('\n'.join(lines + ['}', '']))


if __name__ == '__main__':
    main()
