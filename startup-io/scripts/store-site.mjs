import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/store-site');
await access(path.join(root, 'artifacts')); await mkdir(output, { recursive: true });
const { code } = await transform(await readFile(path.join(root, 'src/legal.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
const { LEGAL_COPY } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const css = 'body{font:16px/1.85 system-ui,sans-serif;color:#d8e7ee;background:#10202d;margin:0}main{max-width:780px;margin:auto;padding:50px 24px}nav{display:flex;flex-wrap:wrap;gap:20px;border-bottom:1px solid #314859;padding-bottom:22px}a{color:#bedf91}h1{font-size:34px;line-height:1.2;margin-top:35px}h2{font-size:21px;color:#b5cad4;margin-top:30px}p{color:#8faab9}footer{border-top:1px solid #314859;margin-top:35px;padding-top:24px;font-size:13px;color:#678594}small{letter-spacing:1px;color:#6f9287}';
for (const [language, copy] of Object.entries(LEGAL_COPY)) {
  for (const [type, sections] of Object.entries(copy)) {
    const filename = language === 'en' ? `${type}.html` : `${type}-az.html`;
    const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>startup.io — ${escape(sections[0][0])}</title><style>${css}</style></head><body><main><nav><a href="index.html">startup.io</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="support.html">Support</a><a href="${type}${language === 'en' ? '-az' : ''}.html">${language === 'en' ? 'AZ' : 'EN'}</a></nav><h1>${escape(sections[0][0])}</h1><small>ATLASOON · ${release.version}</small>${sections.map(([heading, body], index) => `${index ? `<h2>${escape(heading)}</h2>` : ''}<p>${escape(body)}</p>`).join('')}<footer><a href="mailto:${release.supportEmail}">${release.supportEmail}</a><br>© 2026 Atlasoon · startup.io</footer></main></body></html>`;
    await writeFile(path.join(output, filename), html);
  }
}
await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>startup.io — Venture City</title><style>${css}</style></head><body><main><nav><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms</a><a href="support.html">Support</a></nav><h1>startup.io</h1><small>VENTURE CITY · UNLIMITED ARCADE</small><p>Build your startup in an endless isometric city. Collect funding, secure venture rounds and outgrow 48 computer-controlled competitors.</p><p>Choose AI, Fintech or Cloud, unlock temporary advantages and survive shifting market conditions. Free to play, offline, no advertising or real-money purchases.</p><footer><a href="mailto:${release.supportEmail}">${release.supportEmail}</a><br>© 2026 Atlasoon</footer></main></body></html>`);
console.log('Built 7 standalone public support/legal pages.');
const runtime = path.join(root, 'artifacts/store-site-runtime');
await mkdir(runtime, { recursive: true });
for (const filename of await readdir(output)) if (filename.endsWith('.html')) await copyFile(path.join(output, filename), path.join(runtime, filename));
for (const filename of ['Dockerfile', 'server.mjs']) await copyFile(path.join(root, 'store/site', filename), path.join(runtime, filename));

if (process.argv.includes('--publish')) {
  const { runGcloud, PROJECT } = await import('../../azure-migration/google-cloud/gcloud.mjs');
  if (PROJECT !== 'ninth-park-492111-m4') throw new Error('Wrong Google project');
  const account = `${release.legalService}@${PROJECT}.iam.gserviceaccount.com`;
  const accounts = await runGcloud(['iam', 'service-accounts', 'list', `--filter=email=${account}`]);
  if (!accounts.length) await runGcloud(['iam', 'service-accounts', 'create', release.legalService, '--display-name=startup.io public legal pages']);
  const buildAccount = `${release.legalService}-build@${PROJECT}.iam.gserviceaccount.com`;
  const buildAccounts = await runGcloud(['iam', 'service-accounts', 'list', `--filter=email=${buildAccount}`]);
  if (!buildAccounts.length) await runGcloud(['iam', 'service-accounts', 'create', `${release.legalService}-build`, '--display-name=startup.io legal page container builds']);
  await runGcloud(['projects', 'add-iam-policy-binding', PROJECT, `--member=serviceAccount:${buildAccount}`, '--role=roles/run.builder', '--condition=None']);
  // Cloud Run supports public services under domain-restricted sharing through its invoker setting.
  await runGcloud(['run', 'deploy', release.legalService, `--source=${runtime}`, `--region=${release.legalRegion}`, '--no-invoker-iam-check', `--service-account=${account}`, `--build-service-account=projects/${PROJECT}/serviceAccounts/${buildAccount}`, '--min=0', '--max=2', '--memory=256Mi', '--cpu=1', '--port=8080', '--concurrency=80', '--labels=application=startup-io,component=store-info'], { timeout: 900000, refreshable: true, json: false });
  const service = await runGcloud(['run', 'services', 'describe', release.legalService, `--region=${release.legalRegion}`]);
  const base = `${service.status?.url}/`;
  if (!/^https:\/\/[a-z0-9.-]+\.run\.app\/$/.test(base)) throw new Error('Public Cloud Run URL missing');
  const urls = { privacy: `${base}privacy.html`, terms: `${base}terms.html`, support: `${base}support.html`, marketing: `${base}index.html` };
  const pages = [];
  for (const filename of (await readdir(output)).filter(name => name.endsWith('.html'))) {
    const response = await fetch(`${base}${filename}`, { redirect: 'error' }); const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
    if (!response.ok || !response.headers.get('content-type')?.startsWith('text/html') || response.headers.has('set-cookie') || sha256(bytes) !== sha256(await readFile(path.join(output, filename)))) throw new Error('Published public page acceptance failed');
    pages.push({ filename, url: `${base}${filename}`, status: response.status, sha256: sha256(bytes) });
  }
  await writeFile(path.join(root, 'artifacts/store-public-urls.json'), JSON.stringify({ at: new Date().toISOString(), version: release.version, project: PROJECT, service: release.legalService, revision: service.status.latestReadyRevisionName, urls, pages, verified: true }, null, 2) + '\n');
  console.log(JSON.stringify({ published: true, verifiedPages: pages.length, urls }, null, 2));
}
