import { gunzipSync } from 'node:zlib';
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
    multiword: resolve(root, 'packages/lookup-core/data/oewn-expressions.json.gz'),
    expressionSupport: resolve(root, 'packages/lookup-core/data/expression-support.json'),
    nounClasses: resolve(root, 'packages/lookup-core/data/oewn-noun-classes.json.gz'),
    runContext: resolve(root, 'packages/lookup-core/data/run-context.json'),
    oewn: resolve(root, 'packages/lookup-core/data/oewn-2025.json'),
  };
  const inputs = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path)]));
  const imported = Object.fromEntries(inputs.map(([key, bytes]) => [key, JSON.parse(paths[key].endsWith('.gz') ? gunzipSync(bytes) : bytes)]));
  const sources = SOURCES;
  const entries = adaptSiteData(imported);
  const dataVersion = sha256(serializeDictionaryContent({ sources, entries }));
  const data = validateDictionary({ schemaVersion, dataVersion, sources, entries });
  const bytes = Buffer.from(bytesOf(data));
  const notice = await readFile(new URL('./data/OEWN-LICENSE.md', import.meta.url));
  const semcorNotice = await readFile(new URL('./data/SEMCOR-LICENSE.txt', import.meta.url));
  const streusleNotice = await readFile(new URL('./data/STREUSLE-LICENSE.txt', import.meta.url));
  const manifest = {
    coreVersion, schemaVersion, dataVersion, sha256: sha256(bytes), bytes: bytes.byteLength,
    entryCount: entries.length, senseCount: entries.reduce((count, entry) => count + entry.senses.length, 0),
    inputSha256: Object.fromEntries(inputs.map(([key, bytes]) => [key, sha256(bytes)])),
    notices: [{ file: 'OEWN-LICENSE.md', sha256: sha256(notice) }, { file: 'SEMCOR-LICENSE.txt', sha256: sha256(semcorNotice) },
      { file: 'STREUSLE-LICENSE.txt', sha256: sha256(streusleNotice) }],
  };
  return { data, bytes, manifest, notice, semcorNotice, streusleNotice };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dist, output] = process.argv.slice(2);
  if (!dist || !output) throw new Error('Usage: node build.mjs <site-dist> <dictionary-output>');
  const { bytes, manifest, notice, semcorNotice, streusleNotice } = await buildDictionary(dist);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'lookup-dictionary.json'), bytes);
  await writeFile(resolve(output, 'OEWN-LICENSE.md'), notice);
  await writeFile(resolve(output, 'SEMCOR-LICENSE.txt'), semcorNotice);
  await writeFile(resolve(output, 'STREUSLE-LICENSE.txt'), streusleNotice);
  await writeFile(resolve(output, 'lookup-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(manifest);
}
