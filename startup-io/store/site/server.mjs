import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const pages = new Map();
for (const file of ['index.html', 'privacy.html', 'privacy-az.html', 'terms.html', 'terms-az.html', 'support.html', 'support-az.html']) {
  pages.set(`/${file}`, await readFile(new URL(`./${file}`, import.meta.url)));
}

createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const body = pages.get(pathname === '/' ? '/index.html' : pathname);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
  }
  if (!body) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Content-Length': body.length });
  response.end(request.method === 'HEAD' ? undefined : body);
}).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
