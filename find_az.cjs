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
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = [
  ...walk('src/components/tools'),
  ...walk('src/components/baby'),
  ...walk('src/hooks'),
  ...walk('src/utils')
];

let output = [];
const azChars = /[əöğışçƏÖĞIŞÇ]/;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tr(')) return;
    if (azChars.test(line)) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
      if (line.includes('"') || line.includes("'") || line.includes('`') || line.includes('>')) {
        output.push(f + ':' + (i+1) + ': ' + line.trim());
      }
    }
  });
});
fs.writeFileSync('hardcoded_az.txt', output.join('\n'));
console.log('Found', output.length, 'lines with hardcoded Az characters.');
