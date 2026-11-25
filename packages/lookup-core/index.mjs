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

  function getContextualCandidates(input) {
    const { windowText, anchor, scope } = input ?? {};
    const valid = typeof windowText === 'string' && windowText.length <= 256 &&
      Number.isSafeInteger(anchor?.start) && Number.isSafeInteger(anchor?.end) &&
      anchor.start >= 0 && anchor.end >= anchor.start && anchor.end <= windowText.length;
    if (!valid) return freezeTree({ status: 'not-listed', candidates: [], wordFallback: invalid() });
    const tokens = tokenize(windowText);
    const index = tokens.findIndex(({ start, end }) => start <= anchor.start && anchor.start < end && anchor.end <= end);
    if (index === -1) return freezeTree({ status: 'not-listed', candidates: [], wordFallback: invalid() });
    const wordFallback = findWord(tokens[index].key);
    const candidates = [];

    let first = index;
    let last = index;
    const connected = (left) => gapAllowed(windowText.slice(tokens[left].end, tokens[left + 1].start));
    while (first > Math.max(0, index - 8) && connected(first - 1)) first--;
    while (last < Math.min(tokens.length - 1, index + 8) && connected(last)) last++;

    for (let start = first; start <= index; start++) {
      for (let end = index; end <= last && end - start < maxExpressionTokens; end++) {
        const span = { start: tokens[start].start, end: tokens[end].end };
        const key = tokens.slice(start, end + 1).map((token) => token.key).join(' ');
        const matches = end === start ? inScope(key, scope) : lookupExpression(key, scope).matches;
        for (const match of matches) {
          candidates.push({ ...match, span, surface: windowText.slice(span.start, span.end), tokenCount: end - start + 1 });
        }
      }
    }
    candidates.sort((a, b) => rank(a) - rank(b) || b.tokenCount - a.tokenCount ||
      a.span.start - b.span.start || Number(a.entry.id > b.entry.id) - Number(a.entry.id < b.entry.id));
    return freezeTree({ status: candidates.length || wordFallback.status === 'found' ? 'found' : 'not-listed', candidates, wordFallback });
  }

  return Object.freeze({
    dataVersion: dictionary.dataVersion, sources: dictionary.sources,
    lookupWord, normalizeToken, lemmatize, lookupExpression, getRelatedEntries, getContextualCandidates,
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
