// Build a separate, localhost-ready copy of the actual site with the candidate reader enabled.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildDictionary } from './build.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'dist');
const output = join(root, 'build/context-reader');
const assets = join(output, 'context-engine');
await mkdir(assets, { recursive: true });
await cp(dist, output, { recursive: true });
const bundle = await buildDictionary(dist);
await writeFile(join(assets, 'lookup-dictionary.json'), bundle.bytes);
await writeFile(join(assets, 'lookup-manifest.json'), JSON.stringify(bundle.manifest));
await writeFile(join(assets, 'OEWN-LICENSE.md'), bundle.notice);
await writeFile(join(assets, 'SEMCOR-LICENSE.txt'), bundle.semcorNotice);
await writeFile(join(assets, 'STREUSLE-LICENSE.txt'), bundle.streusleNotice);
for (const file of ['index', 'dictionary', 'tokens', 'constructions', 'pattern-matcher', 'sentence', 'sense-ranker', 'reader-adapter']) {
  await cp(new URL('./' + file + '.mjs', import.meta.url), join(assets, file + '.mjs'));
}
for (const file of await readdir(dist)) {
  if (!file.endsWith('.html')) continue;
  const html = await readFile(join(dist, file), 'utf8');
  if (html.includes('src="./reader.js')) await writeFile(join(output, file),
    html.replace('</body>', '<script type="module" src="./context-engine/reader-adapter.mjs"></script></body>'));
}
console.log(output);
