// All network for one browser context goes through here. Nothing reaches the live backend:
//  - the Vite dev server (same origin) is passed through,
//  - Google Fonts are served from a local cache (filled once through the proxy, see fonts.mjs),
//  - https://api.anacan.az (admission, GoTrue, PostgREST, Functions, Storage, Realtime) is answered from fixtures,
//  - every other host is answered with an empty response (scripts: empty JS, images: placeholder PNG).
// Every request that had no fixture is recorded so fixtures can be completed iteratively (out/<run>/unmocked.json).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveFixture, FIXTURES_DIR } from './fixtures.mjs';
import { runQuery, matches } from './postgrest.mjs';
import { placeholderPng } from './png.mjs';
import { serveFont } from './fonts.mjs';

export const API_ORIGIN = 'https://api.anacan.az';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'Content-Range, Content-Location, X-Total-Count',
};
const json = (body, status = 200, headers = {}) => ({
  status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', ...headers },
  body: body === undefined ? '' : JSON.stringify(body),
});

export const ADMISSION_POLICY = {
  schema: 'anacan-backend-admission-v1', generation: 2, phase: 'azure', minNativeVersion: '28.0',
  handoffSha256: '0'.repeat(64),
};

export class MockBackend {
  constructor({ persona, ctx, session, user, recorder, scenarioId }) {
    this.persona = persona; this.ctx = ctx; this.session = session; this.user = user;
    this.recorder = recorder; this.scenarioId = scenarioId;
    this.tables = new Map(); // table -> rows (fixture rows + writes made during this context)
    this.idSeq = 0;
  }

  record(kind, method, path, detail = {}) {
    this.recorder.add({ kind, method, path, persona: this.persona.name, scenario: this.scenarioId, ...detail });
  }

  async tableRows(table) {
    if (!this.tables.has(table)) {
      const fx = await resolveFixture(this.persona, this.ctx, 'tables', table);
      this.tables.set(table, { rows: fx.found ? [...(Array.isArray(fx.value) ? fx.value : [fx.value])] : [], found: fx.found });
    }
    return this.tables.get(table);
  }

  nextId() {
    this.idSeq += 1;
    return `00000000-0000-4000-8000-${String(this.idSeq).padStart(12, '0')}`;
  }

  async handleRest(req, url, table) {
    const method = req.method();
    const params = url.searchParams;
    const accept = req.headers()['accept'] || '';
    const prefer = req.headers()['prefer'] || '';
    const single = accept.includes('vnd.pgrst.object');
    const state = await this.tableRows(table);
    const query = url.search.slice(1);
    if (!state.found) this.record('table', method, `/rest/v1/${table}`, { query });

    if (method === 'GET' || method === 'HEAD') {
      const { rows, total, offset, unsupported } = runQuery(state.rows, params);
      if (unsupported.length && state.found) this.record('filter', method, `/rest/v1/${table}`, { query, unsupported });
      const headers = {};
      if (/count=(exact|planned|estimated)/.test(prefer) || method === 'HEAD') {
        headers['content-range'] = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
      }
      if (method === 'HEAD') return { status: 200, headers: { ...CORS, ...headers }, body: '' };
      if (single) {
        if (rows.length === 0) return json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
        return json(rows[0], 200, headers);
      }
      return json(rows, 200, headers);
    }

    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { body = null; }
    const wantRows = prefer.includes('return=representation');
    if (method === 'POST') {
      const items = (Array.isArray(body) ? body : [body]).filter(Boolean).map((r) => ({ id: r.id ?? this.nextId(), created_at: this.ctx.iso('0'), ...r }));
      if (prefer.includes('resolution=merge-duplicates') || params.has('on_conflict')) {
        const keys = (params.get('on_conflict') || 'id').split(',');
        for (const item of items) {
          const idx = state.rows.findIndex((r) => keys.every((k) => r[k] !== undefined && String(r[k]) === String(item[k])));
          if (idx >= 0) state.rows[idx] = { ...state.rows[idx], ...item }; else state.rows.push(item);
        }
      } else state.rows.push(...items);
      this.record('write', method, `/rest/v1/${table}`, { query });
      if (!wantRows) return { status: 201, headers: CORS, body: '' };
      const { rows } = runQuery(items, new URLSearchParams({ select: params.get('select') || '*' }));
      return single ? json(rows[0] ?? null, 201) : json(rows, 201);
    }
    if (method === 'PATCH' || method === 'PUT') {
      const changed = [];
      state.rows = state.rows.map((r) => (matches(r, params) ? (changed.push({ ...r, ...body }), { ...r, ...body }) : r));
      this.record('write', method, `/rest/v1/${table}`, { query });
      if (!wantRows) return { status: 204, headers: CORS, body: '' };
      return single ? json(changed[0] ?? null) : json(changed);
    }
    if (method === 'DELETE') {
      const removed = state.rows.filter((r) => matches(r, params));
      state.rows = state.rows.filter((r) => !matches(r, params));
      this.record('write', method, `/rest/v1/${table}`, { query });
      if (!wantRows) return { status: 204, headers: CORS, body: '' };
      return json(removed);
    }
    return json([], 200);
  }

