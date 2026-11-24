import { validateDraft } from './schema.mjs';

const POS = { Noun: 'n.', Verb: 'v.', Adjective: 'adj.', Adverb: 'adv.', Pronoun: 'pron.', Preposition: 'prep.', Conjunction: 'conj.', Interjection: 'interj.' };

export function websiteDraft(input) {
  const record = validateDraft(input);
  const { target, content, metadata } = record;
  if (target === 'articles') {
    return {
      destination: 'Reading', draft: { title: content.title, author: content.author, published: content.published,
        sourceUrl: metadata.sourceUrl, blocks: content.blocks },
      review: ['Check publication rights separately.', 'Assign an article ID and paragraph anchors before using the public reading schema.'],
    };
  }
  const senses = content.meanings.flatMap(({ part, senses: group }) =>
    group.map((sense) => ({ partOfSpeech: Object.hasOwn(POS, part) ? POS[part] : part, meaningZh: sense.chinese,
      definitionEn: sense.english, examples: sense.examples.map(({ text, translation }) => ({ en: text, zh: translation })) })));
  if (target === 'word-meanings') {
    return { destination: 'Word Meanings', draft: { word: content.lemma || content.text, notes: content.note,
      senses: senses.map(({ examples, ...sense }) => ({ ...sense, example: examples[0] ?? { en: '', zh: '' } })) },
    review: ['Assign stable sense IDs and review each meaning before any separate publication.'] };
  }
  if (target === 'phrases') {
    return { destination: 'Phrases', draft: { phrase: content.text, meaningZh: senses[0]?.meaningZh ?? '',
      definitionEn: senses[0]?.definitionEn ?? '', examples: senses.flatMap((sense) => sense.examples) },
    review: ['Complete the usage fields and assign a stable entry ID before any separate publication.'] };
  }
  if (target === 'collocations') {
    return { destination: 'Collocations', draft: { phrase: content.text, meaningZh: senses[0]?.meaningZh ?? '',
      excerpt: metadata.excerpt, article: '', paragraph: '' },
    review: ['Supply a verified website article ID and paragraph anchor. The excerpt must belong to that paragraph.'] };
  }
  return { destination: 'Private Vocabulary', draft: { word: content.lemma || content.text, senses },
    review: ['Word Comparisons requires an explicitly curated group. Vocabulary remains in the private Inbox.'] };
}
