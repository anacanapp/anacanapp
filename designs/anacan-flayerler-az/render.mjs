import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { chromium } from '@playwright/test';
import { DESTINATION, FLYERS, makeFlyer, PRINT_HEIGHT, SOCIAL_HEIGHT, WIDTH } from './konseptler.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(here, 'hazir');
const assert = (value, message) => { if (!value) throw new Error(message); };
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function table(font, tag) {
  const count = font.readUInt16BE(4);
  for (let index = 0; index < count; index++) {
    const offset = 12 + index * 16;
    if (font.toString('ascii', offset, offset + 4) === tag) return font.readUInt32BE(offset + 8);
  }
  throw new Error(`Şrift cədvəli tapılmadı: ${tag}`);
}
function fontCopyright(font) {
  const base = table(font, 'name'), count = font.readUInt16BE(base + 2), strings = base + font.readUInt16BE(base + 4);
  for (let index = 0; index < count; index++) {
    const offset = base + 6 + index * 12;
    if (font.readUInt16BE(offset + 6) !== 0 || ![0, 3].includes(font.readUInt16BE(offset))) continue;
    const bytes = Buffer.from(font.subarray(strings + font.readUInt16BE(offset + 10), strings + font.readUInt16BE(offset + 10) + font.readUInt16BE(offset + 8)));
    if (bytes.length % 2 === 0) return bytes.swap16().toString('utf16le');
  }
  return 'Noto Sans — Noto Project Authors';
}
function hasGlyph(font, point) {
  if (/\s/u.test(String.fromCodePoint(point))) return true;
  const cmap = table(font, 'cmap'), count = font.readUInt16BE(cmap + 2);
  for (let index = 0; index < count; index++) {
    const record = cmap + 4 + index * 8, platform = font.readUInt16BE(record);
    if (![0, 3].includes(platform)) continue;
    const offset = cmap + font.readUInt32BE(record + 4), format = font.readUInt16BE(offset);
    if (format === 12) {
      const groups = font.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group++) {
        const position = offset + 16 + group * 12, start = font.readUInt32BE(position), end = font.readUInt32BE(position + 4);
        if (point >= start && point <= end) return font.readUInt32BE(position + 8) + point - start > 0;
      }
    }
    if (format === 4 && point <= 0xffff) {
      const segments = font.readUInt16BE(offset + 6) / 2;
      const ends = offset + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        const start = font.readUInt16BE(starts + segment * 2), end = font.readUInt16BE(ends + segment * 2);
        if (point < start || point > end) continue;
        const delta = font.readInt16BE(deltas + segment * 2), range = font.readUInt16BE(ranges + segment * 2);
        if (!range) return ((point + delta) & 0xffff) !== 0;
        const address = ranges + segment * 2 + range + (point - start) * 2;
        if (address + 2 <= font.length) {
          const glyph = font.readUInt16BE(address);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        }
      }
    }
  }
  return false;
}

