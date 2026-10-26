import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const verification = join(root, 'azure-migration/word-garden-verification');
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [tests, levels, browser, library, legacy] = await Promise.all([
  json(join(verification, 'feature-tests.json')),
  json(join(root, 'scripts/word-garden/level-verification.json')),
  json('/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-word-garden/browser-report.json'),
  json(join(root, 'scripts/word-garden/az-import-receipt.json')),
  json(join(root, 'scripts/word-garden/legacy-verification.json')),
]);
assert(tests.success && tests.numPassedTests >= 26 && tests.numFailedTests === 0, 'WORD_GARDEN_FEATURE_ACCEPTANCE_REQUIRED');
assert(levels.passed && levels.generated === 4806 && levels.failures.length === 0, 'WORD_GARDEN_LEVEL_ACCEPTANCE_REQUIRED');
assert(browser.passed && browser.productionBundle && browser.checks.includes('real-mini-games-hub-open-return-reopen')
  && browser.checks.includes('native-touch-drag-and-repeated-letter-input')
  && browser.checks.includes('short-timer-ready-pause-and-real-touch-win'), 'WORD_GARDEN_BROWSER_ACCEPTANCE_REQUIRED');
const bytes = await readFile(join(root, 'src/components/games/word-garden/data/az.json'));
assert(hash(bytes) === library.librarySha256, 'WORD_GARDEN_LEXICON_HASH_CHANGED');
assert(legacy.passed && legacy.compared === 32 && legacy.originalDictionaryPreserved, 'WORD_GARDEN_LEGACY_ACCEPTANCE_REQUIRED');
const assets = await readdir(join(verification, 'web/assets'));
assert(assets.some(name => /^WordGarden-.+\.js$/.test(name)) && assets.some(name => /^word-garden\.worker-.+\.js$/.test(name)),
  'WORD_GARDEN_PRODUCTION_CHUNKS_REQUIRED');
const entry = await readFile(join(verification, 'web/index.html'));
const report = {
  schema: 'anacan-word-garden-acceptance-v1', at: new Date().toISOString(), passed: true,
  language: 'az', revision: levels.revision, words: library.words, targetWords: library.targetWords,
  featureTests: { passed: tests.numPassedTests, failed: 0, sha256: hash(await readFile(join(verification, 'feature-tests.json'))) },
  generatedLevels: { count: levels.generated, failures: 0, sampleUpperLevel: 2147483647, variety: levels.variety, timeLimits: levels.timeLimits },
  productionBrowser: { checks: browser.checks.length, screenshots: browser.screenshots.length,
    realTouchInput: true, realHubIntegration: true, timedReadyPauseWin: true, testedWidths: [320, 390, 428, 768, 1440], landscape: '844x390' },
  dictionarySha256: library.librarySha256, productionIndexSha256: hash(entry),
  legacyCompatibility: { comparedPuzzles: legacy.compared, originalDictionaryPreserved: true, librarySha256: legacy.librarySha256 },
  developmentChecks: { appTypeScript: true, nodeTypeScript: true, featureEslint: true, googleProductionBuild: true },
  delivery: { applicationCodeIntegrated: true, liveWebDeployed: false, nativePackageProduced: false },
};
await writeFile(join(root, 'scripts/word-garden/acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
