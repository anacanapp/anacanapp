const fs = require('fs');
const path = require('path');

const commonAzWords = [
  'ana', 'ata', 'bala', 'su', 'yuxu', 'hava', 'kart', 'pul', 'ay', 'il', 'saat', 'dost', 'yol', 'son', 'ev', 
  'ayaq', 'burun', 'baba', 'nene', 'baci', 'tibb', 'qan', 'can', 'ruh', 'bu', 'biz', 'siz', 'onlar', 'kim', 
  'ne', 'hara', 'bura', 'ora', 'ol', 'et', 'ver', 'al', 'sat', 'yaz', 'oxu', 'dur', 'yat', 'qal', 'get', 'sil', 
  'ye', 'tut', 'at', 'sal', 'pis', 'dolu', 'uzun', 'yeni', 'isti', 'soyuq', 'az', 'tek', 'cavan', 'qoca', 
  'kirli', 'tez', 'gec', 'sabah', 'indi', 'sonra', 'lap', 'daha', 'yanvar', 'mart', 'aprel', 'may', 'iyul', 
  'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr', 'bir', 'iki', 'yeddi', 'doqquz', 'on', 'bazar', 'yox', 
  'sual', 'cavab', 'oyun', 'bitki', 'yemek', 'duz', 'istiot', 'bal', 'anacan', 'menyu', 'deq', 'san', 'kq', 
  'sm', 'ml', 'hefte', 'dekret', 'sanci'
];

// Create a regex to match these words as whole words
const azWordsRegex = new RegExp('\\b(' + commonAzWords.join('|') + ')\\b', 'i');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('locales') && !file.includes('admin')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
let findings = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    
    // Ignore comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    
    // Ignore imports/exports/requires
    if (trimmed.startsWith('import') || trimmed.startsWith('export') || trimmed.includes('require(')) return;
    
    // Ignore if it's already translated
    if (line.includes('tr(') || line.includes('t(')) return;
    
    // Search for string literals or JSX texts
    // Check if the line has quotes or JSX tags/brackets
    const hasString = line.includes('"') || line.includes("'") || line.includes('`') || line.includes('>') || line.includes('{');
    if (!hasString) return;
    
    // Test if any of the common AZ words are in the line
    if (azWordsRegex.test(line)) {
      // Exclude lines that are obviously just code/CSS/ Tailwind classes
      // ClassNames, tailwind styles, icons, console.logs, etc.
      if (line.includes('className=') || line.includes('class=') || line.includes('style=') || line.includes('console.')) return;
      if (trimmed.startsWith('const [') || trimmed.startsWith('const {')) return;
      
      // Let's filter out lines that contain typical English programming terms that might falsely trigger
      // e.g. "import", "from", "return", "query", "const", "let", "function", etc.
      // But keep them if they look like natural language
      findings.push({
        file: f,
        line: i + 1,
        text: trimmed
      });
    }
  });
});

fs.writeFileSync('hardcoded_az_no_special.txt', findings.map(fit => `${fit.file}:${fit.line}: ${fit.text}`).join('\n'));
console.log('Found', findings.length, 'potential lines.');
