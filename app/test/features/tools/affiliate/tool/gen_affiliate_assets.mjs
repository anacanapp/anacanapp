// Copies the image fallback of the affiliate product page:
//   app/assets/affiliate/placeholder.svg ← public/placeholder.svg (AffiliateProductDetail `src || '/placeholder.svg'`)
// Run from the repository root:  node app/test/features/tools/affiliate/tool/gen_affiliate_assets.mjs [--check]
// --check writes nothing and exits 1 when the copy differs from its source.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const check = process.argv.includes('--check');
const files = new Map([['app/assets/affiliate/placeholder.svg', fs.readFileSync(path.join(root, 'public/placeholder.svg'))]]);

let drift = 0;
for (const [p, bytes] of files) {
  const target = path.join(root, p);
  const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
  if (current && current.equals(bytes)) continue;
  if (check) { console.error(`out of date: ${p}`); drift++; continue; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
if (check && drift) process.exit(1);
console.log(check ? 'up to date' : `checked ${files.size} files`);
