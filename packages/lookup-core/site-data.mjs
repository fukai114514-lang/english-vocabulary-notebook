import { constructions } from './constructions.mjs';
import { buildForms, explicitGrammar } from './forms.mjs';
import { normalizeExpression, normalizeToken } from './tokens.mjs';

const repository = 'https://github.com/fukai114514-lang/english-vocabulary-notebook';
const wordnet = 'https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition';

export const SOURCES = {
  'streusle-5': { name: 'STREUSLE v5.0 MWE annotation counts', url: 'https://github.com/nert-nlp/streusle/tree/8ba61fe4f216e7967500a862554a4fff79d25f5d', license: 'CC BY-SA 4.0', notice: 'STREUSLE-LICENSE.txt' },
  semcor: { name: 'Princeton SemCor, disjoint training documents', url: 'https://www.nltk.org/nltk_data/', license: 'Princeton Semantic Concordance license', notice: 'SEMCOR-LICENSE.txt' },
  site: { name: 'TAsLEXICON', url: repository, license: null, notice: null },
  'oewn-2025': {
    name: 'Open English Wordnet 2025 and Princeton WordNet',
    url: wordnet,
    license: 'CC BY 4.0 with Princeton WordNet notices',
    notice: 'OEWN-LICENSE.md',
  },
};

