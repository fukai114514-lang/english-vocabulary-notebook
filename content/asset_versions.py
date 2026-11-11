"""Version generated stylesheet/script URLs by their exact bytes.

Keep relative paths and stable filenames for dual hosting; a changed resource
gets a new browser cache key without changing any learning content or anchors.
"""
import hashlib
import re
from pathlib import Path


def version_assets(dist):
    dist = Path(dist)
    pattern = re.compile(r'((?:src|href)="\./)([^"?]+\.(?:js|css))(?:\?v=[a-f0-9]+)?(")')
    for page in dist.glob('*.html'):
        def replace(match):
            digest = hashlib.sha256((dist / match[2]).read_bytes()).hexdigest()
            return f'{match[1]}{match[2]}?v={digest}{match[3]}'
        page.write_text(pattern.sub(replace, page.read_text()))
