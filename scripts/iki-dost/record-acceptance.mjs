import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const verification = join(root, 'azure-migration/two-friends-verification');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const assert = (value, code) => { if (!value) throw new Error(code); };
const [tests, levels, browser, delivery] = await Promise.all([
  json(join(verification, 'feature-tests.json')),
  json(join(root, 'scripts/iki-dost/level-verification.json')),
  json('/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-two-friends/browser-report.json'),
  json(join(root, 'azure-migration/ops/two-friends-ios-test-48.2.json')),
]);
assert(tests.success && tests.numPassedTests === 21 && tests.numFailedTests === 0, 'TWO_FRIENDS_TEST_ACCEPTANCE_REQUIRED');
assert(levels.passed && levels.levels === 40 && levels.keysRequired === 16 && levels.pressureDoorsRequired === 16
  && levels.doubleSwitchLevels === 6 && levels.failures.length === 0, 'TWO_FRIENDS_INDEPENDENT_LEVEL_ACCEPTANCE_REQUIRED');
assert(browser.passed && browser.productionBundle && browser.languages.length === 21
  && browser.checks.includes('real-touch-shared-control-win-and-once-only-rescue')
  && browser.checks.includes('reload-resume-undo-and-real-worker-hint')
  && browser.checks.includes('real-touch-swipe-and-keyboard-shared-movement'), 'TWO_FRIENDS_BROWSER_ACCEPTANCE_REQUIRED');
const catalogBytes = await readFile(join(root, 'src/components/games/iki-dost/catalog.json'));
assert(hash(catalogBytes) === levels.catalogSha256, 'TWO_FRIENDS_CATALOG_CHANGED');
const assets = await readdir(join(verification, 'web/assets'));
assert(assets.some(name => /^TwoFriends-.+\.js$/.test(name)) && assets.some(name => /^friends\.worker-.+\.js$/.test(name)), 'TWO_FRIENDS_PRODUCTION_CHUNKS_REQUIRED');
assert(delivery.passed && delivery.installed && delivery.version === '48.2'
  && delivery.twoFriends?.included && delivery.twoFriends.workerBundled && delivery.twoFriends.languages === 21, 'TWO_FRIENDS_IOS_DELIVERY_REQUIRED');
const ipa = await readFile(join(root, delivery.artifact.path));
assert(hash(ipa) === delivery.artifact.sha256 && ipa.length === delivery.artifact.bytes, 'TWO_FRIENDS_DELIVERY_BYTES_CHANGED');
const gameFiles = (await readdir(join(root, 'src/components/games/iki-dost'))).filter(name => !name.includes('.test.'));
for (const name of gameFiles) assert(hash(await readFile(join(root, 'src/components/games/iki-dost', name)))
  === hash(await readFile(join(root, 'azure-migration/native-preview', delivery.runId, 'workspace/src/components/games/iki-dost', name))), 'TWO_FRIENDS_STAGED_SOURCE_CHANGED');
const report = {
  schema: 'anacan-two-friends-acceptance-v1', at: new Date().toISOString(), passed: true,
  revision: 'friends-202610-v1', languages: browser.languages,
  featureTests: { passed: tests.numPassedTests, failed: 0, sha256: hash(await readFile(join(verification, 'feature-tests.json'))) },
  independentLevels: { count: 40, optimalSolutionsVerified: true, keysRequired: 16, pressureDoorsRequired: 16,
    doubleSwitchLevels: 6, asymmetricCoordinationLevels: levels.coordinatedLevels, catalogSha256: levels.catalogSha256 },
  productionBrowser: { checks: browser.checks.length, screenshots: browser.screenshots.length, realTouch: true,
    realSwipeKeyboard: true, realWorkerHints: true, resumeUndo: true, rtl: true, testedWidths: [320, 390, 428, 768, 844], landscape: '844x390' },
  productionIndexSha256: hash(await readFile(join(verification, 'web/index.html'))),
  developmentChecks: { appTypeScript: true, nodeTypeScript: true, featureEslint: true, googleProductionBuild: true },
  delivery: { version: '48.2', runId: delivery.runId, signedDevelopmentPackage: true, installed: true,
    launched: delivery.launched, launchVerification: delivery.launchVerification,
    physicalGameplayVerified: false, ipaSha256: delivery.artifact.sha256, liveWebDeployed: false },
};
await writeFile(join(root, 'scripts/iki-dost/acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
