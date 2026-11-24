"""Build the private Inbox UI without touching the frozen public renderer or index."""
from pathlib import Path
from shutil import copyfile

root = Path(__file__).resolve().parents[1]
source = root / 'content/collection-inbox'
output = root / 'dist/inbox'
output.mkdir(parents=True, exist_ok=True)

for asset in ('index.html', 'collection.css', 'tokens.css', 'app.mjs', 'mapping.mjs',
              'schema.mjs', 'store.mjs', 'sync.mjs'):
    copyfile(source / asset, output / asset)
