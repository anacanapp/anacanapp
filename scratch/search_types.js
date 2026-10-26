import fs from 'fs';
import path from 'path';

const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');
const content = fs.readFileSync(typesPath, 'utf-8');

const targetTables = [
  'baby_milestones_db',
  'exercises',
  'white_noise_sounds',
  'photoshoot_themes',
  'surprise_ideas',
  'symptoms',
  'mood_options',
  'common_foods',
  'shop_categories'
];

const results = {};

targetTables.forEach(table => {
  // Let's find the section for the table under Tables: { ... }
  // We can look for table_name: { followed by Row: { ... }
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
fs.writeFileSync('scratch/types_extracted.json', JSON.stringify(results, null, 2));
