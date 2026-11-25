import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreVersion, schemaVersion, serializeDictionaryContent, validateDictionary } from './dictionary.mjs';
import { adaptSiteData, SOURCES } from './site-data.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytesOf = (object) => JSON.stringify(object) + '\n';

export async function buildDictionary(dist) {
  const paths = {
    catalog: resolve(dist, 'vocabulary.json'), polysemy: resolve(dist, 'polysemy.json'),
    search: resolve(dist, 'search-index.json'), articleWords: resolve(dist, 'article-dictionary.json'),
    nap: resolve(dist, 'nap_article.json'), phrases: resolve(root, 'content/phrases.json'),
    contexts: resolve(root, 'content/reading-context.json'),
    collocations: resolve(root, 'content/learning-parts/collocations.json'),
    oewn: resolve(root, 'packages/lookup-core/data/oewn-2025.json'),
  };
  const inputs = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)]));
  const imported = Object.fromEntries(inputs.map(([key, bytes]) => [key, JSON.parse(bytes)]));
  const sources = SOURCES;
  const entries = adaptSiteData(imported);
  const dataVersion = sha256(serializeDictionaryContent({ sources, entries }));
  const data = validateDictionary({ schemaVersion, dataVersion, sources, entries });
  const bytes = Buffer.from(bytesOf(data));
  const notice = await readFile(new URL('./data/OEWN-LICENSE.md', import.meta.url));
  const manifest = {
    coreVersion, schemaVersion, dataVersion, sha256: sha256(bytes), bytes: bytes.byteLength,
    entryCount: entries.length, senseCount: entries.reduce((count, entry) => count + entry.senses.length, 0),
    inputSha256: Object.fromEntries(inputs.map(([key, bytes]) => [key, sha256(bytes)])),
    notices: [{ file: 'OEWN-LICENSE.md', sha256: sha256(notice) }],
  };
  return { data, bytes, manifest, notice };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dist, output] = process.argv.slice(2);
  if (!dist || !output) throw new Error('Usage: node build.mjs <site-dist> <dictionary-output>');
  const { bytes, manifest, notice } = await buildDictionary(dist);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'lookup-dictionary.json'), bytes);
  await writeFile(resolve(output, 'OEWN-LICENSE.md'), notice);
  await writeFile(resolve(output, 'lookup-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(manifest);
}
