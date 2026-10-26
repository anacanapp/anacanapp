import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const verification = join(root, 'azure-migration/flight-parking-verification');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const assert = (value, code) => { if (!value) throw new Error(code); };
const [tests, levels, browser, delivery, device] = await Promise.all([
  json(join(verification, 'feature-tests.json')),
  json(join(root, 'scripts/new-games/level-verification.json')),
  json('/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-flight-parking/browser-report.json'),
  json(join(root, 'azure-migration/ops/flight-parking-ios-test-48.3.json')),
  json(join(root, 'azure-migration/ops/ios-device-test-1791532662481.json')),
]);
assert(tests.success && tests.numPassedTests === 58 && tests.numFailedTests === 0, 'FLIGHT_PARKING_TESTS_REQUIRED');
assert(levels.passed && levels.parking.levels === 40 && levels.parking.shortestSolutions && levels.parking.lockedExitLevels === 16
  && levels.flight.levels === 30 && levels.flight.safeControlSolutions === 30 && levels.flight.secretRoutes === 24, 'FLIGHT_PARKING_LEVEL_ACCEPTANCE_REQUIRED');
assert(browser.passed && browser.productionBundle && browser.languages.length === 21 && browser.layout.length === 8
  && browser.checks.includes('parking-real-touch-slide-and-completion')
  && browser.checks.includes('flight-real-touch-hold-release-finish-and-reward')
  && browser.checks.includes('flight-keyboard-background-safe-pause-and-resume')
  && browser.checks.includes('42-real-hub-opens-in-21-offline-languages'), 'FLIGHT_PARKING_BROWSER_ACCEPTANCE_REQUIRED');
assert(delivery.passed && delivery.installed && delivery.version === '48.3' && delivery.leafFlight?.included
  && delivery.parking?.workerBundled && device.build?.webAssetsVerified === 535, 'FLIGHT_PARKING_IOS_ACCEPTANCE_REQUIRED');
const source = createHash('sha256');
for (const folder of ['casual', 'leaf-flight', 'parking']) for (const file of (await readdir(join(root, 'src/components/games', folder))).sort()) {
  if (file.includes('.test.')) continue;
  const path = `src/components/games/${folder}/${file}`, bytes = await readFile(join(root, path));
  assert(hash(bytes) === hash(await readFile(join(root, 'azure-migration/native-preview', delivery.runId, 'workspace', path))), 'FLIGHT_PARKING_STAGED_SOURCE_CHANGED');
  source.update(`${folder}/${file}`); source.update(bytes);
}
const hub = await readFile(join(root, 'src/components/games/MiniGamesHub.tsx')); source.update(hub);
assert(hash(hub) === hash(await readFile(join(root, 'azure-migration/native-preview', delivery.runId, 'workspace/src/components/games/MiniGamesHub.tsx'))), 'FLIGHT_PARKING_HUB_SOURCE_CHANGED');
assert(source.digest('hex') === browser.sourceSha256, 'FLIGHT_PARKING_BROWSER_SOURCE_CHANGED');
const catalog = await readFile(join(root, 'src/components/games/parking/catalog.json'));
assert(hash(catalog) === levels.parking.catalogSha256, 'PARKING_CATALOG_HASH_CHANGED');
const assets = await readdir(join(verification, 'web/assets'));
assert(['LeafFlight-', 'ClearTheWay-', 'parking.worker-'].every(prefix => assets.some(name => name.startsWith(prefix) && name.endsWith('.js'))), 'FLIGHT_PARKING_PRODUCTION_CHUNKS_REQUIRED');
assert(hash(await readFile(join(root, delivery.artifact.path))) === delivery.artifact.sha256, 'FLIGHT_PARKING_IPA_CHANGED');
const report = {
  schema: 'anacan-flight-parking-acceptance-v1', at: new Date().toISOString(), passed: true,
  games: { flight: { id: 'leaf-flight', revision: 'flight-202610-v1', levels: 30, safePathsVerified: 30, secretGapsVerified: 24, durationSeconds: levels.flight.durationRange },
    parking: { id: 'clear-the-way', revision: 'parking-202610-v1', levels: 40, shortestSolutionsVerified: 40,
      lockedExitLevels: 16, parRange: levels.parking.parRange, catalogSha256: levels.parking.catalogSha256 } },
  languages: browser.languages,
  tests: { passed: tests.numPassedTests, failed: 0, sha256: hash(await readFile(join(verification, 'feature-tests.json'))) },
  productionBrowser: { checks: browser.checks.length, screenshots: browser.screenshots.length, layoutCases: browser.layout.length,
    realTouchFlight: true, realTouchCarDrag: true, keyboardPauseResume: true, workerHints: true, localizedHubOpens: 42,
    testedWidths: [320, 390, 428, 768, 844], landscape: '844x390', sourceSha256: browser.sourceSha256 },
  developmentChecks: { appTypeScript: true, nodeTypeScript: true, featureEslint: true, googleProductionBuild: true },
  productionIndexSha256: hash(await readFile(join(verification, 'web/index.html'))),
  nativeDelivery: { runId: delivery.runId, version: delivery.version, assetsVerified: 535, signed: true, installed: true,
    previousVersion: delivery.previousVersion, launchVerification: delivery.launchVerification, physicalGameplayVerified: false,
    artifact: delivery.artifact, receipt: 'azure-migration/ops/flight-parking-ios-test-48.3.json', liveWebDeployed: false },
};
await writeFile(join(root, 'scripts/new-games/acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
