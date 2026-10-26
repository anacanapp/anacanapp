const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('locales') && !file.includes('node_modules')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');

let output = [];
const azChars = /[əöğışçƏÖĞİŞÇ]/;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tr(') || line.includes('tr(')) return;
    if (azChars.test(line)) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
      if (line.includes('"') || line.includes("'") || line.includes('\`') || line.includes('>')) {
        output.push(f + ':' + (i+1) + ': ' + line.trim());
      }
    }
  });
});
fs.writeFileSync('hardcoded_all.txt', output.join('\n'));
console.log('Found', output.length, 'lines with hardcoded Az characters.');
