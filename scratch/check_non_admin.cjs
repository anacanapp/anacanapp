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
      if (!file.includes('locales') && !file.includes('node_modules') && !file.includes('admin')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('src');
const azChars = /[əöğışçƏÖĞİŞÇ]/;
let currentRemaining = 0;
files.forEach(f => {
  const fileContent = fs.readFileSync(f, 'utf8');
  const fileLines = fileContent.split('\n');
  fileLines.forEach((line, i) => {
    if (line.includes('tr(')) return;
    if (azChars.test(line)) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
      if (line.includes('"') || line.includes("'") || line.includes('`') || line.includes('>')) {
        console.log(f + ':' + (i+1) + ': ' + line.trim());
        currentRemaining++;
      }
    }
  });
});
console.log('Non-admin lines left:', currentRemaining);
