import { compilePatterns, anchoredPatterns } from './pattern-matcher.mjs';
import { sentenceAt } from './sentence.mjs';
import { rankSenses } from './sense-ranker.mjs';
import { validateDictionary, readVerifiedDictionary } from './dictionary.mjs';
import { normalizeExpression, normalizeToken, tokenize, gapAllowed } from './tokens.mjs';

export { coreVersion, schemaVersion, validateDictionary } from './dictionary.mjs';
export { normalizeToken } from './tokens.mjs';

function freezeTree(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function insert(index, text, match) {
  if (!index.has(text)) index.set(text, []);
  index.get(text).push(match);
}

function makeIndexes(entries) {
  const words = new Map();
  const expressions = new Map();
  const scoped = new Map();
  let maxExpressionTokens = 1;
  for (const entry of entries) {
    const lemma = normalizeExpression(entry.lemma);
    if (entry.id.startsWith('construction:')) continue; // Grammar, including ambiguity checks, owns these contextual matches.
    const scope = entry.scope;
    let index = entry.kind === 'word' ? words : expressions;
    if (scope) {
      if (!scoped.has(scope.paragraphId)) scoped.set(scope.paragraphId, new Map());
      index = scoped.get(scope.paragraphId);
    }
    for (const [offset, key] of [lemma, ...entry.inflectedForms].entries()) {
      if (entry.kind === 'expression') maxExpressionTokens = Math.max(maxExpressionTokens, key.split(' ').length);
      insert(index, key, { entry, reason: scope ? entry.category : offset === 0 ? 'exact' : 'inflected' });
    }
  }
  return { words, expressions, scoped, maxExpressionTokens };
}

const functionWords = new Set('a an the at as and by for from in into of off on out up to with without it all some any this that one'.split(' '));
const commonContext = new Set('about also another are been being can could did does had has have here her his how its more most much must once one other our should some such than that the their them then there these they this those very was well were what when where which who will with would you your'.split(' '));

function lexicalSupport(entry, tokens, start, end, first, last) {
  const phrase = new Set(tokens.slice(start, end + 1).map(t => t.key));
  const near = [...tokens.slice(Math.max(first, start - 4), start), ...tokens.slice(end + 1, Math.min(last, end + 4) + 1)];
  const clues = [...new Set(near.map(t => t.key).filter(k => k.length >= 3 &&
    !phrase.has(k) && !commonContext.has(k) && !functionWords.has(k)))];
  if (!clues.length) return [];
  const words = new Set(entry.senses.flatMap(s => [s.definitionEn, ...s.examples.map(ex => ex.en)])
    .filter(Boolean).join(' ').toLowerCase().match(/[a-z]+/g));
  return clues.filter(k => words.has(k));
}

const ranks = { 'reading-context': 0, collocations: 1, exact: 2, inflected: 3 };
const rank = (match) => ranks[match.reason] ?? ranks.exact;
const result = (query, matches) => freezeTree({ status: matches.length ? 'found' : 'not-listed', query, matches });
const invalid = () => result(null, []);

function memoize(limit, compute) {
  const cache = new Map();
  return (key) => {
    if (cache.has(key)) {
      const cached = cache.get(key);
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const value = compute(key);
    cache.set(key, value);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return value;
  };
}

function buildEngine(data, { cacheSize = 256 } = {}) {
  if (!Number.isSafeInteger(cacheSize) || cacheSize < 0 || cacheSize > 4096) throw new RangeError('Invalid lookup cache size');
  const dictionary = freezeTree(data);
  const { words, expressions, scoped, maxExpressionTokens } = makeIndexes(dictionary.entries);
  const byId = new Map(dictionary.entries.map((entry) => [entry.id, entry]));
  const patterns = compilePatterns(byId);
  const lexicalClasses = memoize(256, (key) => new Set((words.get(key) ?? []).flatMap(({ entry }) => entry.lexicalClasses ?? [])));
  const constructionLemmas = new Map(dictionary.entries.filter(e => e.id.startsWith('construction:')).map(e => [e.lemma, e]));
  const findWord = memoize(cacheSize, (query) => result(query, [...words.get(query) ?? []].sort((a, b) => rank(a) - rank(b))));

  function lookupWord(text) {
    const query = normalizeToken(text);
    return query ? findWord(query) : invalid();
  }

  function lemmatize(text) {
    const lookup = lookupWord(text);
    const bases = lookup.matches.filter(({ reason }) => reason === 'inflected');
    return freezeTree({
      status: lookup.status, query: lookup.query,
      lemmas: [...new Set([...bases, ...lookup.matches].map(({ entry }) => normalizeExpression(entry.lemma)))],
    });
  }

  function inScope(query, scope) {
    if (!scope?.paragraphId) return [];
    return (scoped.get(scope.paragraphId)?.get(query) ?? []).filter(({ entry }) =>
      !scope.articleId || entry.scope.articleId === scope.articleId);
  }

  function lookupExpression(text, scope) {
    const query = normalizeExpression(text);
    if (!query) return invalid();
    const matches = [...inScope(query, scope), ...expressions.get(query) ?? []];
    const construction = constructionLemmas.get(query);
    if (construction) matches.push({ entry: construction, reason: 'exact' });
    return result(query, matches.filter(({ entry }) => entry.kind === 'expression').sort((a, b) => rank(a) - rank(b)));
  }

  function getRelatedEntries(entryId) {
    const entry = byId.get(entryId);
    if (!entry) return result(entryId ?? null, []);
    const related = new Set([...entry.relatedWords, ...entry.senses.flatMap((sense) => sense.relatedWords)]);
    const matches = new Map();
    for (const term of related) {
      for (const match of [...lookupWord(term).matches, ...lookupExpression(term).matches]) {
        if (match.reason === 'exact' && match.entry.id !== entryId) matches.set(match.entry.id, match);
      }
    }
    return result(entryId, [...matches.values()]);
  }

  function analyzeContext(input) {
    const { text, anchor, scope } = input ?? {};
    const sentence = sentenceAt(text, anchor);
    const empty = () => freezeTree({ status: 'not-listed', sentence, candidates: [], senses: [], wordFallback: invalid() });
    if (!sentence) return empty();
    const tokens = tokenize(sentence.text).map(token => ({
      ...token, surface: sentence.text.slice(token.start, token.end),
      start: token.start + sentence.start, end: token.end + sentence.start,
    }));
    const index = tokens.findIndex(({ start, end }) => start <= anchor.start && anchor.start < end && anchor.end <= end);
    if (index === -1) return empty();
    const wordFallback = findWord(tokens[index].key);
    const candidates = anchoredPatterns(patterns, tokens, index, text, lexicalClasses);

    let first = index;
    let last = index;
    const connected = (left) => gapAllowed(text.slice(tokens[left].end, tokens[left + 1].start));
    while (first > Math.max(0, index - 8) && connected(first - 1)) first--;
    while (last < Math.min(tokens.length - 1, index + 8) && connected(last)) last++;

    for (let start = first; start <= index; start++) {
      for (let end = index; end <= last && end - start < maxExpressionTokens; end++) {
        const span = { start: tokens[start].start, end: tokens[end].end };
        const key = tokens.slice(start, end + 1).map((token) => token.key).join(' ');
        const matches = [...inScope(key, scope), ...(end === start ? [] : expressions.get(key) ?? [])];
        for (const match of matches) {
          let score = { 'reading-context': 100, collocations: 92, exact: 80, inflected: 72 }[match.reason];
          const lexicalOnly = match.entry.category === 'open-wordnet';
          const clues = lexicalOnly ? lexicalSupport(match.entry, tokens, start, end, first, last) : [];
          const freq = match.entry.usageEvidence;
          const attested = freq && freq.annotated >= 3 && freq.annotated / freq.total >= 0.8;
          const weak = lexicalOnly && ((!clues.length && !attested) || key.split(' ').every(w => functionWords.has(w)) ||
            / (?:it|them|him|her)$/.test(key));
          if (lexicalOnly) score -= 10;
          if (weak) score = 40;
          candidates.push({ ...match, span, surface: text.slice(span.start, span.end), tokenCount: end - start + 1,
            components: tokens.slice(start, end + 1).map(({ start, end }) => ({ start, end })), slots: [],
            score, confidence: weak ? 'possible' : 'supported', evidence: [match.reason, match.entry.provenance.file,
              ...(attested ? [`STREUSLE training reviews: ${freq.annotated}/${freq.total} occurrences annotated`] : []),
              ...(clues.length ? ['nearby dictionary definition/example terms: ' + clues.join(', ')] : []),
              ...(weak ? ['dictionary form also permits a compositional reading'] : [])] });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score || b.tokenCount - a.tokenCount ||
      a.span.start - b.span.start || Number(a.entry.id > b.entry.id) - Number(a.entry.id < b.entry.id));
    const seen = new Set();
    const ranked = candidates.filter(candidate => {
      if (seen.has(candidate.entry.id)) return false;
      seen.add(candidate.entry.id);
      return true;
    });
    if (ranked.length > 1 && ranked[0].score === ranked[1].score &&
        ranked[0].tokenCount === ranked[1].tokenCount && ranked[0].entry.lemma !== ranked[1].entry.lemma) {
      for (const candidate of ranked.filter(c => c.score === ranked[0].score && c.tokenCount === ranked[0].tokenCount)) {
        candidate.confidence = 'possible';
        candidate.evidence.push('competing expression with equal evidence');
      }
    }
    const senses = rankSenses(wordFallback, tokens, index, text, ranked[0]);
    return freezeTree({ status: ranked.length || wordFallback.status === 'found' ? 'found' : 'not-listed',
      sentence, candidates: ranked, senses, wordFallback });
  }

  function getContextualCandidates(input) {
    return analyzeContext({ text: input?.windowText?.length <= 256 ? input.windowText : null,
      anchor: input?.anchor, scope: input?.scope });
  }

  return Object.freeze({
    dataVersion: dictionary.dataVersion, sources: dictionary.sources,
    lookupWord, normalizeToken, lemmatize, lookupExpression, getRelatedEntries, getContextualCandidates, analyzeContext,
  });
}

export function createLookupEngine(data, options) {
  return buildEngine(JSON.parse(JSON.stringify(validateDictionary(data))), options);
}

export function createDictionaryStore(sha256, options) {
  let current = null;
  let latest = 0;
  return Object.freeze({
    get current() { return current; },
    async install(bytes, manifest) {
      const request = ++latest;
      try {
        const data = await readVerifiedDictionary(bytes, manifest, sha256);
        if (request !== latest) return { status: 'superseded' };
        if (current?.dataVersion === data.dataVersion) return { status: 'unchanged', engine: current };
        const engine = buildEngine(data, options);
        current = engine;
        return { status: 'installed', engine };
      } catch (error) {
        if (request !== latest) return { status: 'superseded' };
        return { status: 'invalid-data', error: error.message };
      }
    },
  });
}
