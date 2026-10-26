#!/usr/bin/env node
// az.source.json-dakı hər fəaliyyət kartından TAM MÜSTƏQİL image prompt qurur:
//   full_prompt = MASTER STYLE + SCENE (kartın öz prompt-u)
// Nəticə: image-prompts.json — generate-images.cjs bunu oxuyur; həm də
// istənilən başqa alətə (Midjourney və s.) kopyala-yapışdır üçün hazırdır.
//
// İşlətmə: node scripts/content-i18n/baby-activities/build-image-prompts.cjs

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const source = JSON.parse(fs.readFileSync(path.join(DIR, 'az.source.json'), 'utf8'));

// "MASTER STYLE (hər prompta əlavə olunur): " prefiksini at — modelə yalnız təmiz üslub mətni gedir
const master = source.meta.image_style_guide.replace(/^MASTER STYLE[^:]*:\s*/, '');

const out = [];
for (const band of source.age_bands) {
  if (!Array.isArray(band.activities)) continue;
  for (const act of band.activities) {
    if (!act.image_prompt) continue;
    out.push({
      id: act.id,
      band: band.id,
      title_az: act.title_az,
      full_prompt: `${master} SCENE: ${act.image_prompt}.`
    });
  }
}

const outPath = path.join(DIR, 'image-prompts.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`✓ ${out.length} prompt yazıldı → ${path.relative(process.cwd(), outPath)}`);
