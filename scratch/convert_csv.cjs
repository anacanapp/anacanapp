const fs = require('fs');

const CSV_PATH = 'c:\\Users\\camil.sultanli\\translator-anacan\\mommy_daily_messages-export-2026-06-18_17-35-11.csv';
const OUT_PATH = 'c:\\Users\\camil.sultanli\\Desktop\\Ana-can\\anacanapp\\scratch\\mommy_daily_messages_comma.csv';

const content = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = content.split('\n');
const header = lines[0].trim().split(';');

console.log('Header fields:', header);

// Parse semicolon-separated CSV (with quoted fields)
function parseSemicolonCSV(content) {
  const lines = content.split('\n');
  const headerLine = lines[0].trim();
  const headers = headerLine.split(';');
  
  const rows = [];
  let currentRow = '';
  
  for (let i = 1; i < lines.length; i++) {
    currentRow += (currentRow ? '\n' : '') + lines[i];
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
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
    headers.forEach((h, idx) => {
      obj[h.trim()] = fields[idx] || '';
    });
    parsed.push(obj);
  }
  
  return { headers, rows: parsed };
}

const { headers, rows } = parseSemicolonCSV(content);
console.log(`Parsed ${rows.length} rows`);

// Only include id, day_number, message, message_en, is_active
const keepCols = ['id', 'day_number', 'message', 'message_en', 'is_active'];

// Convert to comma-separated CSV
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const outLines = [];
outLines.push(keepCols.join(','));

let withEn = 0;
for (const row of rows) {
  if (row.message_en && row.message_en.trim()) withEn++;
  const vals = keepCols.map(col => escapeCSV(row[col]));
  outLines.push(vals.join(','));
}

const outContent = outLines.join('\n');
fs.writeFileSync(OUT_PATH, outContent, 'utf-8');

console.log(`Written ${rows.length} rows to comma-separated CSV`);
console.log(`${withEn} rows have message_en`);
console.log(`Output: ${OUT_PATH}`);
console.log(`File size: ${(Buffer.byteLength(outContent) / 1024).toFixed(1)} KB`);
