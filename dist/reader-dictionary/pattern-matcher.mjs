import { constructions } from './constructions.mjs';
import { gapAllowed } from './tokens.mjs';

const verbForms = {
  take: ['take', 'takes', 'took', 'taken', 'taking'],
  put: ['put', 'puts', 'putting'], pick: ['pick', 'picks', 'picked', 'picking'],
  come: ['come', 'comes', 'came', 'coming'], prevent: ['prevent', 'prevents', 'prevented', 'preventing'],
};
const pronouns = new Set('me you him her it us them myself himself herself themselves someone somebody something anyone anything people everyone'.split(' '));
const determiners = new Set('a an the this these that those my your his her its our their some any each all both'.split(' '));
const stops = new Set('of for to in into on from by with out at off up and but or nor than because if when while though is am are was were be been being will would should could may might must can did does do not never then i he she we they'.split(' '));
const directions = new Set('north south east west hill hills stairs upstairs river street road'.split(' '));
const sourceText = (tokens, a, b) => ({ start: tokens[a].start, end: tokens[b].end });

export function compilePatterns(byId) {
  const index = new Map();
  for (const item of constructions) {
    const entry = byId.get(item.id);
    if (!entry) continue;
    for (const pattern of item.patterns) {
      const [head, ...tail] = pattern.split(' ');
      for (const form of head.startsWith('@') ? verbForms[head.slice(1)] : [head]) {
        if (!index.has(form)) index.set(form, []);
        index.get(form).push({ entry, tail, base: head.replace('@', ''), pattern });
      }
    }
  }
  return index;
}

function nounEnds(tokens, start, pos) {
  const first = tokens[start];
  if (!first || stops.has(first.key)) return [];
  const ends = [];
  if (pronouns.has(first.key)) ends.push(start + 1);
  const hasDet = determiners.has(first.key);
  for (let i = start + Number(hasDet); i < Math.min(tokens.length, start + 5); i++) {
    const key = tokens[i].key;
    if (stops.has(key) || determiners.has(key) || pronouns.has(key)) break;
    const parts = pos(key);
    if (parts.has('noun') || (hasDet && !parts.size) || /^[A-Z]/.test(tokens[i].surface)) ends.push(i + 1);
    if (!parts.has('adj') && !parts.has('noun') && parts.size) break;
  }
  return [...new Set(ends)];
}

function expand(rule, tokens, start, pos) {
  const results = [];
  function step(index, part, fixed, slots) {
    if (part === rule.tail.length) {
      results.push({ end: index, fixed, slots });
      return;
    }
    if (index >= tokens.length) return;
    const key = tokens[index].key;
    const symbol = rule.tail[part];
    if (symbol === 'NP') {
      for (const end of nounEnds(tokens, index, pos)) {
        step(end, part + 1, fixed, [...slots, { role: 'object', ...sourceText(tokens, index, end - 1) }]);
      }
    } else if (symbol === 'GERUND') {
      const known = pos(key);
      const unverified = !known.size && /^[a-z]{3,}ing$/.test(key) && !/^(?:thing|ceiling|spring|string|morning|evening|during)$/.test(key);
      if (key.endsWith('ing') && (known.has('verb') || key === 'doing' || unverified)) {
        step(index + 1, part + 1, fixed, [...slots, { role: 'gerund', uncertain: unverified && key !== 'doing', ...sourceText(tokens, index, index) }]);
      }
    } else if (key === symbol) step(index + 1, part + 1, [...fixed, index], slots);
  }
  step(start + 1, 0, [start], []);
  return results;
}

// A particle followed by a location can instead introduce a directional phrase.
function semanticSupport(lemma, tokens, start, end, hasSlots) {
  const after = tokens[end]?.key;
  if (lemma === 'pick up' && directions.has(after)) return 'directional reading';
  if (lemma === 'put off' && hasSlots && determiners.has(after)) return 'possible prepositional complement';
  if (lemma === 'in light of' && tokens.slice(end, end + 4).some(t => /^(sun|moon|lamp|candle|fire)$/.test(t.key))) return 'possible literal light';
  if (lemma === 'come up with' && pronouns.has(after)) return 'possible accompaniment';
  return null;
}

export function anchoredPatterns(index, tokens, anchorIndex, text, pos) {
  const candidates = [];
  for (let start = Math.max(0, anchorIndex - 15); start <= anchorIndex; start++) {
    const rules = index.get(tokens[start].key);
    if (!rules) continue;
    let stop = start + 1;
    while (stop < tokens.length && stop < start + 16 && gapAllowed(text.slice(tokens[stop - 1].end, tokens[stop].start))) stop++;
    if (stop <= anchorIndex) continue;
    const local = tokens.slice(start, stop);
    for (const rule of rules) {
      for (const match of expand(rule, local, 0, pos)) {
        if (start + match.end <= anchorIndex) continue;
        const { entry } = rule;
        const ambiguity = semanticSupport(entry.lemma, tokens, start, start + match.end, match.slots.length > 0)
          || (match.slots.some(slot => slot.uncertain) ? 'unverified -ing complement' : null);
        const span = sourceText(local, 0, match.end - 1);
        const evidence = ['listed construction', rule.pattern];
        if (local[0].key !== rule.base) evidence.push('inflected head');
        if (match.slots.length) evidence.push('grammatical slots filled');
        if (ambiguity) evidence.push(ambiguity);
        candidates.push({ entry, span, surface: text.slice(span.start, span.end), tokenCount: match.end,
          reason: 'construction', confidence: ambiguity ? 'possible' : 'supported',
          score: ambiguity ? 45 : 84 + Math.min(5, match.slots.length * 2),
          evidence, components: match.fixed.map(i => sourceText(local, i, i)), slots: match.slots });
      }
    }
  }
  return candidates;
}
