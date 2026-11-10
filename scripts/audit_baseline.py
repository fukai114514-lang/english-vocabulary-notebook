"""Offline, repeatable pre-upgrade gate. Never refreshes preservation snapshots."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, help='Optional JSON evidence path outside dist')
args = parser.parse_args()
if args.output and ROOT.joinpath('dist').resolve() in args.output.resolve().parents:
    parser.error('Evidence must not be written inside dist')
results = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def manifest(folder):
    return {p.relative_to(folder).as_posix(): digest(p)
            for p in sorted(folder.rglob('*')) if p.is_file()}

def run(command, cwd=ROOT):
    start = time.monotonic()
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    results.append({'command': command, 'exit_code': result.returncode,
                    'seconds': round(time.monotonic()-start, 3),
                    'stdout': result.stdout, 'stderr': result.stderr})
    print(('PASS ' if result.returncode == 0 else 'FAIL ') + ' '.join(command))

before = manifest(ROOT / 'dist')
run([sys.executable, 'content/render.py'])
for name in ['verify_migration', 'verify_preservation', 'verify_interface',
             'verify_upgrade', 'verify_article_dictionary', 'verify_reading_context',
             'verify_routes', 'test_ui_labels', 'verify_design_tokens', 'verify_asset_versions']:
    run([sys.executable, 'scripts/' + name + '.py'])
for path in sorted((ROOT / 'content').glob('*.js')):
    run(['node', '--check', str(path.relative_to(ROOT))])
run(['node', 'scripts/test_search.cjs'])
generated = manifest(ROOT / 'dist')
reproducible = before == generated
with tempfile.TemporaryDirectory(prefix='wordbook-audit-') as folder:
    clean = Path(folder)
    shutil.copytree(ROOT / 'content', clean / 'content',
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    (clean / 'dist').mkdir()
    run([sys.executable, 'content/render.py'], cwd=clean)
    clean_matches = generated == manifest(clean / 'dist')
freeze = json.loads((ROOT / 'docs/audit-20261109-freeze.json').read_text())
changed = [name for name, sha in freeze['frozen_files'].items()
           if not (ROOT / name).is_file() or digest(ROOT / name) != sha]
checks = {'committed_output_matches_rebuild': reproducible,
          'clean_build_matches': clean_matches,
          'frozen_learning_content_and_guards_unchanged': not changed}
for key, passed in checks.items():
    print(('PASS ' if passed else 'FAIL ') + key)
report = {'audited_main': freeze['audited_main'],
          'python': sys.version.split()[0],
          'node': subprocess.check_output(['node', '--version'], text=True).strip(),
          'results': results, 'checks': checks, 'changed_frozen_files': changed,
          'dist': {name: {'sha256': sha,
                         'bytes': (ROOT / 'dist' / name).stat().st_size,
                         'gzip_bytes': len(gzip.compress((ROOT / 'dist' / name).read_bytes(), mtime=0))}
                   for name, sha in generated.items()}}
passed = all(r['exit_code'] == 0 for r in results) and all(checks.values())
report['passed'] = passed
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
if not passed:
    for result in results:
        if result['exit_code']:
            print(result['stdout'] + result['stderr'], file=sys.stderr)
    print('Changed frozen files:', changed, file=sys.stderr)
sys.exit(0 if passed else 1)
