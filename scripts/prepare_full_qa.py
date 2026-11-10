"""Prepare disposable browser QA assets; --clean removes only these assets."""
from pathlib import Path
import hashlib,json,shutil,sys
root=Path(__file__).resolve().parents[1];dist=root/'dist'
if '--clean' in sys.argv:
    for name in ['__qa.html','__manifest.json']:(dist/name).unlink(missing_ok=True)
    shutil.rmtree(dist/'__pages',ignore_errors=True)
else:
    files=[p for p in dist.iterdir() if p.is_file() and not p.name.startswith('__')]
    (dist/'__manifest.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}))
    (dist/'__pages').mkdir(exist_ok=True)
    for p in files:shutil.copyfile(p,dist/'__pages'/p.name)
    shutil.copyfile(root/'scripts/full-qa.html',dist/'__qa.html')
