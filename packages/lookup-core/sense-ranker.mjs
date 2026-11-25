import { gapAllowed } from './tokens.mjs';

const features = {
  organization: /^(?:compan(?:y|ies)|business(?:es)?|firms?|operations?|organizations?|departments?|shops?|stores?|offices?|schools?|factories|factory|agenc(?:y|ies)|campaigns?|restaurants?|enterprises?|banks?|newspapers?|newspaper|projects?|teams?|hotels?|clubs?|farms?|hospitals?)$/,
  equipment: /^(?:machine|engine|motor|car|radio|computer|pump|clock|software|program|train|equipment)s?$/,
  route: /^(?:road|route|street|railway|highway|trail|path|line|track|boundary|ridge|wall|fence|wire|cable)s?$/,
  distance: /^(?:miles?|kilomet(?:er|re)s?|meters?|metres?|yards?|laps?|marathon)$/,
  person: /^(?:he|she|we|they|i|you|man|woman|boys?|girls?|men|women|children|runners?|athletes?)$/,
};
const nonDiagnostic = new Set('a an and as at be but by do for from had has have he her him his i in into is it its of on or she that the their them they this to was we were with you'.split(' '));
const runSenses = {
  manage: '02517831', operate: '01577333', extend: '02768999', motion: '01986651', distance: '01975082',
};

function cluesForRun(left, right, separator, classes = {}) {
  function hasClass(key, name) {
    if (!key) return false;
    return features[name].test(key) || [key, key.replace(/ies$/, 'y'), key.replace(/s$/, '')]
      .some(form => Object.hasOwn(classes, form) && classes[form].includes(name));
  }
  const subject = left.slice(-5).filter(t => !/^(?:is|are|am|was|were|has|have|had|be|been|not|never|still|always|now|usually|may|might|will|would|can|could|should|must|did|do|does)$/.test(t.key)).at(-1)?.key;
  const object = right.slice(0, 5).find(t => !/^(?:the|an?|his|her|their|our|my|its|your|own|large|small|new|successful|local|family|entire|private)$/.test(t.key))?.key;
  const clues = [];
  function cue(condition, key, points, reason) {
    if (condition) clues.push([runSenses[key], key === 'distance' ? 'motion' : key, points, reason]);
  }
  cue(hasClass(object, 'organization'), 'manage', 8, 'organization as direct object');
  cue(hasClass(subject, 'equipment'), 'operate', 8, 'equipment as grammatical subject');
  cue(hasClass(subject, 'route'), 'extend', 8, 'geographical or linear subject');
  cue(hasClass(subject, 'route') && /^(?:along|through|between|from|across|north|south|parallel)$/.test(right[0]?.key),
    'extend', 2, 'spatial complement');
  cue(right.slice(0, 3).some(t => hasClass(t.key, 'distance')) && !hasClass(subject, 'route'),
    'distance', 8, 'distance complement');
  cue(hasClass(subject, 'person') && /^(?:away|home|outside|fast|quickly|down|toward|towards|across|back|past|upstairs|downstairs|forward|out)$/.test(right[0]?.key),
    'motion', 6, 'animate subject with motion complement');
  cue(/\d/.test(separator) && hasClass(right[0]?.key, 'distance'), 'distance', 2, 'numeric distance');
  return clues;
}

// Smoothed document-independent collocation evidence. Left/right positional
// features preserve direction, so a machine subject differs from an object.
function learnedEvidence(model, left, right) {
  if (!model) return new Map();
  const scores = new Map();
  for (const [sense, count] of Object.entries(model.counts)) {
    let score = Math.log((count + 1) / (model.examples + Object.keys(model.counts).length));
    let observed = 0;
    for (const [side, tokens] of [['L', left.slice(-5).reverse()], ['R', right.slice(0, 5)]]) {
      for (const [i, token] of tokens.entries()) {
        // Prefer a positional feature. Do not count the same word twice.
        const positional = i < 2 && model.features[side + (i + 1) + ':' + token.key];
        const feature = positional || model.features[side + ':' + token.key];
        if (!feature) continue;
        const total = Object.values(feature).reduce((sum, n) => sum + n, 0);
        const hits = feature[sense] ?? 0;
        const background = total / model.examples;
        score += Math.log(((hits + 2 * background) / (count + 2)) / background);
        if (hits) observed++;
      }
    }
    scores.set(sense, { score, observed });
  }
  return scores;
}