function artDocument(svg, title, print = false) {
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${escapeHtml(title)} — Anacan</title>
    <style>@page{size:148mm 210mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#fff}svg{display:block}${print ? '.sheet{width:148mm;height:210mm;break-after:page}.sheet:last-child{break-after:auto}.sheet>svg{width:148mm;height:210mm}' : ''}</style></head>
    <body>${print ? `<div class="sheet">${svg}</div>` : svg}</body></html>`;
}
async function inspectText(page, fonts) {
  await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load('700 48px AnacanSans', 'ƏəĞğŞşÇçÖöÜüİı'); });
  const result = await page.evaluate(() => {
    const root = document.querySelector('svg[data-poster]'), frame = root.getBoundingClientRect();
    const nodes = [...root.querySelectorAll('text[data-copy]')];
    return { text: nodes.map(node => [...node.querySelectorAll('tspan')].map(span => span.textContent).join('\n') || node.textContent).join('\n'),
      overflow: nodes.flatMap(node => {
        const box = node.getBoundingClientRect();
        return box.x < frame.x + 4 || box.right > frame.right - 4 || box.y < frame.y + 4 || box.bottom > frame.bottom - 4
          ? [{ text: node.textContent, x: box.x - frame.x, y: box.y - frame.y, right: box.right - frame.x, bottom: box.bottom - frame.y }] : [];
      }), textCount: nodes.length, imageCount: root.querySelectorAll('image, foreignObject').length };
  });
  assert(result.overflow.length === 0, `Mətn çərçivədən çıxır: ${JSON.stringify(result.overflow)}`);
  assert(result.imageCount === 0, 'Gözlənilməyən xarici təsvir elementi');
  assert(!/\b(download|free|premium|scan|week|story|baby|family|join|click|app store|google play)\b/i.test(result.text), 'İngiliscə görünən mətn tapıldı');
  for (const character of new Set([...result.text])) {
    assert(fonts.every(font => hasGlyph(font, character.codePointAt(0))), `Şriftdə simvol çatışmır: ${character}`);
  }
  return { textBlocks: result.textCount, noTextOverflow: true, azerbaijaniGlyphCoverage: true, illustrationStyle: 'abstract-geometry', text: result.text };
}

function gallery() {
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Anacan — yeni flayerlər</title>
    <style>*{box-sizing:border-box}body{margin:0;background:#f2eee8;color:#352c31;font-family:Arial,sans-serif}main{max-width:1680px;margin:auto;padding:48px}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:35px}h1{font-size:42px;letter-spacing:-1.8px;margin:0 0 10px}header p{font-size:17px;color:#796d71;margin:0;line-height:1.6}a{color:inherit}.download{display:inline-flex;padding:13px 20px;border-radius:30px;background:#3d3039;color:white;text-decoration:none;font-size:14px;white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px 28px}figure{margin:0;min-width:0}figure img{display:block;width:100%;height:auto;aspect-ratio:4/5;box-shadow:0 12px 35px rgba(56,36,45,.1)}figcaption{padding:17px 0 9px}h2{font-size:19px;letter-spacing:-.5px;margin:0 0 7px}figcaption p{font-size:13px;color:#83787a;line-height:1.4;margin:0 0 12px}.links{display:flex;gap:15px;font-size:12px}.links a{text-underline-offset:4px}footer{margin-top:30px;padding-top:18px;border-top:1px solid #d8ced0;font-size:13px;color:#80747a;line-height:1.7}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:24px}h1{font-size:34px}}@media(max-width:600px){.grid{grid-template-columns:1fr}header{display:block}.download{margin-top:18px}}</style>
    </head><body><main><header><div><h1>Anacan — yeni flayerlər</h1><p>Altı fərqli görünüş. Tam Azərbaycan dilində.<br>Abstrakt formalar, aydın mətn və personajsız dizayn.</p></div><a class="download" href="anacan-flayerler-a5.pdf" download>Bütün flayerlər · A5 PDF</a></header>
    <section class="grid">${FLYERS.map((flyer, index) => `<figure><a href="png/${flyer.id}.png"><img src="svg/${flyer.id}.svg" alt="${escapeHtml(flyer.name)}"></a><figcaption><h2>${String(index + 1).padStart(2, '0')} · ${escapeHtml(flyer.name)}</h2><p>${escapeHtml(flyer.note)}</p><nav class="links"><a href="png/${flyer.id}.png" download>Şəkli endir</a><a href="svg/${flyer.id}.svg" download>Vektoru endir</a><a href="cap/${flyer.id}-a5.pdf" download>A5 PDF</a></nav></figcaption></figure>`).join('')}</section>
    <footer>Paylaşım şəkilləri: 2160 × 2700 · Vektorlar: 1080 × 1350 · Çap faylları: A5, 148 × 210 mm<br>QR kodlar Anacan tətbiqinə aparır. Redaktə edilə bilən mənbələr və şrift lisenziyası dəstə daxildir.</footer></main></body></html>`;
}

let server, browser, context;
const report = { generatedAt: new Date().toISOString(), language: 'az', destination: DESTINATION, flyers: [], passed: false };
try {
  for (const folder of ['', 'png', 'svg', 'cap']) await mkdir(join(output, folder), { recursive: true });
  const regular = await readFile(join(root, 'public/fonts/NotoSans-Regular.ttf'));
  const bold = await readFile(join(root, 'public/fonts/NotoSans-Bold.ttf'));
  const fonts = { regular: regular.toString('base64'), bold: bold.toString('base64') };
  const qr = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: DESTINATION, size: 144, level: 'M', marginSize: 4, fgColor: '#25333b', bgColor: '#fff' }));
  await writeFile(join(output, 'Srift-lisenziyasi.txt'), `${fontCopyright(regular)}\n${fontCopyright(bold)}\n\n${await readFile(join(here, 'OFL.txt'), 'utf8')}`);
  await writeFile(join(output, 'ISTIFADE.md'), await readFile(join(here, 'README.md')));
  server = await chromium.launchServer({ channel: 'chrome', headless: true });
  browser = await chromium.connect(server.wsEndpoint());
  context = await browser.newContext({ viewport: { width: WIDTH, height: SOCIAL_HEIGHT }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await context.newPage();
  await page.route(/^https?:\/\//, route => route.abort());
  const printSheets = [];
  for (const flyer of FLYERS) {
    const svg = makeFlyer(flyer, { fonts, qr });
    const printSvg = makeFlyer(flyer, { height: PRINT_HEIGHT, fonts, qr });
    await writeFile(join(output, 'svg', `${flyer.id}.svg`), svg);
    await writeFile(join(output, 'cap', `${flyer.id}-a5.svg`), printSvg);
    await page.setViewportSize({ width: WIDTH, height: SOCIAL_HEIGHT });
    await page.setContent(artDocument(svg, flyer.name), { waitUntil: 'load' });
    const socialCheck = await inspectText(page, [regular, bold]);
    await page.screenshot({ path: join(output, 'png', `${flyer.id}.png`), animations: 'disabled' });
    await page.setContent(artDocument(printSvg, flyer.name, true), { waitUntil: 'load' });
    const printCheck = await inspectText(page, [regular, bold]);
    const pdf = await page.pdf({ path: join(output, 'cap', `${flyer.id}-a5.pdf`), printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    assert((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length === 1, 'A5 PDF səhifə sayı uyğun deyil');
    printSheets.push(printSvg);
    report.flyers.push({ id: flyer.id, name: flyer.name, png: { width: WIDTH * 2, height: SOCIAL_HEIGHT * 2 }, social: socialCheck, print: printCheck });
    console.log(JSON.stringify({ flyer: flyer.name, png: '2160×2700', pdf: 'A5', passed: true }));
  }
  const combined = artDocument('', 'Anacan — bütün flayerlər', true).replace('<div class="sheet"></div>', printSheets.map(svg => `<div class="sheet">${svg}</div>`).join(''));
  await page.setContent(combined, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ path: join(output, 'anacan-flayerler-a5.pdf'), printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  report.pdfPages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  assert(report.pdfPages === FLYERS.length, 'Birləşmiş PDF səhifə sayı uyğun deyil');
  await writeFile(join(output, 'goruntule.html'), gallery());
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.goto(new URL('./hazir/goruntule.html', import.meta.url).href, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  await page.screenshot({ path: join(output, 'butun-flayerler.png'), fullPage: true, scale: 'css', animations: 'disabled' });
  report.passed = true;
  await writeFile(join(output, 'yoxlama.json'), JSON.stringify(report, null, 2) + '\n');
  // Archive only the public design deliverables, never workspace or private inputs.
  await rm(join(output, 'anacan-flayerler-az.zip'), { force: true });
  execFileSync('/usr/bin/zip', ['-q', '-r', 'anacan-flayerler-az.zip', 'png', 'svg', 'cap', 'goruntule.html', 'butun-flayerler.png', 'anacan-flayerler-a5.pdf', 'ISTIFADE.md', 'Srift-lisenziyasi.txt', 'yoxlama.json'], { cwd: output, timeout: 120000 });
  console.log(JSON.stringify({ passed: true, flyers: report.flyers.length, pdfPages: report.pdfPages, output }));
} finally {
  await Promise.race([context?.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
  await Promise.race([browser?.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
  await server?.kill().catch(() => {});
}
