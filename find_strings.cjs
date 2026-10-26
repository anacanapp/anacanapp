const fs = require('fs');
const path = require('path');
const azChars = /[əğışüöƏĞŞÜÖçÇ]/;

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
};

const files = walk('src');
let findings = [];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let lines = content.split('\n');
  lines.forEach((line, i) => {
    // Remove tr(...) and t(...)
    let cleanedLine = line.replace(/tr\([^)]+\)/g, '').replace(/t\(['"][^'"]+['"](?:,\s*[^)]+)?\)/g, '');
    
    // Check if the remaining line still has AZ characters
    if (azChars.test(cleanedLine)) {
      // Avoid comments
      if (!cleanedLine.trim().startsWith('//') && !cleanedLine.trim().startsWith('*')) {
         findings.push({ file: f, line: i + 1, text: line.trim() });
      }
    }
  });
});

fs.writeFileSync('untranslated_strings.json', JSON.stringify(findings, null, 2));
console.log('Found lines:', findings.length);