  async handleRpc(req, url, name) {
    let args = {};
    try { args = req.postData() ? JSON.parse(req.postData()) : Object.fromEntries(url.searchParams); } catch { /* none */ }
    const fx = await resolveFixture(this.persona, this.ctx, 'rpc', name, args);
    if (!fx.found) {
      this.record('rpc', req.method(), `/rest/v1/rpc/${name}`, { args: Object.keys(args) });
      return json(null);
    }
    const value = fx.value;
    if (value && typeof value === 'object' && value.__error) return json(value.__error, value.__status || 400);
    return json(value === undefined ? null : value);
  }

  async handleFunction(req, url, name) {
    let args = {};
    try { args = req.postData() ? JSON.parse(req.postData()) : {}; } catch { /* binary */ }
    const fx = await resolveFixture(this.persona, this.ctx, 'functions', name, args);
    if (!fx.found) {
      this.record('function', req.method(), `/functions/v1/${name}`, { args: Object.keys(args || {}) });
      return json({});
    }
    if (fx.value && typeof fx.value === 'object' && fx.value.__error) return json(fx.value.__error, fx.value.__status || 400);
    return json(fx.value);
  }

  handleAuth(req, url) {
    const path = url.pathname.replace(/^\/auth\/v1/, '');
    const signedIn = !!this.session;
    if (path === '/user') {
      if (!signedIn) return json({ code: 401, error_code: 'no_authorization', msg: 'This endpoint requires a valid Bearer token' }, 401);
      if (req.method() === 'PUT') return json(this.user);
      return json(this.user);
    }
    if (path === '/token') {
      if (!signedIn) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      return json(this.session);
    }
    if (path === '/logout') return { status: 204, headers: CORS, body: '' };
    if (path === '/settings') return json({ external: { email: true, google: true, apple: true, phone: false }, disable_signup: false, mailer_autoconfirm: false });
    if (path === '/factors' || path.startsWith('/factors')) return json({ all: [], totp: [], phone: [] });
    this.record('auth', req.method(), `/auth/v1${path}`);
    return json({});
  }

  storageAsset(path) {
    // fixtures/_assets/<bucket>/<path> (or <persona>/_assets/...) wins over the generated placeholder.
    for (const dir of this.persona.chain) {
      const file = join(FIXTURES_DIR, dir, '_assets', path);
      if (existsSync(file)) return readFileSync(file);
    }
    return null;
  }

  async handleStorage(req, url) {
    const m = /^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/(.+)$/.exec(url.pathname);
    if (m && req.method() === 'GET') {
      const file = this.storageAsset(decodeURIComponent(m[1]));
      if (file) return { status: 200, headers: { ...CORS, 'content-type': contentTypeFor(m[1]) }, body: file };
      return { status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: placeholderPng(m[1]) };
    }
    if (/^\/storage\/v1\/object\/sign\//.test(url.pathname) && req.method() === 'POST') {
      const p = url.pathname.replace('/storage/v1/object/sign/', '');
      return json({ signedURL: `/object/sign/${p}?token=fixture`, signedUrl: `${API_ORIGIN}/storage/v1/object/sign/${p}?token=fixture` });
    }
    this.record('storage', req.method(), url.pathname);
    if (req.method() === 'POST' && url.pathname.includes('/object/list/')) return json([]);
    return json({});
  }

