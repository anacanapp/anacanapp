import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await access(path.join(root, 'artifacts'));
const { code } = await transform(await readFile(path.join(root, 'src/game/fictional-brands.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
const { BRANDS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
if (BRANDS.length !== 48 || new Set(BRANDS.map(brand => brand.path)).size !== 48 || new Set(BRANDS.map(brand => brand.logo)).size !== 48) throw new Error('48 original unique identities required');
const output = path.join(root, 'artifacts/brand-identity'); await mkdir(output, { recursive: true });
const tiles = BRANDS.map((brand, index) => {
  const x = index % 6 * 180; const y = Math.floor(index / 6) * 130;
  return `<g transform="translate(${x} ${y})"><rect x="8" y="8" width="164" height="114" rx="14" fill="#1a2b3b"/><g transform="translate(72 23) scale(1.5)"><path d="${brand.path}" fill="${brand.color}" fill-rule="evenodd"/></g><text x="90" y="85" text-anchor="middle" fill="#d9e8ed" font-family="sans-serif" font-size="11">${brand.name}</text><text x="90" y="104" text-anchor="middle" fill="#8ca7b3" font-family="sans-serif" font-size="9">${index + 1} · ${brand.sector} · ${brand.strategy}</text></g>`;
});
await writeFile(path.join(output, 'venture-city-brands.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1040"><rect width="1080" height="1040" fill="#0d1823"/>${tiles.join('')}</svg>`);
await writeFile(path.join(output, 'roster.json'), JSON.stringify(BRANDS, null, 2) + '\n');
console.log('Verified 48 original Venture City identities and generated their contact sheet.');
