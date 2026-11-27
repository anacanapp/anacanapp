#!/usr/bin/env node
// Sets the Status column of rows in docs/flutter/PARITY_MATRIX.md.
//   node app/tool/docs/set_matrix_status.mjs "<status>" <row id> [<row id> …]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/flutter/PARITY_MATRIX.md');
const [status, ...ids] = process.argv.slice(2);
if (!status || ids.length === 0) {
  console.error('usage: set_matrix_status.mjs "<status>" <row id>…');
  process.exit(2);
}
const lines = readFileSync(file, 'utf8').split('\n');
for (const id of ids) {
  const i = lines.findIndex((l) => l.startsWith(`| \`${id}\` |`));
  if (i < 0) {
    console.error(`row not found: ${id}`);
    process.exit(1);
  }
  const cells = lines[i].split(' | ');
  cells[cells.length - 1] = `${status} |`;
  lines[i] = cells.join(' | ');
}
writeFileSync(file, lines.join('\n'));
console.log(`${ids.length} row(s) → ${status}`);
