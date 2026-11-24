export const FORMAT = 'taslexicon-collections';
export const SCHEMA_VERSION = 2;
export const MAX_FILE = 12 * 1024 * 1024;
export const MAX_RECORDS = 3000;
export const MAX_ARTICLE = 100_000;

export const TARGETS = Object.freeze({
  vocabulary: 'Vocabulary',
  phrases: 'Phrases',
  collocations: 'Collocations',
  'word-meanings': 'Word Meanings',
  articles: 'Articles',
});
export const SYNC_STATES = Object.freeze({
  'local-only': 'Local Only', pending: 'Pending', syncing: 'Syncing',
  synced: 'Synced', conflict: 'Conflict', failed: 'Failed',
});

export class CollectionError extends Error {
  constructor(message) { super(message); this.name = 'CollectionError'; }
}

function invalid(field) {
  throw new CollectionError(`Invalid or unsupported ${field}.`);
}

function recordObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid(field);
  }
  return value;
}

function text(value, limit, field, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) invalid(field);
  const result = value.trim();
  if (required && !result) invalid(field);
  return result;
}

function list(value, limit, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) invalid(field);
  return value;
}

function date(value, field) {
  const input = text(value, 32, field, true);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input)) invalid(field);
  const timestamp = new Date(input);
  if (!Number.isFinite(+timestamp) || timestamp.toISOString() !== input) invalid(field);
  return input;
}

export function safeUrl(value, { strip = false } = {}) {
  if (value === undefined || value === null || value === '') return '';
  const input = text(value, 2048, 'source URL', true);
  let url;
  try { url = new URL(input); } catch { invalid('source URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid('source URL');
  if (strip) { url.search = ''; url.hash = ''; }
  return url.href;
}

function normalizeAttribution(input) {
  const item = recordObject(input, 'attribution');
  return {
    name: text(item.name, 160, 'source name', true), url: safeUrl(item.url),
    license: text(item.license, 100, 'license'), licenseUrl: safeUrl(item.licenseUrl),
  };
}

function normalizeMeanings(input) {
  return list(input, 18, 'meaning groups').map((group) => {
    recordObject(group, 'meaning group');
    return {
      part: text(group.part, 80, 'part of speech', true),
      senses: list(group.senses, 8, 'senses').map((sense) => {
        recordObject(sense, 'sense');
        return {
          english: text(sense.english, 1500, 'English definition'),
          chinese: text(sense.chinese, 1500, 'Chinese definition'),
          examples: list(sense.examples, 5, 'examples').map((example) => {
            recordObject(example, 'example');
            return { text: text(example.text, 1500, 'example text', true), translation: text(example.translation, 1500, 'example translation') };
          }),
        };
      }),
    };
  });
}

function normalizeContent(type, value) {
  const input = recordObject(value, 'content');
  if (type === 'article') {
    let length = 0;
    const blocks = list(input.blocks, 600, 'article blocks').map((block) => {
      recordObject(block, 'article block');
      if (!['heading', 'paragraph', 'quote', 'list-item'].includes(block.type)) invalid('article block type');
      const content = text(block.text, 8000, 'article text', true);
      length += content.length;
      return { type: block.type, text: content };
    });
    if (!blocks.length || length > MAX_ARTICLE) invalid('article length');
    return {
      title: text(input.title, 300, 'article title', true), author: text(input.author, 200, 'article author'),
      published: text(input.published, 100, 'publication date'), blocks,
    };
  }

  const original = text(input.text, 360, 'selected expression', true);
  if (type === 'word' && /\s/u.test(original)) invalid('single word');
  return {
    text: original, lemma: text(input.lemma, 360, 'base form'),
    pronunciations: list(input.pronunciations, 10, 'pronunciations').map((item) => {
      recordObject(item, 'pronunciation');
      if (![null, 'GB', 'US'].includes(item.accent)) invalid('accent');
      return { ipa: text(item.ipa, 100, 'IPA', true), accent: item.accent };
    }),
    meanings: normalizeMeanings(input.meanings),
    note: text(input.note, 2000, 'private note'),
  };
}

function metadata(value = {}) {
  const input = recordObject(value, 'metadata');
  return {
    sourceUrl: safeUrl(input.sourceUrl, { strip: true }),
    excerpt: text(input.excerpt, 450, 'page excerpt'),
    attributions: list(input.attributions, 10, 'attributions').map(normalizeAttribution),
  };
}

function normalizeTags(value) {
  return [...new Set(list(value, 24, 'tags').map((tag) => text(tag, 50, 'tag', true)))];
}

export function validateDraft(value) {
  const input = recordObject(value, 'record');
  const { type, target } = input;
  if (!['word', 'expression', 'article'].includes(type)) invalid('content type');
  if (!Object.hasOwn(TARGETS, target) || (type === 'article') !== (target === 'articles')) invalid('collection type');
  if (type === 'expression' && target === 'word-meanings') invalid('collection type for an expression');
  return { type, target, content: normalizeContent(type, input.content), metadata: metadata(input.metadata), tags: normalizeTags(input.tags) };
}

export function validateRecord(value) {
  const source = recordObject(value, 'record');
  let input = source;
  if (source.schemaVersion === 1) {
    input = { ...source, schemaVersion: 2, target: source.category, syncStatus: source.syncStatus ?? 'local-only' };
  }
  if (input.schemaVersion !== SCHEMA_VERSION) invalid('record schema version');
  const id = text(input.id, 80, 'record ID', true);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/u.test(id)) invalid('record ID');
  const createdAt = date(input.createdAt, 'created date');
  const updatedAt = date(input.updatedAt, 'updated date');
  if (updatedAt < createdAt) invalid('update order');
  if (!Object.hasOwn(SYNC_STATES, input.syncStatus)) invalid('sync state');
  return { id, schemaVersion: SCHEMA_VERSION, ...validateDraft(input), createdAt, updatedAt, syncStatus: input.syncStatus };
}

export function recordTitle(record) {
  return record.type === 'article' ? record.content.title : record.content.text;
}

function normalized(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/gu, "'")
    .replace(/[‐‑]/gu, '-').replace(/\s+/gu, ' ').trim();
}

