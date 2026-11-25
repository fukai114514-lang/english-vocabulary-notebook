// Score the entire STREUSLE official test partition, including out-of-inventory MWEs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDictionary } from '../build.mjs';
import { createLookupEngine } from '../index.mjs';

const bytes = await readFile(process.argv[2]);
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'f8144e6227db2e845cda4aa832f8d5644cb40b9e743d1dbe05663dd687d2c70c');
const engine = createLookupEngine((await buildDictionary(fileURLToPath(new URL('../../../dist/', import.meta.url)))).data);
const sentences = JSON.parse(bytes);
let tp = 0, fp = 0, fn = 0;
const withSuggestions = { tp: 0, fp: 0, fn: 0 };
const errors = { spurious: [], spuriousIncludingSuggestions: [], missed: [] };
for (const row of sentences) {
  const text = row.toks.map(t => t.word).join(' ');
  let offset = 0;
  const spans = row.toks.map(t => {
    const span = { start: offset, end: offset + t.word.length };
    offset = span.end + 1;
    return span;
  });
  const key = (lemma, ranges) => JSON.stringify([lemma, ranges.map(r => [r.start, r.end])]);
  const expected = new Set([...Object.values(row.smwes), ...Object.values(row.wmwes)].map(m =>
    key(m.lexlemma, m.toknums.map(number => spans[number - 1]))));
  const predicted = new Set();
  const offered = new Set();
  for (const anchor of spans) {
    const candidate = engine.analyzeContext({ text, anchor }).candidates[0];
    if (candidate?.components.length > 1) offered.add(key(candidate.entry.lemma, candidate.components));
    if (candidate?.confidence === 'supported' && candidate.components.length > 1) {
      predicted.add(key(candidate.entry.lemma, candidate.components));
    }
  }
  for (const id of offered) {
    withSuggestions[expected.has(id) ? 'tp' : 'fp']++;
    if (!expected.has(id) && errors.spuriousIncludingSuggestions.length < 8) {
      errors.spuriousIncludingSuggestions.push([row.sent_id, JSON.parse(id)]);
    }
  }
  for (const id of expected) if (!offered.has(id)) withSuggestions.fn++;
  for (const id of predicted) {
    if (expected.has(id)) tp++;
    else {
      fp++;
      if (errors.spurious.length < 8) errors.spurious.push([row.sent_id, JSON.parse(id)]);
    }
  }
  for (const id of expected) if (!predicted.has(id)) {
    fn++;
    if (errors.missed.length < 8) errors.missed.push([row.sent_id, JSON.parse(id)]);
  }
}
const all = withSuggestions;
all.precision = all.tp / (all.tp + all.fp);
all.recall = all.tp / (all.tp + all.fn);
all.f1 = 2 * all.tp / (2 * all.tp + all.fp + all.fn);
console.log(JSON.stringify({ withSuggestions, sentences: sentences.length, tp, fp, fn, precision: tp / (tp + fp),
  recall: tp / (tp + fn), f1: 2 * tp / (2 * tp + fp + fn), examples: errors }, null, 2));
