const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tntbjulojatnrqmylorp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_PATH = 'c:\\Users\\camil.sultanli\\translator-anacan\\mommy_daily_messages-export-2026-06-18_17-35-11.csv';

function parseCSV(content) {
  const lines = content.split('\n');
  const header = lines[0].trim().split(';');
  
  const rows = [];
  let currentRow = '';
  
  for (let i = 1; i < lines.length; i++) {
    currentRow += (currentRow ? '\n' : '') + lines[i];
    
    // Count quotes to check if row is complete
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      // Row is complete
      if (currentRow.trim()) {
        rows.push(currentRow.trim());
      }
      currentRow = '';
    }
  }
  
  const parsed = [];
  for (const row of rows) {
    const fields = [];
    let field = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ';' && !inQuotes) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    
    const obj = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = fields[idx] || '';
    });
    parsed.push(obj);
  }
  
  return parsed;
}

async function main() {
  console.log('Reading CSV file...');
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`Parsed ${rows.length} rows from CSV`);
  
  // Filter rows that have message_en
  const withTranslation = rows.filter(r => r.message_en && r.message_en.trim());
  console.log(`${withTranslation.length} rows have message_en translations`);
  
  let success = 0;
  let failed = 0;
  const batchSize = 20;
  
  for (let i = 0; i < withTranslation.length; i += batchSize) {
    const batch = withTranslation.slice(i, i + batchSize);
    
    const promises = batch.map(async (row) => {
      const { error } = await supabase
        .from('mommy_daily_messages')
        .update({ message_en: row.message_en.trim() })
        .eq('id', row.id);
      
      if (error) {
        console.error(`  ❌ Day ${row.day_number}: ${error.message}`);
        return false;
      }
      return true;
    });
    
    const results = await Promise.all(promises);
    const batchSuccess = results.filter(r => r).length;
    success += batchSuccess;
    failed += results.length - batchSuccess;
    
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${batchSuccess}/${batch.length} updated (total: ${success}/${withTranslation.length})`);
  }
  
  console.log(`\n✅ Done! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
