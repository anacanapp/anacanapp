// Real-app screenshot harness: the app runs from the local dev server; user rows are fixtures,
// public content (tips, blog, tools) is read from the live API with the public anon key.
const { chromium } = require('playwright');
const fs = require('fs');
const [,, scenarioFile, outPng, stepsJson] = process.argv;
const S = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
const ANON = fs.readFileSync(require('path').join(__dirname, '../../../.env.google'), 'utf8').match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1].trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const UID = S.profile.user_id;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: 4102444800, email: S.email })}.sig`;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: S.email, app_metadata: { provider: 'email' }, user_metadata: { name: S.profile.name }, created_at: '2026-01-01T00:00:00Z' };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600 * 24 * 365 * 50, expires_at: 4102444800, user };
const seen = new Map();
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,127.0.0.1,localhost' } : undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: S.height || 863 }, deviceScaleFactor: 3, ignoreHTTPSErrors: true, locale: 'az-AZ', timezoneId: 'Asia/Baku' });
  await ctx.addInitScript(([session, ls]) => {
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('sb-api-auth-token', JSON.stringify(session));
    for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [session, S.localStorage]);
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route('https://api.anacan.az/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), path = u.pathname, m = req.method();
    if (path.startsWith('/auth/v1/user')) return json(r, user);
    if (path.startsWith('/auth/v1/token') || path.startsWith('/auth/v1/logout')) return json(r, session);
    if (path.startsWith('/functions/v1/')) {
      const fn = S.functions?.[path.slice(14)];
      seen.set('fn ' + path, fn ? 'fixture' : 200);
      if (fn?.sse) {
        const body = fn.sse.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
        return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
      }
      return json(r, fn ?? {});
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.slice(9);
      if (table === 'rpc/get_premium_access_v1' && S.premium) {
        const now = Date.now(), grant = { active: true, expiresAt: null };
        return json(r, { protocol: 'anacan-premium-access-v1', userId: UID, checkedAt: new Date(now).toISOString(), validUntil: new Date(now + 30000).toISOString(), own: grant, household: grant });
      }
      const fx = S.fixtures[table];
      if (fx !== undefined && (m === 'GET' || table.startsWith('rpc/') || m === 'HEAD')) {
        seen.set(m + ' ' + table, 'fixture');
        const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        let rows = Array.isArray(fx) ? fx : fx;
        if (Array.isArray(rows)) {
          // honour simple eq filters so lookups by id/user_id behave
          for (const [k, v] of u.searchParams) if (/^eq\./.test(v) && rows.length && k in rows[0]) rows = rows.filter((x) => String(x[k]) === v.slice(3));
          const order = u.searchParams.get('order');
          if (order) { const [col, dir] = order.split(',')[0].split('.'); rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
        }
        if (single) return Array.isArray(rows) ? (rows.length ? json(r, rows[0]) : json(r, { code: 'PGRST116' }, 406)) : json(r, rows);
        return json(r, rows);
      }
      if (m !== 'GET' && !table.startsWith('rpc/')) { seen.set(m + ' ' + table, 'write'); return json(r, [], 201); }
      try {
        const h = { ...req.headers(), apikey: ANON, authorization: 'Bearer ' + ANON };
        const resp = await r.fetch({ headers: h });
        seen.set(m + ' ' + table.split('?')[0], resp.status());
        return r.fulfill({ response: resp });
      } catch (e) { seen.set(m + ' ' + table, 'ERR'); return json(r, []); }
    }
    if (path.startsWith('/storage/')) { try { return r.fulfill({ response: await r.fetch() }); } catch { return r.abort(); } }
    seen.set(m + ' ' + path, 'abort'); return r.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 160)));
  await p.goto(process.env.APP_URL || 'http://127.0.0.1:5181/', { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(2500);
  for (const step of JSON.parse(stepsJson || '[]')) {
    if (step.click) await p.getByText(step.click, { exact: step.exact ?? false }).first().click({ timeout: step.optional ? 4000 : 15000 }).catch((e) => { if (!step.optional) throw e; });
    if (step.css) await p.locator(step.css).first().click({ timeout: 15000 });
    if (step.eval) await p.evaluate(step.eval);
    if (step.fill) await p.locator(step.fill).first().fill(step.text);
    if (step.press) await p.keyboard.press(step.press);
    if (step.scroll != null) await p.evaluate((y) => {
      // The app scrolls an inner container; pick the biggest scrollable element.
      const els = [document.scrollingElement, ...document.querySelectorAll('*')].filter((e) => e && e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible' && getComputedStyle(e).overflowY !== 'hidden');
      els.sort((a, b) => b.scrollHeight - a.scrollHeight);
      if (els[0]) els[0].scrollTop = y;
    }, step.scroll);
    if (step.scrollTo) await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), step.scrollTo);
    if (step.by != null) await p.evaluate((y) => window.scrollBy(0, y), step.by);
    await p.waitForTimeout(step.wait ?? 1500);
    if (step.shot) { await p.screenshot({ path: `${outPng}-${step.shot}.png` }); console.log('shot', step.shot, await p.evaluate(() => { const els = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); els.sort((a, b) => b.scrollHeight - a.scrollHeight); return els[0] ? [els[0].scrollTop, els[0].scrollHeight] : null; })); }
  }
  await p.waitForLoadState('networkidle').catch(() => {});
  if (!JSON.parse(stepsJson || '[]').some((s) => s.shot)) await p.screenshot({ path: outPng });
  if (process.env.SHOW_REQ) console.log([...seen].map(([k, v]) => `${v}\t${k}`).sort().join('\n'));
  await b.close();
})();
