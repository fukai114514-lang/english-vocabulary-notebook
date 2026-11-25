import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root = fileURLToPath(new URL('../../..', import.meta.url));
const worker = `
  import { createDictionaryStore } from '/packages/lookup-core/index.mjs';
  self.onmessage = async ({ data }) => {
    const store = createDictionaryStore(async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0')).join(''));
    const status = await store.install(new Uint8Array(data.bytes), data.manifest);
    if (status.status !== 'installed') return self.postMessage({ error: status.error });
    self.postMessage(['incurred', 'running', 'went', 'better', 'phenomena', 'assumptions']
      .map((term) => store.current.lemmatize(term).lemmas[0]));
  };
`;
const server = createServer(async (req, res) => {
  try {
    const path = req.url;
    if (path === '/') return res.end('<!doctype html><title>Lookup core smoke</title>');
    if (path === '/worker.mjs') {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(worker);
    }
    assert.match(path, /^\/(packages\/lookup-core\/[a-z-]+\.mjs|build\/lookup-core\/lookup-[a-z]+\.json)$/);
    res.setHeader('Content-Type', path.endsWith('.mjs') ? 'text/javascript' : 'application/json');
    res.end(await readFile(root + path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
try {
  for (const [name, runtime, binary] of [
    ['Chromium', chromium, process.env.CHROMIUM_PATH], ['WebKit', webkit, process.env.WEBKIT_PATH],
  ]) {
    const browser = await runtime.launch({ executablePath: binary });
    try {
      const context = await browser.newContext();
      await context.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const output = await page.evaluate(async () => {
        const { createLookupEngine } = await import('/packages/lookup-core/index.mjs');
        const [bytes, manifest] = await Promise.all([
          fetch('/build/lookup-core/lookup-dictionary.json').then((r) => r.arrayBuffer()),
          fetch('/build/lookup-core/lookup-manifest.json').then((r) => r.json()),
        ]);
        const worker = new Worker('/worker.mjs', { type: 'module' });
        return await new Promise((ok, reject) => {
          const timeout = setTimeout(() => reject(new Error('Lookup worker timed out')), 10000);
          worker.onerror = (event) => {
            clearTimeout(timeout);
            reject(new Error(event.message));
          };
          worker.onmessage = ({ data }) => {
            clearTimeout(timeout);
            if (data.error) return reject(new Error(data.error));
            try {
              const engine = createLookupEngine(JSON.parse(new TextDecoder().decode(bytes)));
              const { candidates } = engine.getContextualCandidates({
                windowText: 'We improved over time.', anchor: { start: 17, end: 21 },
              });
              ok({ bases: data, span: candidates[0].span, phrase: candidates[0].entry.id });
            } catch (error) {
              reject(error);
            }
          };
          worker.postMessage({ bytes, manifest });
        });
      });
      assert.deepEqual(output, { bases: ['incur', 'run', 'go', 'good', 'phenomenon', 'assumption'],
        span: { start: 12, end: 21 }, phrase: 'phrase-over-time' });
      console.log(name, browser.version(), 'module page and worker passed', JSON.stringify(output));
    } finally { await browser.close(); }
  }
} finally { server.close(); }