export function recordKey(record) {
  if (record.type === 'article') {
    const source = record.metadata.sourceUrl;
    return source ? `article:${source}:${normalized(recordTitle(record))}` : `article:${normalized(recordTitle(record))}:${normalized(record.content.blocks[0].text)}`;
  }
  return `term:${normalized(record.content.lemma || record.content.text)}`;
}

export function parseArchive(json) {
  if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > MAX_FILE) invalid('archive size');
  let archive;
  try { archive = JSON.parse(json); } catch { invalid('JSON archive'); }
  recordObject(archive, 'archive');
  if (archive.format !== FORMAT || ![1, SCHEMA_VERSION].includes(archive.schemaVersion)) invalid('archive version');
  if (!Array.isArray(archive.records) || archive.records.length > MAX_RECORDS) invalid('archive records');
  return archive.records.map((input, index) => {
    try { return { ...validateRecord(input), syncStatus: 'local-only' }; }
    catch (error) { throw new CollectionError(`Record ${index + 1}: ${error.message}`); }
  });
}

export function exportArchive(records) {
  if (records.length > MAX_RECORDS) invalid('archive count');
  const json = JSON.stringify({
    format: FORMAT, schemaVersion: SCHEMA_VERSION,
    records: records.map((value) => ({ ...validateRecord(value), syncStatus: 'local-only' })),
  });
  if (new TextEncoder().encode(json).byteLength > MAX_FILE) invalid('archive size');
  return json;
}

export function planImport(records, current) {
  const ids = new Map(current.map((record) => [record.id, record]));
  const keys = new Set(current.map(recordKey));
  const payload = (record) => JSON.stringify([record.type, record.target, record.content, record.metadata, record.tags]);
  return records.map((record) => {
    const key = recordKey(record);
    let action = 'add';
    if (ids.has(record.id)) action = payload(ids.get(record.id)) === payload(record) ? 'duplicate' : 'conflict';
    else if (keys.has(key)) action = 'duplicate';
    else { ids.set(record.id, record); keys.add(key); }
    return { record, action };
  });
}
