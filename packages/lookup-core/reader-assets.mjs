import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildDictionary } from './build.mjs';

const dist = new URL('../../dist/', import.meta.url);
const output = new URL('reader-dictionary/', dist);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const bundle = await buildDictionary(fileURLToPath(dist));
// Match the deterministic gzip used in the extension snapshot when available.
const gzip = spawnSync('gzip', ['-n', '-9'], { input: bundle.bytes, maxBuffer: 8 * 1024 * 1024 });
const compressed = gzip.status === 0 ? gzip.stdout : gzipSync(bundle.bytes, { level: 9 });
const parts = [];
for (let offset = 0; offset < compressed.length; offset += 65536) {
  const part = 'data.gz.' + String(parts.length).padStart(2, '0');
  await writeFile(new URL(part, output), compressed.subarray(offset, offset + 65536));
  parts.push(part);
}
await writeFile(new URL('manifest.json', output), JSON.stringify({ ...bundle.manifest, parts }) + '\n');
for (const name of ['index', 'dictionary', 'tokens', 'constructions', 'pattern-matcher', 'sentence', 'sense-ranker']) {
  await cp(new URL(name + '.mjs', import.meta.url), new URL(name + '.mjs', output));
}
for (const [name, data] of [['OEWN-LICENSE.md', bundle.notice], ['SEMCOR-LICENSE.txt', bundle.semcorNotice], ['STREUSLE-LICENSE.txt', bundle.streusleNotice]]) {
  await writeFile(new URL(name, output), data);
}
