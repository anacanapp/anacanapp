// Partner modulunun TAM i18n auditi
const fs = require('fs');
const path = require('path');

const az = JSON.parse(fs.readFileSync('src/locales/az.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('scripts/i18n/ru.seed.json', 'utf8'));
const trs = JSON.parse(fs.readFileSync('scripts/i18n/tr.seed.json', 'utf8'));

// Partner modulu faylları
const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(f)) files.push(p);
  }
}
walk('src/components/partner');
walk('src/components/partners');
for (const extra of ['src/hooks/usePartnerNotifications.ts', 'src/hooks/usePartnerSharing.ts', 'src/hooks/usePartnerVenues.ts', 'src/hooks/useSOSAlert.ts', 'src/components/PartnerPrivacyScreen.tsx']) {
  if (fs.existsSync(extra)) files.push(extra);
}

const used = new Set();
const hardcoded = [];
const moduleLevelTr = [];

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/tr\(\s*['"]([\w.]+)['"]/g)) used.add(m[1]);

  // Hardcoded AZ mətnlər (tr olmadan JSX-də): >Azərbaycanca söz< pattern
  const lines = s.split('\n');
  lines.forEach((l, i) => {
    // JSX text: >...ə/ı/ğ/ş/ç/ö/ü...< tr( olmadan
    const jsxText = l.match(/>([^<>{}]*[əğışçöüƏĞIŞÇÖÜ][^<>{}]*)</);
    if (jsxText && !l.includes('tr(') && jsxText[1].trim().length > 2 && !/^[\s·•—-]+$/.test(jsxText[1])) {
      hardcoded.push(`${f.replace(/\\/g, '/')}:${i + 1} :: ${jsxText[1].trim().slice(0, 60)}`);
    }
    // placeholder="Azərbaycanca" tr olmadan
    const ph = l.match(/placeholder=["']([^"']*[əğışçöü][^"']*)["']/);
    if (ph && !l.includes('tr(')) {
      hardcoded.push(`${f.replace(/\\/g, '/')}:${i + 1} :: [ph] ${ph[1].slice(0, 60)}`);
    }
  });

  // Modul-səviyyəli tr() tələləri: const X = [ / { ... tr( — komponentdən kənar
  const topLevel = s.match(/^const\s+[A-Z_]+[^=]*=\s*[\[{][\s\S]{0,80}tr\(/gm);
  if (topLevel) moduleLevelTr.push(`${f.replace(/\\/g, '/')} :: ${topLevel.length} konstant`);
}

const missAz = [...used].filter((k) => !az[k]);
const missEn = [...used].filter((k) => !en[k]);
const missRu = [...used].filter((k) => !ru[k]);
const missTr = [...used].filter((k) => !trs[k]);

console.log(`Fayl: ${files.length} | istifadə olunan açar: ${used.size}`);
console.log(`az.json-da yox: ${missAz.length} | en: ${missEn.length} | ru seed: ${missRu.length} | tr seed: ${missTr.length}`);
console.log('\n-- ru-missing (ilk 40):');
console.log(missRu.slice(0, 40).join('\n'));
console.log('\n-- Hardcoded AZ (tr-siz):', hardcoded.length);
console.log(hardcoded.slice(0, 30).join('\n'));
console.log('\n-- Modul-səviyyəli tr() konstantları:');
console.log(moduleLevelTr.join('\n'));

fs.writeFileSync('C:/Users/camil.sultanli/AppData/Local/Temp/opencode/partner-audit.json', JSON.stringify({ used: [...used], missRu, missTr, missEn, missAz, hardcoded, moduleLevelTr }, null, 1));
