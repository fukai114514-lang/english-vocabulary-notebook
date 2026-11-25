import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildDictionary } from '../build.mjs';
import { coreVersion, createDictionaryStore, createLookupEngine, normalizeToken, validateDictionary } from '../index.mjs';
import { serializeDictionaryContent } from '../dictionary.mjs';
import packageJson from '../package.json' with { type: 'json' };

const dist = fileURLToPath(new URL('../../../dist/', import.meta.url));
const build = await buildDictionary(dist);
const engine = createLookupEngine(build.data);
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('normalizes case, punctuation, Unicode apostrophes, hyphens and accents', () => {
  for (const [input, expected] of [
    [' “INCURRED!” ', 'incurred'], ['WORK‑LIFE', 'work-life'], ['don’t', "don't"],
    ['“U.S.”', 'u.s.'], ['Este\u0301e', 'estée'], ['$5m', '$5m'],
    ['two words', null], ['t3st', null], ['contains_underscore', null], [undefined, null],
    ['a'.repeat(257), null],
  ]) assert.equal(normalizeToken(input), expected, String(input));
  assert.equal(engine.lookupWord('WORK‐LIFE').status, 'found');
  assert.equal(engine.lookupWord('Estée').status, 'found');
});

test('returns verified base forms for regular and irregular inflections', () => {
  for (const [input, base] of [
    ['INCURREd!', 'incur'], ['running', 'run'], ['went', 'go'], ['better', 'good'],
    ['phenomena', 'phenomenon'], ['assumptions', 'assumption'], ['policies', 'policy'],
    ['children', 'child'], ['books', 'book'], ['working', 'work'], ['worked', 'work'],
    ['simpler', 'simple'], ['largest', 'large'], ['go‑tos', 'go-to'],
  ]) {
    assert.equal(engine.lemmatize(input).lemmas[0], base, input);
    assert.ok(engine.lookupWord(input).matches.some(({ entry }) => entry.lemma === base), input);
  }
  assert.deepEqual(engine.lemmatize('better').lemmas, ['good', 'well', 'better']);
  assert.equal(engine.lookupWord('better').matches[0].entry.lemma, 'better');
  assert.equal(engine.lookupWord('went').matches[0].entry.lemma, 'went');
});

test('unknown queries and unavailable Chinese glosses have explicit states', () => {
  for (const word of ['qzblorp', 'runned', 'goed', 'bing', 'phenomenons', 'assumptioned']) {
    assert.deepEqual(engine.lookupWord(word), { status: 'not-listed', query: word, matches: [] });
    assert.deepEqual(engine.lemmatize(word).lemmas, []);
  }
  const senses = engine.lookupWord('incurred').matches[0].entry.senses;
  assert.ok(senses.every((sense) => sense.definitionEn && sense.meaningZh === null));
  assert.ok(senses.every((sense) => sense.provenance.sourceId === 'oewn-2025'));
  assert.equal(engine.lookupExpression('qz blorp').status, 'not-listed');
});

test('preserves every polysemy sense, its ordering, examples and deep link', () => {
  const { entries } = read('../../../dist/polysemy.json');
  for (const original of entries) {
    const match = engine.lookupWord(original.word).matches.find(({ entry }) => entry.id === `poly-${original.word}`);
    assert.equal(match.entry.senses.length, original.senses.length);
    for (let i = 0; i < original.senses.length; i++) {
      const before = original.senses[i];
      const after = match.entry.senses[i];
      for (const key of ['id', 'definitionEn', 'meaningZh', 'partOfSpeech']) assert.equal(after[key], before[key]);
      assert.deepEqual(after.examples, [before.example]);
      assert.equal(after.provenance.href, `index.html#${before.id}`);
    }
  }
  const live = engine.lookupWord('live').matches.find(({ entry }) => entry.id === 'poly-live').entry;
  assert.ok(live.senses.some((sense) => sense.ipa.some((ipa) => ipa.value === '/lɪv/')));
  const credit = engine.lookupWord('credit').matches.find(({ entry }) => entry.id === 'poly-credit').entry;
  assert.equal(credit.senses.find((sense) => sense.id === 'sense-credit-08').usageRegister, '正式');
});

