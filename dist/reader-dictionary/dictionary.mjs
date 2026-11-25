import { normalizeExpression, normalizeToken } from './tokens.mjs';

export const coreVersion = '0.2.0';
export const schemaVersion = 1;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const present = (value) => typeof value === 'string' && value.trim().length > 0;
const optionalText = (value) => value === null || present(value);
const list = (values, check) => Array.isArray(values) && values.every(check);
const ipa = (value) => value && optionalText(value.accent) && present(value.value);
const example = (value) => value && present(value.en) && optionalText(value.zh);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireValid(condition, label) {
  if (!condition) throw new TypeError(`Invalid lookup dictionary: ${label}`);
}

export function validateDictionary(data) {
  requireValid(record(data) && data.schemaVersion === schemaVersion, 'unsupported schema version');
  requireValid(hash(data.dataVersion) && record(data.sources) &&
    Object.values(data.sources).length > 0 && Object.values(data.sources).every((source) =>
      record(source) && present(source.name) && present(source.url) && optionalText(source.license) &&
      optionalText(source.notice)), 'data revision or sources');

  const validProvenance = (value) => record(value) && Object.hasOwn(data.sources, value.sourceId) &&
    present(value.file) && present(value.recordId) &&
    (value.href === null || typeof value.href === 'string' && /^[a-z0-9-]+\.html#[a-z0-9-]+$/i.test(value.href));
  const entryIds = new Set();
  const senseIds = new Set();
  requireValid(Array.isArray(data.entries) && data.entries.length > 0, 'empty or invalid entries');
  for (const entry of data.entries) {
    const lemma = normalizeExpression(entry?.lemma);
    const kind = normalizeToken(lemma) ? 'word' : 'expression';
    requireValid(lemma && kind === entry.kind && present(entry.id) && present(entry.category) && !entryIds.has(entry.id), `entry ${entry?.id}`);
    entryIds.add(entry.id);

    const normalize = kind === 'word' ? normalizeToken : normalizeExpression;
    const scope = entry.scope;
    requireValid(list(entry.inflectedForms, (value) => present(value) && normalize(value) === value && value !== lemma) &&
      new Set(entry.inflectedForms).size === entry.inflectedForms.length &&
      (entry.lexicalClasses === undefined || list(entry.lexicalClasses, (part) => ['verb', 'noun', 'adj', 'adv'].includes(part))) &&
      list(entry.ipa, ipa) && list(entry.groupIds, present) && list(entry.relatedWords, present) &&
      (scope === null || record(scope) && present(scope.articleId) && present(scope.paragraphId)) &&
      (entry.morphologySourceId === null || Object.hasOwn(data.sources, entry.morphologySourceId)) &&
      validProvenance(entry.provenance), `metadata for ${entry.id}`);
    requireValid(Array.isArray(entry.senses) && entry.senses.length > 0, `senses for ${entry.id}`);
    if (entry.usageEvidence !== undefined) {
      const { sourceId, annotated, total } = entry.usageEvidence;
      requireValid(Object.hasOwn(data.sources, sourceId) && Number.isSafeInteger(annotated) &&
        Number.isSafeInteger(total) && annotated > 0 && annotated <= total, 'expression attestation');
    }
    if (entry.nounClasses !== undefined) {
      requireValid(record(entry.nounClasses) && Object.entries(entry.nounClasses).every(([word, groups]) =>
        /^[a-z]+(?:-[a-z]+)*$/.test(word) && list(groups, group =>
          ['organization', 'equipment', 'route', 'distance', 'person'].includes(group))), 'semantic noun classes');
    }
    if (entry.contextModel !== undefined) {
      const model = entry.contextModel;
      const positive = n => Number.isSafeInteger(n) && n > 0;
      requireValid(record(model) && Object.hasOwn(data.sources, model.sourceId) &&
        positive(model.documents) && positive(model.examples) && model.documents <= model.examples &&
        record(model.counts) && Object.entries(model.counts).every(([id, n]) => /^\d{8}$/.test(id) && positive(n)) &&
        Object.values(model.counts).reduce((a, b) => a + b, 0) === model.examples && record(model.features) &&
        Object.entries(model.features).every(([key, hits]) => /^[LR][12]?:[a-z'-]+$/.test(key) && record(hits) &&
          Object.entries(hits).every(([id, n]) => Object.hasOwn(model.counts, id) && positive(n) && n <= model.counts[id])),
      'context model for ' + entry.id);
    }
    for (const sense of entry.senses) {
      requireValid(record(sense) && present(sense.id) && !senseIds.has(sense.id) && validProvenance(sense.provenance) &&
        optionalText(sense.partOfSpeech) && optionalText(sense.usageRegister) && optionalText(sense.definitionEn) &&
        optionalText(sense.meaningZh) && (sense.definitionEn || sense.meaningZh) &&
        list(sense.ipa, ipa) && list(sense.examples, example) && list(sense.collocations, present) &&
        list(sense.relatedWords, present), `sense ${sense?.id} in ${entry.id}`);
      senseIds.add(sense.id);
    }
  }
  return data;
}

export function serializeDictionaryContent({ sources, entries }) {
  return JSON.stringify({ schemaVersion, sources, entries }) + '\n';
}

export async function readVerifiedDictionary(bytes, manifest, sha256) {
  requireValid(bytes instanceof Uint8Array && manifest?.schemaVersion === schemaVersion &&
    manifest.coreVersion === coreVersion && hash(manifest.dataVersion) &&
    hash(manifest.sha256) && manifest.bytes === bytes.byteLength, 'manifest or byte length');
  const expectedHash = manifest.sha256;
  const expectedVersion = manifest.dataVersion;
  const snapshot = new Uint8Array(bytes);
  requireValid(await sha256(snapshot) === expectedHash, 'SHA-256 mismatch');
  const data = validateDictionary(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(snapshot)));
  requireValid(data.dataVersion === expectedVersion, 'manifest data revision mismatch');
  const content = new TextEncoder().encode(serializeDictionaryContent(data));
  requireValid(await sha256(content) === expectedVersion, 'dictionary content revision mismatch');
  return data;
}
