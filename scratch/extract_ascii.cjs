const fs = require('fs');
const content = fs.readFileSync('scratch/ascii_results.txt', 'utf16le');
let str = content;
if (str.includes('\ufffd') || !str.includes('src')) {
  str = fs.readFileSync('scratch/ascii_results.txt', 'utf8');
}
const lines = str.split('\n');
const items = new Set();
lines.forEach(line => {
  const parts = line.split(': ');
  if (parts.length > 1) {
    const text = parts.slice(1).join(': ').trim();
    if (text.startsWith('<') && text.includes('>')) {
      const match = text.match(/>([^<{]+)</);
      if (match) items.add(match[1].trim());
    } else if (text.startsWith('placeholder=')) {
      const match = text.match(/placeholder=[\"']([^\"']+)[\"']/);
      if (match) items.add(match[1].trim());
    } else {
      items.add(text);
    }
  }
});
fs.writeFileSync('scratch/ascii_unique.txt', Array.from(items).sort().join('\n'), 'utf8');
console.log('Saved', items.size, 'unique strings.');