  /** Main entry: returns a Playwright fulfill() option object. */
  async respond(req) {
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return { status: 204, headers: CORS, body: '' };
    if (url.pathname === '/.well-known/anacan-backend.json') {
      return json(ADMISSION_POLICY, 200, { 'cache-control': 'no-store' });
    }
    if (url.pathname.startsWith('/auth/v1/')) return this.handleAuth(req, url);
    let m = /^\/rest\/v1\/rpc\/([^/?]+)/.exec(url.pathname);
    if (m) return this.handleRpc(req, url, m[1]);
    m = /^\/rest\/v1\/([^/?]+)/.exec(url.pathname);
    if (m) return this.handleRest(req, url, m[1]);
    m = /^\/functions\/v1\/([^?]+)/.exec(url.pathname);
    if (m) return this.handleFunction(req, url, m[1]);
    if (url.pathname.startsWith('/storage/v1/')) return this.handleStorage(req, url);
    if (req.resourceType() === 'image' || /\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname)) {
      return { status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: placeholderPng(url.pathname) };
    }
    this.record('api', req.method(), url.pathname);
    return json({}, 404);
  }
}

function contentTypeFor(path) {
  const ext = path.split('.').pop().toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif', json: 'application/json', mp3: 'audio/mpeg' }[ext] || 'application/octet-stream';
}

/** Realtime (Phoenix) socket stub: every join/heartbeat is acknowledged, nothing is ever pushed. */
export async function stubRealtime(context) {
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((message) => {
      if (typeof message !== 'string') return;
      let msg; try { msg = JSON.parse(message); } catch { return; }
      const arr = Array.isArray(msg);
      const [joinRef, ref, topic, event, payload] = arr ? msg : [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
      if (event !== 'phx_join' && event !== 'heartbeat' && event !== 'access_token' && event !== 'phx_leave') return;
      const response = event === 'phx_join'
        ? { postgres_changes: (payload?.config?.postgres_changes || []).map((c, i) => ({ ...c, id: 1000 + i })) } : {};
      const reply = { status: 'ok', response };
      ws.send(JSON.stringify(arr ? [joinRef, ref, topic, 'phx_reply', reply] : { topic, event: 'phx_reply', payload: reply, ref, join_ref: joinRef }));
    });
  });
}

/**
 * Install routing on a browser context. `appOrigin` is the dev server; requests to it pass through.
 * Returns nothing; unmocked traffic is recorded into `mock.recorder`.
 */
export async function installNetwork(context, mock, { appOrigin, fontMode }) {
  await stubRealtime(context);
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    try {
      if (url.origin === appOrigin) {
        // framer-motion: jump every animation to its end state (MotionGlobalConfig is module-scoped in Vite's
        // pre-bundled dep). Only timing changes; final styles are the app's own.
        if (/\/node_modules\/\.vite\/deps\/framer-motion\.js$/.test(url.pathname)) {
          const response = await route.fetch();
          const body = (await response.text()) + '\n;MotionGlobalConfig.skipAnimations = true; MotionGlobalConfig.instantAnimations = true;\n';
          return await route.fulfill({ response, body });
        }
        return await route.continue();
      }
      if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        return await route.fulfill(await serveFont(url, fontMode, mock.recorder));
      }
      if (url.origin === API_ORIGIN) return await route.fulfill(await mock.respond(req));
      if (url.protocol === 'data:' || url.protocol === 'blob:') return await route.continue();
      // Everything else (analytics, ads, CDNs, external images): never leaves the machine.
      mock.record('external', req.method(), `${url.origin}${url.pathname}`);
      const type = req.resourceType();
      if (type === 'image') return await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: placeholderPng(url.href) });
      if (type === 'script') return await route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript' }, body: '' });
      if (type === 'stylesheet') return await route.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: '' });
      return await route.fulfill({ status: 204, headers: CORS, body: '' });
    } catch (error) {
      if (!/Target page, context or browser has been closed|Route is already handled/.test(String(error))) {
        mock.record('error', req.method(), url.href, { error: String(error).slice(0, 200) });
        try { await route.fulfill(json({}, 500)); } catch { /* closed */ }
      }
    }
  });
}
