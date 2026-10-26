const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('supabase/migrations/*.sql');
const map = {};

files.forEach(f => {
  const t = fs.readFileSync(f, 'utf8');
  let currentTable = null;
  t.split('\n').forEach(l => {
    // Basic heuristics to match table and columns
    const ct = l.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)/i);
    if (ct) currentTable = ct[1];
    
    const at = l.match(/ALTER TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)/i);
    if (at) currentTable = at[1];
    
    if (currentTable) {
      const m = l.match(/(\w+_az)\s+(TEXT|VARCHAR|JSONB?|TEXT\[\])/i);
      if (m) {
        map[currentTable] = map[currentTable] || new Set();
        map[currentTable].add({ name: m[1], type: m[2] });
      }
    }
  });
});

const out = ['-- Auto-generated migration to add ru and tr equivalents for all az columns'];
for (const [t, cols] of Object.entries(map)) {
  out.push(`\n-- ${t}`);
  cols.forEach(c => {
    const b = c.name.replace('_az', '');
    const type = c.type.toUpperCase() === 'VARCHAR' ? 'TEXT' : c.type;
    out.push(`ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS ${b}_en ${type};`);
    out.push(`ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS ${b}_ru ${type};`);
    out.push(`ALTER TABLE public.${t} ADD COLUMN IF NOT EXISTS ${b}_tr ${type};`);
  });
}

fs.writeFileSync('supabase/migrations/20260721074500_add_all_ru_tr_translations.sql', out.join('\n'));
console.log('Successfully generated migration.');
