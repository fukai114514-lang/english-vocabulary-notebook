import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { createDictionaryStore } from './index.mjs';

const [folder] = process.argv.slice(2);
if (!folder) throw new Error('Usage: node benchmark.mjs <dictionary-output>');

const manifest = JSON.parse(await readFile(resolve(folder, 'lookup-manifest.json')));
const bytes = await readFile(resolve(folder, 'lookup-dictionary.json'));
const sha256 = (input) => createHash('sha256').update(input).digest('hex');

function stats(samples) {
  const sorted = samples.toSorted((a, b) => a - b);
  const percentile = (q) => Number(sorted[Math.ceil(q * sorted.length) - 1].toFixed(6));
  return { samples: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
}

const cold = [];
let engine;
for (let i = 0; i < 30; i++) {
  const store = createDictionaryStore(sha256);
  const start = performance.now();
  const result = await store.install(bytes, manifest);
  cold.push(performance.now() - start);
  if (result.status !== 'installed') throw new Error(result.error);
  engine = result.engine;
}

function measure(run) {
  for (let i = 0; i < 1000; i++) run(i);
  return stats(Array.from({ length: 10000 }, (_, i) => {
    const start = performance.now();
    run(i);
    return performance.now() - start;
  }));
}

const words = ['incurred', 'running', 'went', 'better', 'phenomena', 'assumptions', 'credit', 'zzqxy'];
const text = 'They rolled back the rules over time.';
const scope = { articleId: 'vpn-privacy', paragraphId: 'vpn-privacy-B' };
const positions = ['rolled', 'back', 'over', 'time', 'rules'].map((word) => {
  const start = text.indexOf(word);
  return { start, end: start + word.length };
});
console.log(JSON.stringify({
  node: process.version, os: process.platform, arch: process.arch, dataVersion: manifest.dataVersion,
  entries: manifest.entryCount, senses: manifest.senseCount, dictionaryBytes: bytes.length,
  gzipBytes: gzipSync(bytes).length, coldIntegrityParseIndex: stats(cold),
  warmWordLookup: measure((i) => engine.lookupWord(words[i % words.length])),
  contextualLookup: measure((i) => engine.getContextualCandidates({ windowText: text, scope, anchor: positions[i % positions.length] })),
}, null, 2));
