import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDictionary } from '../build.mjs';
import { createLookupEngine } from '../index.mjs';

const rows = JSON.parse(await readFile(process.argv[2], 'utf8'));
const gold = (await readFile(new URL('./gold.jsonl', import.meta.url), 'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(rows.length, gold.length);
const { data } = await buildDictionary(fileURLToPath(new URL('../../../dist/', import.meta.url)));
const engine = createLookupEngine(data);
const detection = { tp: 0, fp: 0, fn: 0, tn: 0 };
const sense = { correct: 0, incorrect: 0, abstained: 0, byClass: {} };
const rankedSense = { correct: 0, incorrect: 0, abstained: 0 };
const errors = [];
const distribution = {};
const durations = [];

for (const [i, row] of rows.entries()) {
  const { text, ...metadata } = row;
  const hash = createHash('sha256').update(text).digest('hex');
  assert.deepEqual({ ...metadata, textSHA256: hash }, gold[i], 'Frozen annotation differs at ' + i);
  distribution[row.category] = (distribution[row.category] ?? 0) + 1;
  // Each occurrence is one observation. Require the same top lexical segmentation
  // from EVERY human-annotated lexical component (gaps are excluded from gold).
  const results = row.spans.map(([start, end]) => {
    const begin = performance.now();
    const out = engine.analyzeContext({ text, anchor: { start, end } });
    durations.push(performance.now() - begin);
    return out;
  });
  if (row.category === 'sense') {
    const top = results[0].senses[0];
    const prediction = top?.confidence === 'supported' ? top.semanticClass : null;
    const outcome = prediction === row.label ? 'correct' : prediction ? 'incorrect' : 'abstained';
    const ranked = top?.score > 0 ? top.semanticClass ?? 'other' : null;
    rankedSense[ranked === row.label ? 'correct' : ranked === null ? 'abstained' : 'incorrect']++;
    sense[outcome]++;
    const totals = sense.byClass[row.label] ??= { correct: 0, total: 0 };
    if (outcome === 'correct') totals.correct++;
    totals.total++;
    if (outcome !== 'correct') errors.push({ i, source: row.source, gold: row.label, prediction, ranked, outcome });
    continue;
  }
  const predictions = results.map(out => out.candidates[0]).map(c => c?.confidence === 'supported' ? c : null);
  const hit = predictions.every(c => c && c.entry.lemma === row.label &&
    JSON.stringify(c.components.map(({ start, end }) => [start, end])) === JSON.stringify(row.spans));
  if (row.label && hit) detection.tp++;
  else if (!row.label && !predictions.some(Boolean)) detection.tn++;
  else {
    if (row.label) detection.fn++;
    if (predictions.some(Boolean)) detection.fp++;
    errors.push({ i, source: row.source, gold: row.label, prediction: predictions.map(c => c?.entry.lemma ?? null), outcome: 'expression-error' });
  }
}

const { tp, fp, fn } = detection;
const total = sense.correct + sense.incorrect + sense.abstained;
durations.sort((a, b) => a - b);
console.log(JSON.stringify({
  core: '0.2.0', dataVersion: data.dataVersion, engine: process.version, platform: process.platform, arch: process.arch,
  distribution, detection, precision: tp / (tp + fp), recall: tp / (tp + fn), f1: 2 * tp / (2 * tp + fp + fn),
  supportedSense: sense, supportedCorrectOverAll: sense.correct / total, rankedSense, top1SenseAccuracy: rankedSense.correct / total,
  latencyMs: { anchors: durations.length, p50: durations[Math.ceil(durations.length / 2) - 1], p95: durations[Math.ceil(durations.length * 0.95) - 1] },
  errors,
}, null, 2));
