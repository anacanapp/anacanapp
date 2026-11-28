// Codemagic Flutter builds: generated-file freshness checks. Each generator runs with
// --check (it must exit non-zero when its committed output is stale) only once it exists,
// because the port tasks that own them may not have landed yet. When a generator imports
// packages from node_modules, `npm ci` runs once at the repository root first.
// Usage: node app/tool/codemagic/check_generated.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoDir = resolve(appDir, '..');
// Add new generators here: [path under app/, arguments]
const GENERATORS = [
  ['tool/design/gen_tokens.mjs', ['--check']],
  ['tool/i18n/export.mjs', ['--check']],
  ['tool/moderation/gen_moderator_copy.mjs', ['--check']],
  ['test/features/tools/play_together/tool/gen_play_content.mjs', ['--check']],
  ['test/features/blog/tool/gen_content_copy.mjs', ['--check']],
  ['test/features/tools/parenting/tool/gen_programme_data.mjs', ['--check']],
  ['test/features/tools/kid_exercises/tool/gen_kid_ex_content.mjs', ['--check']],
  ['test/features/tools/affiliate/tool/gen_affiliate_assets.mjs', ['--check']],
];

// Bare specifiers that are not node: built-ins ("from 'x'", "import('x')", "require('x')").
const needsPackages = source => [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)]
  .some(([, specifier]) => !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:'));

const present = GENERATORS.filter(([path]) => existsSync(resolve(appDir, path)));
for (const [path] of GENERATORS) if (!present.some(([p]) => p === path)) console.log(`skip ${path} (not in this commit)`);

if (present.some(([path]) => needsPackages(readFileSync(resolve(appDir, path), 'utf8')))
  && !existsSync(resolve(repoDir, 'node_modules'))) {
  console.log('npm ci (a generator imports from node_modules)');
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: repoDir, stdio: 'inherit' });
}

let failed = false;
for (const [path, args] of present) {
  console.log(`node app/${path} ${args.join(' ')}`);
  try {
    execFileSync(process.execPath, [resolve(appDir, path), ...args], { cwd: repoDir, stdio: 'inherit' });
  } catch {
    console.error(`Generated output is stale or the check failed: app/${path}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`Generated-file checks OK (${present.length} of ${GENERATORS.length} generators present).`);