test('preserves comparison associations, phrase IDs and local provenance', () => {
  const catalog = read('../../../dist/vocabulary.json');
  const phrases = read('../../../content/phrases.json');
  const index = read('../../../dist/search-index.json');
  const ids = new Map(build.data.entries.map((entry) => [entry.id, entry]));
  const rows = new Map(index.records.map((record) => [record.id, record]));
  const wordIds = new Map(catalog.words.map((word) => [word.id, word.lemma]));
  for (const group of catalog.groups) {
    for (const [offset, row] of group.entries.entries()) {
      const word = row.wordId ?? group.wordIds[offset];
      const entry = ids.get(`${group.id}:${word}`);
      assert.equal(entry.lemma, wordIds.get(word));
      assert.deepEqual(entry.groupIds, [group.id]);
      assert.equal(entry.provenance.recordId, word);
      assert.equal(entry.provenance.href, 'index.html#' + rows.get(`comparison-${group.number}-${offset}`).target);
      assert.deepEqual(entry.senses[0].examples, row.examples);
      assert.deepEqual(entry.senses[0].collocations, row.collocations);
    }
  }
  for (const phrase of phrases.entries) {
    const entry = ids.get(phrase.id);
    assert.equal(entry.provenance.href, 'index.html#' + phrase.id);
    assert.deepEqual(entry.senses[0].examples, phrase.examples);
  }
  const insert = engine.lookupWord('insert').matches.find(({ entry }) => entry.category === 'word-comparisons');
  assert.ok(engine.getRelatedEntries(insert.entry.id).matches.some(({ entry }) => entry.lemma === 'plug'));
  assert.equal(engine.getRelatedEntries('missing-entry').status, 'not-listed');
});

function anchored(text, word, scope, last = false, caret = false, lookup = engine) {
  const start = last ? text.lastIndexOf(word) : text.indexOf(word);
  return lookup.getContextualCandidates({ windowText: text, anchor: { start, end: caret ? start : start + word.length }, scope });
}

test('finds owned paragraph annotations from either word and preserves the exact span', () => {
  const text = 'Earlier they rolled back rules.';
  const scope = { articleId: 'vpn-privacy', paragraphId: 'vpn-privacy-B' };
  for (const word of ['rolled', 'back']) {
    const { candidates, wordFallback } = anchored(text, word, scope);
    assert.equal(candidates[0].entry.lemma, 'roll back');
    assert.equal(candidates[0].surface, 'rolled back');
    assert.deepEqual(candidates[0].span, { start: 13, end: 24 });
    assert.equal(wordFallback.query, word);
  }
  assert.deepEqual(anchored(text, 'rules', scope).candidates, []);
  assert.deepEqual(anchored(text, 'back').candidates, []);
  assert.deepEqual(anchored(text, 'back', { ...scope, articleId: 'wrong' }).candidates, []);
  assert.equal(engine.lookupExpression('rolled back').status, 'not-listed');
  assert.equal(engine.lookupExpression('rolled back', scope).matches[0].entry.provenance.href, 'vpn-privacy.html#vpn-privacy-B');
});

test('finds attested phrases on either side of the anchor and respects boundaries, UTF-16 and occurrences', () => {
  assert.equal(engine.lookupExpression(' “Over   TIME!” ').matches[0].entry.id, 'phrase-over-time');
  for (const text of ['overtime', 'over. time', 'over, time', 'over\ntime', 'over\u2028time', 'over timepiece', 'leftover time']) {
    const word = text.includes('timepiece') ? 'timepiece' : text === 'overtime' ? 'overtime' : 'time';
    assert.deepEqual(anchored(text, word).candidates, [], text);
  }
  const text = '🙂 time and over\u00a0time';
  const result = anchored(text, 'time', null, true, true);
  assert.equal(result.candidates[0].surface, 'over\u00a0time');
  assert.equal(result.candidates[0].span.start, text.indexOf('over'));
  assert.deepEqual(anchored(text, 'time').candidates, []);
  assert.equal(anchored(text.repeat(30), 'time').status, 'not-listed');
});

