import fs from 'fs';
import path from 'path';

const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');
const content = fs.readFileSync(typesPath, 'utf-8');

const targetTables = [
  'trimester_tips',
  'weekly_tips',
  'affiliate_products',
  'baby_month_illustrations',
  'fairy_tales',
  'places_config',
  'banners'
];

const results = {};

targetTables.forEach(table => {
  const regex = new RegExp(`\\s+${table}:\\s+\\{\\s+Row:\\s+\\{([^}]+)\\}`);
  const match = content.match(regex);
  if (match) {
    const rowContent = match[1];
    const lines = rowContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    results[table] = lines;
  } else {
    results[table] = 'Not found';
  }
});

console.log(JSON.stringify(results, null, 2));
fs.writeFileSync('scratch/more_types_extracted.json', JSON.stringify(results, null, 2));
