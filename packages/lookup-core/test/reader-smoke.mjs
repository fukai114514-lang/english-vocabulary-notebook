import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root = fileURLToPath(new URL('../../../build/context-reader', import.meta.url));
const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + url.pathname);
    assert.ok(path.startsWith(root + sep));
    let body = await readFile(path);
    if (url.searchParams.has('fixture') && url.pathname === '/vpn-privacy.html') {
      const original = 'Earlier this year, the federal government rolled back rules';
      assert.ok(body.includes(original));
      body = body.toString().replace(original, 'They put the meeting off. They discussed rules');
    }
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
try {
  for (const [name, runtime, executablePath] of [
    ['Chromium', chromium, process.env.CHROMIUM_PATH], ['WebKit', webkit, process.env.WEBKIT_PATH],
  ]) {
    const browser = await runtime.launch({ executablePath });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      const external = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      const result = page.locator('#smart-lookup-result');
      const word = key => page.locator('#vpn-privacy-B [data-lookup="' + key + '"]').first();
      const section = async key => {
        await result.filter({ hasText: key }).waitFor();
        assert.equal(await result.count(), 1);
      };
      await page.goto(origin + '/vpn-privacy.html#vpn-privacy-B');
      await word('back').click();
      await section('rolled back');
      assert.equal(await page.locator('.context-expression').count(), 2);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#lookup-card').open && !document.querySelector('.context-expression'));
      await word('rules').click();
      await section('rules');
      assert.ok(!(await result.innerText()).includes('rolled back'));

      await page.goto(origin + '/vpn-privacy.html?fixture=1#vpn-privacy-B');
      await word('meeting').waitFor();
      await word('meeting').scrollIntoViewIfNeeded();
      const top = await page.evaluate(() => scrollY);
      await word('meeting').click();
      await section('put the meeting off');
      assert.equal(await page.locator('.context-expression').count(), 4);
      assert.equal(await page.evaluate(() => scrollY), top);
      await page.keyboard.press('Escape');
      await word('off').evaluate(button => {
        const range = document.createRange();
        range.selectNodeContents(button.firstChild);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.dispatchEvent(new Event('pointerup', { bubbles: true }));
      });
      await section('put the meeting off');
      await word('rules').evaluate(button => button.click());
      await section('rules');
      assert.ok(!(await result.innerText()).includes('put the meeting off'));
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      console.log(name, browser.version(), 'reader click, native Selection API, scoped/discontinuous spans, fallback, scroll, close and localhost-only requests passed');
    } finally { await browser.close(); }
  }
} finally { server.close(); }
