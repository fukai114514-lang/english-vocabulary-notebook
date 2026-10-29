"""Compare both deployed sites to this checkout; any mismatch exits nonzero."""
from pathlib import Path
from urllib.request import Request, urlopen
import argparse, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--a', default='https://vocab-notebook-20261021.abloomfawn22.chatgpt.site')
parser.add_argument('--b', default='https://fukai114514-lang.github.io/english-vocabulary-notebook')
args = parser.parse_args()
report = {}
for label, origin in [('A', args.a), ('B', args.b)]:
    report[label] = {}
    for name in ['index.html', 'vocabulary.json', 'polysemy.json']:
        try:
            with urlopen(Request(origin.rstrip('/') + '/' + name, headers={'Cache-Control': 'no-cache'}), timeout=30) as response:
                actual = response.read()
            expected = (ROOT / 'dist' / name).read_bytes()
            report[label][name] = {'match': actual == expected, 'sha256': hashlib.sha256(actual).hexdigest()}
        except Exception as error:
            report[label][name] = {'match': False, 'error': str(error)}
print(json.dumps(report, indent=2))
raise SystemExit(0 if all(r['match'] for site in report.values() for r in site.values()) else 1)
