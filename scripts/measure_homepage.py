"""Capture homepage evidence at CSS viewport sizes using Python Playwright."""
import argparse
from PIL import Image
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

SIZES = [(320, 568), (375, 667), (390, 844), (430, 932), (760, 800),
         (761, 800), (768, 1024), (844, 390), (900, 800), (1024, 768), (1366, 900), (1440, 900), (1728, 1117)]
MEASURE = """() => {
  const $ = s => document.querySelector(s);
  const rect = el => Object.fromEntries(['x','y','width','height'].map(key =>
    [key, Math.round(el.getBoundingClientRect()[key] * 10) / 10]));
  const boxes = Object.fromEntries(Object.entries({
    title:'.home-header h1', intro:'.home-intro', search:'.home-search',
    hero:'.home-header', grid:'.collections', lower:'.home-bottom',
    recent:'.recent-list', featured:'.home-bottom .reading-link', sidebar:'.sidebar',
    barLabel:$('.mobile-brand').offsetWidth ? '.mobile-brand' : '.desktop-context'
  }).map(([key,s]) => [key,rect($(s))]));
  const controls = [...document.querySelectorAll('.sidebar a,.sidebar button,.sidebar select,.topbar a,.topbar select,.topbar button,#home a,#home button')].filter(el => el.offsetWidth);
  return {...boxes, titleFont:parseFloat(getComputedStyle($('.home-header h1')).fontSize),
    cards:[...document.querySelectorAll('.collection-card')].map(rect),
    smallTargets:controls.filter(el => el.offsetWidth < 44 || el.offsetHeight < 44).map(el => el.className || el.textContent.trim()),
    navMin:Math.min(...[...document.querySelectorAll('.primary-nav a')].flatMap(el => [el.offsetWidth,el.offsetHeight])),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth, pageHeight:document.documentElement.scrollHeight,
    theme:document.documentElement.dataset.theme, scrollY};
}"""

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dist', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--engine', choices=['chromium', 'webkit'], default='chromium')
    parser.add_argument('--verify', action='store_true', help='Check the candidate layout contract')
    parser.add_argument('--metrics-only', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=args.dist)) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        engine = getattr(pw, args.engine)
        browser = engine.launch(executable_path=os.getenv(f'{args.engine.upper()}_PATH'))
        rows = []
        for theme in ['light', 'dark']:
            page = browser.new_page(color_scheme=theme, device_scale_factor=1, reduced_motion='reduce')
            page.add_init_script(f"localStorage.setItem('vocab.theme','{theme}')")
            errors = []
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            for w, h in SIZES:
                page.set_viewport_size({'width': w, 'height': h})
                page.goto(f'http://127.0.0.1:{server.server_port}/index.html#home')
                page.wait_for_selector('#primary-navigation')
                page.evaluate('document.fonts.ready')
                page.evaluate('window.scrollTo(0,0)')
                data = page.evaluate(MEASURE)
                assert data['theme'] == theme and data['scrollY'] == 0
                if args.verify:
                    assert data['overflow'] == 0 and not data['smallTargets'], (w, h, data)
                    assert len(data['cards']) == 4 and data['navMin'] >= 44
                    grid = data['grid']
                    for key in ['title', 'barLabel', 'lower']:
                        assert abs(data[key]['x'] - grid['x']) < 1, (w, key)
                    # The two headline lines and single-column index persist at every size.
                    assert 1.8 < data['title']['height'] / data['titleFont'] < 2.15, w
                    assert all(abs(row['x'] - grid['x']) < 1
                               and abs(row['width'] - grid['width']) < 1 for row in data['cards'])
                    assert abs(data['intro']['x'] - data['search']['x']) < 1
                    if grid['width'] >= 576:
                        assert data['intro']['x'] >= data['title']['x'] + data['title']['width']
                    else:
                        assert data['intro']['y'] >= data['title']['y'] + data['title']['height']
                    if w == 761:
                        previous = rows[-1]
                        for key in ['hero', 'grid', 'lower']:
                            assert abs(data[key]['y'] - previous[key]['y']) < 2, (w, key)
                rows.append(dict(viewport=[w,h], **data))
                if not args.metrics_only and w in [1366, 390]:
                    prefix = args.output / f'{w}-{theme}'
                    page.screenshot(path=f'{prefix}-viewport.png')
                    page.screenshot(path=f'{prefix}-full.png', full_page=True)
                    for name, key in [('cards', 'grid'), ('lower', 'lower')]:
                        # Crop the full-page image to document coordinates, keeping the sticky bar at y=0.
                        box = data[key]
                        with Image.open(f'{prefix}-full.png') as img:
                            img.crop(tuple(round(n) for n in (box['x'],box['y'],box['x']+box['width'],box['y']+box['height']))).save(f'{prefix}-{name}.png')
            assert not errors, errors
            page.close()
        args.output.joinpath('measurements.json').write_text(json.dumps({args.engine:browser.version,'cases':rows}, indent=2)+'\n')
        browser.close()

if __name__ == '__main__':
    main()
