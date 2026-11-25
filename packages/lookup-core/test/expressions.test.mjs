import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLookupEngine } from '../index.mjs';
import { buildDictionary } from '../build.mjs';
import { tokenize } from '../tokens.mjs';

const { data } = await buildDictionary(fileURLToPath(new URL('../../../dist/', import.meta.url)));
const engine = createLookupEngine(data);

// User-specified acceptance strings, deliberately excluded from corpus metrics.
const required = [
  ['take into account', 'take into account'],
  ['take it for granted', 'take for granted'],
  ['in charge of', 'in charge of'], ['at odds with', 'at odds with'],
  ['by no means', 'by no means'], ['in light of', 'in light of'],
  ['put the meeting off', 'put off'], ['picked the book up', 'pick up'],
  ['prevent somebody from doing something', 'prevent somebody from doing something'],
  ['came up with', 'come up with'],
];

for (const [surface, lemma] of required) {
  test('any component of ' + surface, () => {
    const prefix = 'Another sentence. ';
    const text = prefix + surface + '. A third sentence.';
    for (const { start, end } of tokenize(surface)) {
      for (const width of [0, end - start]) {
        const point = prefix.length + start;
        const out = engine.analyzeContext({ text, anchor: { start: point, end: point + width } });
        assert.equal(out.sentence.text.trim(), surface + '.');
        const best = out.candidates[0];
        assert.equal(best?.entry.lemma, lemma, surface.slice(start, end));
        assert.equal(best.surface, surface);
        assert.deepEqual(best.span, { start: prefix.length, end: prefix.length + surface.length });
        assert.equal(best.confidence, 'supported');
        assert.ok(best.evidence.length > 1);
        assert.equal(out.wordFallback.query, surface.slice(start, end));
      }
    }
  });
}

function lookup(text, word, instance = engine) {
  const start = text.indexOf(word);
  return instance.analyzeContext({ text, anchor: { start, end: start + word.length } });
}
for (const [text, word, label] of [
  ['run a company', 'run', 'manage'], ['run five miles', 'run', 'motion'],
  ['a machine runs', 'runs', 'operate'], ['a road runs along the coast', 'runs', 'extend'],
  ['a bank account', 'account', 'banking'],
]) {
  test('contextual sense for ' + text, () => {
    const out = lookup(text, word);
    assert.equal(out.senses[0].semanticClass, label);
    assert.equal(out.senses[0].confidence, 'supported');
    assert.ok(out.senses[0].sense.provenance.recordId);
  });
}

test('literal readings, alternatives and a word fallback', () => {
  const finance = lookup('They take a bank account seriously.', 'account');
  assert.deepEqual(finance.candidates.map(c => c.entry.lemma), ['bank account']);
  const ambiguity = lookup('They pick flowers up north.', 'up');
  assert.ok(ambiguity.candidates.every(c => c.confidence === 'possible'));
  assert.equal(ambiguity.wordFallback.query, 'up');
  assert.equal(lookup('It runs.', 'runs').senses[0].confidence, 'unresolved');
  for (const text of ['She picked it. Up there!', 'They put it on the shelf and turned off the light.',
    'The charge of a particle varies.', 'With no means to leave.']) {
    const target = ['picked', 'put', 'charge', 'means'].find(word => text.includes(word));
    assert.deepEqual(lookup(text, target).candidates, []);
  }
});

test('scope and syntactic evidence outrank a longer generic expression', () => {
  const fixture = structuredClone(data);
  const original = fixture.entries.find(e => e.id === 'phrase-over-time');
  fixture.entries.push({ ...original, id: 'long-fixture', lemma: 'they came up with', senses: [{ ...original.senses[0], id: 'long-fixture-sense' }] });
  const out = lookup('They came up with a proposal.', 'up', createLookupEngine(fixture));
  assert.equal(out.candidates[0].entry.lemma, 'come up with');
  assert.equal(out.candidates[1].entry.id, 'long-fixture');
});

test('long blocks preserve original offsets and sentence boundaries', () => {
  const prefix = 'An earlier sentence. '.repeat(200);
  const text = prefix + '🙂 They took it into account. They left.';
  const out = lookup(text, 'account');
  assert.equal(out.sentence.start, prefix.length);
  assert.equal(out.candidates[0].surface, 'took it into account');
  assert.equal(out.candidates[0].span.start, text.indexOf('took'));
  assert.equal(out.candidates[0].components.length, 3);
  assert.equal(out.candidates[0].slots.length, 1);
});

test('argument class and weak morphological evidence carry different confidence', () => {
  assert.equal(lookup('A locomotive can run smoothly.', 'run').senses[0].semanticClass, 'operate');
  const phrase = lookup('They prevent him from flintering.', 'prevent').candidates[0];
  assert.equal(phrase.confidence, 'possible');
  assert.ok(phrase.evidence.includes('unverified -ing complement'));
  assert.ok(!lookup('They prevent him from the ceiling.', 'prevent').candidates.length);
  const ambiguous = lookup('They picked the flowers up north.', 'picked').candidates[0];
  assert.equal(ambiguous.confidence, 'possible');
  assert.ok(ambiguous.evidence.includes('directional reading'));
});
