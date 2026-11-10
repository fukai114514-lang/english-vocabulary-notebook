"""Check text/solid-surface contrast and parity of explicit/system dark tokens."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / 'content/search.css').read_text()
blocks = re.findall(r':root(?:\[data-theme="dark"\]|:not\(\[data-theme="light"\]\))?\s*\{([^{}]*)\}', css)
colors = [dict(re.findall(r'(--[\w-]+):\s*(#[a-fA-F0-9]{6})\s*;', b)) for b in blocks[:3]]
assert len(colors) == 3 and colors[1] == colors[2], 'Explicit/system dark colors diverged'

def luminance(color):
    rgb = [int(color[n:n+2], 16) / 255 for n in (1, 3, 5)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(a * b for a, b in zip(rgb, [.2126, .7152, .0722]))

def contrast(a, b):
    x, y = sorted([luminance(a), luminance(b)])
    return (y + .05) / (x + .05)

results = []
for theme, palette in zip(['light', 'dark'], colors):
    pairs = [(fg, bg, 4.5) for fg in ['--ink', '--secondary', '--accent']
             for bg in ['--canvas', '--surface', '--inset', '--tint', '--hover', '--pressed']]
    pairs += [(a, b, 4.5) for a, b in [('--warm-ink', '--warm-surface'),
               ('--sage-ink', '--sage-surface'), ('--ink', '--highlight'), ('--on-accent', '--accent')]]
    pairs += [('--border-control', '--surface', 3), ('--focus', '--surface', 3)]
    for fg, bg, minimum in pairs:
        ratio = contrast(palette[fg], palette[bg])
        assert ratio >= minimum, (theme, fg, bg, ratio, minimum)
        results.append({'theme': theme, 'foreground': fg, 'background': bg, 'ratio': round(ratio, 2)})
print(json.dumps({'passed': True, 'pairs': len(results), 'minimum_ratio': min(x['ratio'] for x in results), 'results': results}, indent=2))
