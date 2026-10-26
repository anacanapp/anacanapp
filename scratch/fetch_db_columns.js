import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching database tables list...');
  const { data: tables, error: tableError } = await supabase
    .from('database_tables')
    .select('table_name');
  
  if (tableError) {
    console.error('Error fetching tables (probably not admin):', tableError);
    // Since we are using anon key, has_role check will fail because we are not logged in as admin!
    // Wait, let's see if we can sign in or if we can fetch columns directly from pg_catalog or by selecting one row from each table and checking keys.
    // Yes! Let's query one row from each target table and inspect its keys! That does not require admin privileges!
    console.log('Falling back to querying 1 row from each table to inspect column names...');
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
    for (const table of targetTables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.error(`Error querying table ${table}:`, error.message);
          results[table] = { error: error.message };
        } else if (data && data.length > 0) {
          results[table] = { columns: Object.keys(data[0]) };
        } else {
          // If no rows, let's try to query with an empty filter to get columns but no rows
          results[table] = { columns: [], note: 'No rows found in table' };
        }
      } catch (err) {
        console.error(`Failed to query table ${table}:`, err);
        results[table] = { error: err.message };
      }
    }
    
    fs.writeFileSync('scratch/table_columns.json', JSON.stringify(results, null, 2));
    console.log('Saved columns to scratch/table_columns.json');
    return;
  }
  
  console.log('Tables:', tables.map(t => t.table_name));
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
