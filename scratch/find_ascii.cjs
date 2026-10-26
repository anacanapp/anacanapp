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
      if (!file.includes('admin') && !file.includes('locales')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, i) => {
    // Skip lines that have tr(
    if (line.includes('tr(')) return;
    // Skip obvious comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
    
    // We are looking for Azerbaijani words in ASCII.
    // Let's identify lines with potential plain text.
    // e.g., >Some text< or placeholder="Some text"
    
    let hasPotentialText = false;
    
    // Pattern 1: >Text<
    const jsxTextMatch = line.match(/>([^<{]+)</);
    if (jsxTextMatch) {
       const text = jsxTextMatch[1].trim();
       if (text.length > 1 && /[a-zA-Z]/.test(text) && text !== '&nbsp;' && text !== '&mdash;') {
           hasPotentialText = true;
       }
    }
    
    // Pattern 2: placeholder="..."
    if (line.includes('placeholder="') || line.includes("placeholder='")) {
       hasPotentialText = true;
    }
    
    // Pattern 3: label="..."
    if (line.includes('label="') || line.includes("label='")) {
       hasPotentialText = true;
    }

    if (hasPotentialText) {
        console.log(f + ':' + (i+1) + ': ' + line.trim());
    }
  });
});
