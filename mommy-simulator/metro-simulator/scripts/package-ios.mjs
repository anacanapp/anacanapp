import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const app = join(artifacts, 'ios-build2/Build/Products/Debug-iphoneos/MetroSimulator.app');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== 'com.atlasoon.metrosimulator' || info.CFBundleShortVersionString !== '1.1.0') throw new Error('Unexpected METRO app identity');
const pck = await readFile(join(artifacts, 'ios-v2/MetroSimulator.pck'));
const bundled = await readFile(join(app, 'MetroSimulator.pck'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(pck) !== hash(bundled)) throw new Error('METRO native pack differs from its signed app');
const stage = join(artifacts, 'ios-package-v2');
await mkdir(join(stage, 'Payload'), { recursive: true });
await cp(app, join(stage, 'Payload/MetroSimulator.app'), { recursive: true });
const ipa = join(artifacts, 'metro-simulator-1.1.0-ios-development.ipa');
execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', join(stage, 'Payload'), ipa], { stdio: 'pipe' });
const bytes = await readFile(ipa);
await writeFile(join(artifacts, 'ios-v2-package.json'), JSON.stringify({ at: new Date().toISOString(), file: 'metro-simulator-1.1.0-ios-development.ipa',
  version: info.CFBundleShortVersionString, build: info.CFBundleVersion, bundleId: info.CFBundleIdentifier,
  bytes: bytes.length, sha256: hash(bytes), signingVerified: true, pck: { bytes: pck.length, sha256: hash(pck), bundledParity: true },
}, null, 2) + '\n');
console.log(`METRO signed development IPA: ${ipa} (${bytes.length} bytes)`);
