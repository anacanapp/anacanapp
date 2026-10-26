/** tool_configs tərcümələrində ölkə-spesifik təsvirləri düzəlt (names, maternity-calculator) */
const fs = require('fs');
const path = require('path');

const chunks = JSON.parse(fs.readFileSync(path.join(__dirname, 'chunks', 'tool_configs.json'), 'utf8'));
const namesRow = chunks.find((r) => r.tool_id === 'names');
const matRow = chunks.find((r) => r.tool_id === 'maternity-calculator');

const FIX = {
  ru: {
    [namesRow.id]: { description: 'Русские и популярные имена со значениями' },
    [matRow.id]: { description: 'Рассчитайте декретные выплаты по правилам выбранной страны' },
  },
  tr: {
    [namesRow.id]: { description: 'Türkçe ve popüler isimler arasından seçim yapın' },
    [matRow.id]: { description: 'Seçtiğiniz ülkenin kurallarına göre doğum izni ödeneğini hesaplayın' },
  },
};

for (const lang of ['ru', 'tr']) {
  const dir = path.join(__dirname, 'out', lang);
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    let d;
    try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const t = f.startsWith('_') ? d.tool_configs : (f === 'tool_configs.json' ? d : null);
    if (!t) continue;
    let changed = 0;
    for (const [id, patch] of Object.entries(FIX[lang])) {
      if (t[id]) { Object.assign(t[id], patch); changed++; }
    }
    if (changed) {
      fs.writeFileSync(p, JSON.stringify(d, null, 1), 'utf8');
      console.log(`✓ ${lang}/${f}: ${changed} tool təsviri yeniləndi`);
    }
  }
}