test('ranks overlapping entries and keeps same-rank alternatives', () => {
  const data = structuredClone(build.data);
  const original = data.entries.find((entry) => entry.id === 'phrase-over-time');
  for (const [id, lemma] of [['test-longer', 'improved over time'], ['test-same-span', 'over time']]) {
    data.entries.push({ ...original, id, lemma, senses: [{ ...original.senses[0], id }] });
  }
  const testEngine = createLookupEngine(data);
  const { candidates } = anchored('We improved over time.', 'over', null, false, false, testEngine);
  assert.deepEqual(candidates.map((value) => value.entry.id), ['test-longer', 'phrase-over-time', 'test-same-span']);
});

test('keeps a bounded cache of immutable results', () => {
  const small = createLookupEngine(build.data, { cacheSize: 1 });
  const old = small.lookupWord('credit');
  assert.equal(old, small.lookupWord(' CREDIT! '));
  assert.throws(() => old.matches[0].entry.senses.pop(), TypeError);
  small.lookupWord('incur');
  assert.notEqual(old, small.lookupWord('credit'));
  assert.throws(() => createLookupEngine(build.data, { cacheSize: -1 }), RangeError);
});

test('validates structural integrity and generates reproducible data with a matching notice hash', async () => {
  assert.equal(coreVersion, packageJson.version);
  const second = await buildDictionary(dist);
  assert.deepEqual(build.bytes, second.bytes);
  assert.deepEqual(build.manifest, second.manifest);
  assert.equal(build.manifest.notices[0].sha256, sha256(build.notice));
  assert.throws(() => validateDictionary({ ...build.data, schemaVersion: 999 }), /schema/);
  assert.throws(() => validateDictionary({ ...build.data, entries: [...build.data.entries, build.data.entries[0]] }), /entry/);
  const changed = { ...build.data.entries[1], senses: build.data.entries[0].senses };
  assert.throws(() => validateDictionary({ ...build.data, entries: [build.data.entries[0], changed] }), /sense/);
});

test('replaces data only after verifying bytes and retains the working cache after invalid updates', async () => {
  const store = createDictionaryStore(sha256);
  assert.equal(store.current, null);
  const installed = await store.install(build.bytes, build.manifest);
  assert.equal(installed.status, 'installed');
  const altered = Buffer.from(build.bytes);
  altered[20] ^= 1;
  assert.equal((await store.install(altered, build.manifest)).status, 'invalid-data');
  assert.equal((await store.install(build.bytes, { ...build.manifest, coreVersion: '7.0.0' })).status, 'invalid-data');
  assert.equal(store.current, installed.engine);
  assert.equal((await store.install(build.bytes, build.manifest)).status, 'unchanged');

  const next = structuredClone(build.data);
  next.entries[0].senses[0].usageRegister = 'test fixture';
  next.dataVersion = sha256(serializeDictionaryContent(next));
  const bytes = Buffer.from(JSON.stringify(next));
  const manifest = { ...build.manifest, dataVersion: next.dataVersion, bytes: bytes.length, sha256: sha256(bytes) };
  const forged = Buffer.from(JSON.stringify({ ...next, dataVersion: build.data.dataVersion }));
  const forgedManifest = { ...manifest, dataVersion: build.data.dataVersion, bytes: forged.length, sha256: sha256(forged) };
  assert.equal((await store.install(forged, forgedManifest)).status, 'invalid-data');
  assert.equal((await store.install(bytes, manifest)).status, 'installed');
  assert.equal(store.current.dataVersion, next.dataVersion);
  assert.notEqual(store.current.lookupWord('incur'), installed.engine.lookupWord('incur'));
  assert.equal((await store.install(build.bytes, build.manifest)).status, 'installed');
  assert.equal(store.current.dataVersion, build.data.dataVersion);
});

test('a superseded update cannot replace a newer snapshot', async () => {
  const pending = [];
  const store = createDictionaryStore((bytes) => bytes.length === build.bytes.length
    ? new Promise((resolve) => pending.push(() => resolve(sha256(bytes))))
    : sha256(bytes));
  const first = store.install(build.bytes, build.manifest);
  const second = store.install(build.bytes, build.manifest);
  pending[1]();
  assert.equal((await second).status, 'installed');
  pending[0]();
  assert.equal((await first).status, 'superseded');
  assert.equal(store.current.dataVersion, build.manifest.dataVersion);
});