const semanticGroups = Object.fromEntries(Object.entries(runSenses).map(([label, id]) => [id, label === 'distance' ? 'motion' : label]));
semanticGroups['01576673'] = 'operate';

export function rankSenses(word, tokens, i, text, bestExpression) {
  const senses = word.matches.flatMap(({ entry }) => entry.senses.map(sense => ({
    entryId: entry.id, sense, score: 0, confidence: 'unresolved', evidence: [], semanticClass: null,
  })));
  let first = i;
  let last = i;
  const linked = (left) => {
    const gap = text.slice(tokens[left].end, tokens[left + 1].start);
    return gapAllowed(gap) || /^\s*\d+(?:\.\d+)?\s*$/.test(gap);
  };
  while (first > 0 && i - first < 6 && linked(first - 1) && !/^(and|but|because|while)$/.test(tokens[first - 1].key)) first--;
  while (last + 1 < tokens.length && last - i < 6 && linked(last) && !/^(and|but|because|while)$/.test(tokens[last + 1].key)) last++;
  const run = word.matches.find(({ entry }) => entry.id === 'oewn-2025:run')?.entry;
  let clues = [];
  if (/^(run|runs|ran|running)$/.test(tokens[i].key)) {
    clues = cluesForRun(tokens.slice(first, i), tokens.slice(i + 1, last + 1), text.slice(tokens[i].end, tokens[i + 1]?.start ?? tokens[i].end), run?.nounClasses);
  } else if (/^accounts?$/.test(tokens[i].key) && bestExpression?.entry.lemma === 'bank account') {
    clues = [['11227646', 'banking', 8, 'bank modifies account']];
  }
  for (const row of senses) {
    for (const [offset, group, points, reason] of clues) {
      if (!row.sense.id.startsWith('oewn-2025:') || !row.sense.id.endsWith(':' + offset)) continue;
      row.score += points;
      row.semanticClass = group;
      row.evidence.push(reason);
    }
  }
  const left = tokens.slice(first, i);
  const right = tokens.slice(i + 1, last + 1);
  const context = new Set([...left, ...right].map(t => t.key).filter(key => key.length > 2 && !nonDiagnostic.has(key)));
  for (const row of senses) {
    const glossWords = new Set((row.sense.definitionEn ?? '').toLowerCase().match(/[a-z]+/g) ?? []);
    const overlap = [...context].filter(key => glossWords.has(key));
    const matchedExamples = new Set();
    for (const { en } of row.sense.examples) {
      const words = en.toLowerCase().match(/[a-z]+/g) ?? [];
      for (const word of words) if (context.has(word)) matchedExamples.add(word);
    }
    if (matchedExamples.size) {
      row.score += Math.min(2, matchedExamples.size);
      row.evidence.push('dictionary example overlaps context: ' + [...matchedExamples].join(', '));
    }
    if (overlap.length) {
      row.score += Math.min(3, overlap.length);
      row.evidence.push('definition overlaps context: ' + overlap.join(', '));
    }
  }
  // Explicit syntactic constraints take priority over statistical backoff.
  if (run && !clues.length && left.length + right.length >= 2) {
    const learned = learnedEvidence(run.contextModel, left, right);
    const ranked = [...learned.entries()].sort((a, b) => b[1].score - a[1].score);
    const first = ranked[0];
    if (first && first[1].observed && first[1].score > (ranked[1]?.[1].score ?? 0) + 0.5) {
      const row = senses.find(item => item.sense.id === 'oewn-2025:run:verb:' + first[0]);
      if (row) {
        row.score += 4;
        row.evidence.push('SemCor collocations in disjoint training documents');
      }
    }
  }
  for (const row of senses) {
    if (row.sense.id.startsWith('oewn-2025:run:verb:')) {
      row.semanticClass = semanticGroups[row.sense.provenance.recordId.split(':')[1]] ?? 'other';
    }
  }
  senses.sort((a, b) => b.score - a.score);
  for (const row of senses) {
    if (!row.score) continue;
    const frame = clues.some(([offset]) => row.sense.id.startsWith('oewn-2025:') && row.sense.id.endsWith(':' + offset));
    row.confidence = frame && row === senses[0] && row.score - (senses[1]?.score ?? 0) >= 3 ? 'supported' : 'possible';
  }
  return senses;
}
