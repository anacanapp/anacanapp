const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\camil.sultanli\\.gemini\\antigravity-ide\\brain\\0f97cc3b-0607-462a-bb5d-560cd4a65ace\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('File does not exist:', logPath);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.source === 'USER_EXPLICIT' || obj.type === 'USER_INPUT') {
      console.log(`[Step ${obj.step_index}] USER: ${obj.content}`);
    }
  } catch (e) {
    // ignore
  }
});