function pronunciation(ipa = {}, label = '') {
  const marked = label.match(/\/[^/]+\//u)?.[0];
  return [...Object.entries(ipa).filter(([, value]) => value).map(([accent, value]) => ({ accent, value })),
    ...(marked ? [{ accent: null, value: marked }] : [])];
}

function sense(id, data, provenance) {
  return {
    id, partOfSpeech: data.partOfSpeech || null, ipa: pronunciation(data.ipa, data.partOfSpeech),
    definitionEn: data.definitionEn || null, meaningZh: data.meaningZh || null,
    examples: (data.examples ?? []).map(({ en, zh }) => ({ en, zh: zh || null })),
    collocations: data.collocations ?? [], relatedWords: data.relatedWords ?? [],
    usageRegister: data.register || /正式|非正式|口语|俚语|书面|专业/.exec(data.partOfSpeech ?? '')?.[0] || null,
    provenance,
  };
}

export function adaptSiteData({ catalog, polysemy, search, articleWords, nap, phrases, contexts, collocations, oewn, runContext, multiword, nounClasses, expressionSupport }) {
  const entries = [];
  const indexById = new Map(search.records.map((record) => [record.id, record]));
  const wordsById = new Map(catalog.words.map((word) => [word.id, word]));
  const site = (file, recordId, href = null) => ({ sourceId: 'site', file, recordId, href });

  function add({ id, lemma, category, senses, provenance, ipa = [], scope = null, forms = [], relatedWords = [], groupIds = [] }) {
    const key = normalizeExpression(lemma);
    if (!key) throw new Error(`Invalid dictionary lemma: ${lemma} (${id})`);
    const kind = normalizeToken(key) ? 'word' : 'expression';
    const observed = oewn.grammar[key] ?? {};
    const morphology = scope || kind !== 'word' ? [] : buildForms(key, explicitGrammar(senses.map((item) => item.partOfSpeech), observed));
    entries.push({
      id, lemma, kind, category, scope, ipa, senses, groupIds, relatedWords, provenance,
      lexicalClasses: Object.keys(observed),
      inflectedForms: [...new Set([...morphology, ...forms])],
      morphologySourceId: Object.keys(observed).length && kind === 'word' && !scope ? 'oewn-2025' : null,
    });
  }

  for (const group of catalog.groups) {
    for (const [offset, row] of group.entries.entries()) {
      const word = wordsById.get(row.wordId ?? group.wordIds[offset]);
      const index = indexById.get(`comparison-${group.number}-${offset}`);
      const source = site('vocabulary.json', word.id, `index.html#${index.target}`);
      const id = `${group.id}:${word.id}`;
      const relatedWords = [...new Set([...word.relatedWords, ...group.wordIds.filter((other) => other !== word.id).map((other) => wordsById.get(other).lemma)])];
      add({ id, lemma: word.lemma, category: 'word-comparisons', groupIds: [group.id], relatedWords,
        ipa: pronunciation(word.ipa), provenance: source, senses: [sense(id, { ...word, ...row }, source)] });
    }
  }

  for (const row of polysemy.entries) {
    const id = `poly-${row.word}`;
    add({ id, lemma: row.word, category: 'word-meanings', provenance: site('polysemy.json', id, `index.html#${id}`),
      senses: row.senses.map((item) => sense(item.id, { ...item, examples: [item.example] },
        site('polysemy.json', item.id, `index.html#${item.id}`))) });
  }

  for (const [lemma, fields] of Object.entries(articleWords)) {
    const id = `article-word:${lemma}`;
    const source = site('article-dictionary.json', lemma);
    add({ id, lemma, category: 'article-dictionary', provenance: source,
      senses: [sense(id, { definitionEn: fields['英文释义'], meaningZh: fields['中文意思'], partOfSpeech: fields['词性'] }, source)] });
  }

  for (const [offset, [lemma, meaningZh, definitionEn, combinations]] of nap.vocabulary.entries()) {
    const id = `nap-word-${offset}`;
    const source = site('nap_article.json', `vocabulary/${offset}`, `nap.html#${id}`);
    add({ id, lemma, category: 'reading-vocabulary', provenance: source,
      senses: [sense(id, { meaningZh, definitionEn, collocations: combinations?.split(/;\s*/) }, source)] });
  }

  for (const [offset, [lemma, meaningZh]] of nap.phrases.entries()) {
    const id = `nap-phrase-${offset}`;
    const source = site('nap_article.json', `phrases/${offset}`, `nap.html#${id}`);
    add({ id, lemma, category: 'reading-phrases', provenance: source, senses: [sense(id, { meaningZh }, source)] });
  }

  for (const item of phrases.entries) {
    const source = site('phrases.json', item.id, `index.html#${item.id}`);
    add({ id: item.id, lemma: item.phrase, category: 'phrases', provenance: source, senses: [sense(item.id, item, source)] });
  }

  for (const [paragraphId, rows] of Object.entries(contexts)) {
    const articleId = paragraphId.slice(0, paragraphId.lastIndexOf('-'));
    for (const [surface, label, meaningZh, definitionEn] of rows) {
      const [partOfSpeech, base] = label.split(' · ');
      const lemma = normalizeExpression(base) ? base : surface;
      const id = `reading-context:${paragraphId}:${normalizeExpression(surface)}`;
      const source = site('reading-context.json', id, `${articleId}.html#${paragraphId}`);
      add({ id, lemma, category: 'reading-context', scope: { articleId, paragraphId }, provenance: source,
        forms: normalizeExpression(lemma) === normalizeExpression(surface) ? [] : [normalizeExpression(surface)],
        senses: [sense(id, { partOfSpeech, meaningZh, definitionEn }, source)] });
    }
  }

  for (const item of collocations.entries) {
    const paragraphId = `${item.article}-${item.paragraph}`;
    const id = `collocation:${paragraphId}:${normalizeExpression(item.phrase)}`;
    const source = site('learning-parts/collocations.json', id, `${item.article}.html#${paragraphId}`);
    add({ id, lemma: item.phrase, category: 'collocations', scope: { articleId: item.article, paragraphId }, provenance: source,
      senses: [sense(id, { meaningZh: item.meaningZh }, source)] });
  }

  const specialized = new Set(constructions.map(c => c.lemma));
  for (const [lemma, parts] of Object.entries({ ...oewn.extraEntries, ...multiword })) {
    if (specialized.has(lemma)) continue;
    const source = { sourceId: 'oewn-2025', file: 'WNDB', recordId: lemma, href: null };
    const senses = Object.entries(parts).flatMap(([part, rows]) => rows.map(([offset, definitionEn, examples]) => {
      const recordId = `${part}:${offset}`;
      return sense(`oewn-2025:${lemma}:${recordId}`, { partOfSpeech: part, definitionEn, examples: examples.map((en) => ({ en })) },
        { ...source, file: `data.${part}`, recordId });
    }));
    const [head, ...tail] = lemma.split(' ');
    const forms = tail.length && parts.verb ? buildForms(head, { verb: oewn.grammar[head]?.verb ?? [] })
      .map(form => [form, ...tail].join(' ')) : [];
    add({ id: `oewn-2025:${lemma}`, lemma, category: 'open-wordnet', provenance: source, senses, forms });
  }
  for (const item of constructions) {
    const source = site('packages/lookup-core/constructions.mjs', item.id);
    add({ id: item.id, lemma: item.lemma, category: item.category, provenance: source,
      senses: [sense(item.id, item, source)] });
  }
  const run = entries.find(entry => entry.id === 'oewn-2025:run');
  run.contextModel = runContext;
  run.nounClasses = nounClasses;
  for (const entry of entries) {
    const counts = expressionSupport.counts[entry.lemma];
    if (entry.category === 'open-wordnet' && Array.isArray(counts)) {
      entry.usageEvidence = { sourceId: expressionSupport.sourceId, annotated: counts[0], total: counts[1] };
    }
  }
  return entries;
}
