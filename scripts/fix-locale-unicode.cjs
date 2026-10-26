/**
 * Repairs broken unicode escape sequences that leaked into the bundled locale
 * files as literal text (e.g. the UI shows "\xB7" instead of "·", "\xB0C"
 * instead of "°C").
 *
 * Handles, inside every string value of az.json / en.json:
 *   - literal \xNN   (2-digit hex)   → the real character
 *   - literal \uNNNN (4-digit hex)   → the real character
 *
 * Run: node scripts/fix-locale-unicode.cjs
 */
const fs = require('fs');
const path = require('path');

const HEX2 = /\\x([0-9a-fA-F]{2})/g;
const HEX4 = /\\u([0-9a-fA-F]{4})/g;

function decode(value) {
  return value
    .replace(HEX4, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(HEX2, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fixes = [];
  for (const [key, value] of Object.entries(json)) {
    if (typeof value !== 'string') continue;
    if (HEX2.test(value) || HEX4.test(value)) {
      HEX2.lastIndex = 0;
      HEX4.lastIndex = 0;
      const fixed = decode(value);
      if (fixed !== value) {
        fixes.push({ key, before: value, after: fixed });
        json[key] = fixed;
      }
    }
    HEX2.lastIndex = 0;
    HEX4.lastIndex = 0;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${fixes.length} values repaired`);
  for (const f of fixes) {
    console.log(`  ${f.key}`);
    console.log(`    before: ${JSON.stringify(f.before)}`);
    console.log(`    after:  ${JSON.stringify(f.after)}`);
  }
}
