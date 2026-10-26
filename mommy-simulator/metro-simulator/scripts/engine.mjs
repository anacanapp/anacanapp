import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const engine = process.env.GODOT_BIN || fileURLToPath(new URL('../../artifacts/engine/Godot.app/Contents/MacOS/Godot', import.meta.url));
const mode = process.argv[2] || 'test';
try { await stat(engine); } catch { throw new Error('Godot yoxdur. Enclosing directory: npm run engine:setup, or set GODOT_BIN.'); }
await mkdir(join(root, 'artifacts'), { recursive: true });
const run = (args, label) => {
  const result = spawnSync(engine, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 12 * 1024 * 1024 });
  const output = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(output);
  if (result.status !== 0 || /SCRIPT ERROR|Parse Error|SHADER ERROR|^ERROR:/m.test(output)) throw new Error(`${label} failed (${result.status}). ${result.error || ''}`);
  return output;
};
if (mode === 'dev') {
  const result = spawnSync(engine, ['--path', root], { stdio: 'inherit' });
  process.exit(result.status || 0);
}
run(['--headless', '--path', root, '--editor', '--import'], 'Godot resource import');
if (mode === 'test') {
  const output = run(['--headless', '--path', root, '--', '--self-test'], 'Metro acceptance');
  const line = output.split('\n').find(line => line.startsWith('METRO_ACCEPTANCE '));
  if (!line) throw new Error('Metro acceptance receipt missing');
  const report = JSON.parse(line.slice('METRO_ACCEPTANCE '.length));
  if (report.failures.length) throw new Error('Metro acceptance failed');
  await writeFile(join(root, 'artifacts/simulation-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`METRO: ${report.checks.length} simulation checks passed.`);
} else if (mode === 'build') {
  await mkdir(join(root, 'artifacts/web'), { recursive: true });
  run(['--headless', '--rendering-method', 'gl_compatibility', '--path', root, '--export-release', 'Web', join(root, 'artifacts/web/index.html')], 'Godot Web build');
  const files = [];
  for (const name of ['index.html', 'index.js', 'index.wasm', 'index.pck']) {
    const bytes = await readFile(join(root, 'artifacts/web', name));
    files.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await writeFile(join(root, 'artifacts/web-build.json'), JSON.stringify({ at: new Date().toISOString(), engine: 'Godot 4.7.2', version: '1.1.0', project: 'METRO Simulator', files }, null, 2) + '\n');
  console.log('METRO Web ready: metro-simulator/artifacts/web/index.html');
} else throw new Error(`Unknown engine operation: ${mode}`);
