import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../artifacts/native-world-web/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.pck': 'application/octet-stream', '.json': 'application/json' };
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:5178');
  const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(root.replace(/\/$/, '') + sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
}).listen(5178, '0.0.0.0', () => console.log('Native 3D browser preview: http://localhost:5178'));
