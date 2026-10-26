import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
export async function verifyTranslationBundles(root) {
  let languages;
  try { languages = Object.keys(JSON.parse(await readFile(join(root, 'scripts/i18n/expansion-languages.json'), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; languages = ['zh','id','fr','es','pt']; }
  const manifest = JSON.parse(await readFile(join(root, 'scripts/i18n/translation-manifest.json'), 'utf8'));
  if (manifest.schema !== 'anacan-translation-bundles-v1' || manifest.languages.join(',') !== languages.join(',') || manifest.files.length !== languages.length * 2) throw new Error('TRANSLATION_BUNDLE_MANIFEST_INVALID');
  for (const language of languages) for (const kind of ['ui','content']) {
    const file = kind === 'ui' ? `scripts/i18n/${language}.seed.json` : `scripts/i18n/content/${language}.json`;
    const expected = manifest.files.find(item => item.language === language && item.kind === kind && item.file === file);
    const bytes = await readFile(join(root, file));
    if (!expected || expected.sha256 !== hash(bytes) || expected.bytes !== bytes.length) throw new Error('TRANSLATION_BUNDLE_HASH_MISMATCH');
    const data = JSON.parse(bytes);
    if (kind === 'content' && (data.schema !== 'anacan-content-translations-v1' || data.language !== language || data.sourceHash !== manifest.contentSourceHash)) throw new Error('TRANSLATION_CONTENT_MANIFEST_MISMATCH');
    const values = kind === 'content' ? data.values : data;
    if (!values || Object.keys(values).length !== expected.count
      || hash(Object.keys(values).sort().join('\n')) !== (kind === 'ui' ? manifest.uiKeysHash : manifest.contentBindingsHash)) throw new Error('TRANSLATION_BUNDLE_COVERAGE_MISMATCH');
  }
  let premiumRequired = false;
  try { await readFile(join(root, 'src/lib/premium-i18n.ts')); premiumRequired = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (premiumRequired) {
    const expected = manifest.publicPremiumCopy;
    if (expected?.file !== 'scripts/i18n/premium-copy.json') throw new Error('TRANSLATION_PREMIUM_MANIFEST_REQUIRED');
    const bytes = await readFile(join(root, expected.file)), copy = JSON.parse(bytes);
    const expectedLanguages = ['en','tr','ru','de','ar','ka','kk','uz',...languages];
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256 || copy.schema !== 'anacan-premium-copy-v1'
      || copy.languages.join(',') !== expectedLanguages.join(',') || Object.keys(copy.values || {}).length !== expected.bindings
      || Object.values(copy.values).some(values => expectedLanguages.some(language => typeof values[language] !== 'string' || !values[language].trim()))) throw new Error('TRANSLATION_PREMIUM_COPY_INVALID');
  }
  let regionalRequired = false;
  try { await readFile(join(root, 'src/lib/regional-i18n.ts')); regionalRequired = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (regionalRequired) {
    const expected = manifest.publicRegionalCopy;
    if (!expected || expected.languages?.length !== 21) throw new Error('TRANSLATION_REGIONAL_MANIFEST_REQUIRED');
    const bytes = await readFile(join(root, 'scripts/i18n/regional-copy.json')), copy = JSON.parse(bytes);
    const keys = Object.keys(copy.languages?.en || {});
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256 || copy.protocol !== 'anacan-regional-copy-v1'
      || keys.length !== expected.keys || expected.languages.some(language => Object.keys(copy.languages[language] || {}).sort().join(',') !== [...keys].sort().join(',')
        || keys.some(key => typeof copy.languages[language][key] !== 'string' || !copy.languages[language][key].trim()))) throw new Error('TRANSLATION_REGIONAL_COPY_INVALID');
  }
  const allLanguages = ['az','en','tr','ru','de','ar','ka','kk','uz',...languages];
  for (const [module, property, file, protocol, content] of [
    ['src/lib/followup-i18n.ts','publicFollowupCopy','followup36-copy.json','anacan-followup-copy-v1',false],
    ['src/lib/followup-content.ts','publicFollowupContent','followup36-content.json','anacan-followup-content-v1',true],
    ['src/lib/maternity-i18n.ts','publicMaternityCopy','maternity36-copy.json','anacan-maternity-copy-v1',false],
    ['src/lib/feature37-i18n.ts','publicFeature37Copy','feature37-copy.json','anacan-feature37-copy-v1',false],
  ]) {
    try { await readFile(join(root, module)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const expected = manifest[property];
    if (!expected || [...expected.languages].sort().join(',') !== [...allLanguages].sort().join(',')) throw new Error('TRANSLATION_FOLLOWUP_MANIFEST_REQUIRED');
    const bytes = await readFile(join(root, 'scripts/i18n', file)), copy = JSON.parse(bytes);
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256 || (content ? copy.schema : copy.protocol) !== protocol) throw new Error('TRANSLATION_FOLLOWUP_HASH_MISMATCH');
    if (content) {
      const valid = value => typeof value === 'string' ? !!value.trim() : Array.isArray(value) && value.length > 0 && value.every(valid);
      if (Object.keys(copy.values || {}).length !== expected.bindings || Object.values(copy.values).some(values => allLanguages.some(language => !valid(values[language])))) throw new Error('TRANSLATION_FOLLOWUP_CONTENT_INCOMPLETE');
    } else {
      const keys = Object.keys(copy.languages?.en || {}).sort();
      if (keys.length !== expected.keys || allLanguages.some(language => Object.keys(copy.languages[language] || {}).sort().join(',') !== keys.join(',') || keys.some(key => typeof copy.languages[language][key] !== 'string' || !copy.languages[language][key].trim()))) throw new Error('TRANSLATION_FOLLOWUP_COPY_INCOMPLETE');
    }
    if (property === 'publicMaternityCopy') {
      const policy = JSON.parse(await readFile(join(root, 'src/data/maternity-regional.json'), 'utf8'));
      const evidence = JSON.parse(await readFile(join(root, 'src/data/maternity-regional.references.json'), 'utf8'));
      if (expected.policySha256 !== hash(JSON.stringify(policy)) || !evidence.verified || evidence.policySha256 !== expected.policySha256
        || [...new Set(evidence.references.map(item => item.country))].sort().join(',') !== Object.keys(policy.countries).sort().join(',')) throw new Error('TRANSLATION_MATERNITY_REFERENCE_MISMATCH');
    }
  }
  return { verified: true, languages, uiSourceHash: manifest.uiSourceHash, contentSourceHash: manifest.contentSourceHash };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await verifyTranslationBundles(fileURLToPath(new URL('../../', import.meta.url))))); }
  catch (error) { console.error(JSON.stringify({ error: /^TRANSLATION_[A-Z0-9_]+$/.test(error.message) ? error.message : 'TRANSLATION_BUNDLE_NOT_READY' })); process.exitCode = 1; }
}
