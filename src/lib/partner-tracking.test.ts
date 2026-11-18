// Partner sales tracking: click tokens on outbound links, the panel install snippets, and the partner-site SDK
// (public/sdk/anacan-partner.js) that keeps the click and reports the order.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newClickToken, partnerLink, storefrontFromRpc } from './partner-shop';
import { TRACKING_ENDPOINT, trackingSnippets } from './partner-panel';

const SDK = readFileSync(resolve(__dirname, '../../public/sdk/anacan-partner.js'), 'utf8');
const KEY = 'pk_' + 'a'.repeat(32);
const CLICK = 'Abc123_-Abc123_-Abc123';

function loadSdk({ search = '', test = false } = {}) {
  window.history.replaceState(null, '', '/thank-you' + search);
  const tag = document.createElement('script');
  tag.setAttribute('data-key', KEY);
  if (test) tag.setAttribute('data-test', 'true');
  Object.defineProperty(document, 'currentScript', { value: tag, configurable: true });
  new Function(SDK)();
  Object.defineProperty(document, 'currentScript', { value: null, configurable: true });
}

describe('click tokens', () => {
  it('makes URL-safe random tokens the server accepts', () => {
    const a = newClickToken(), b = newClickToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(a).not.toBe(b);
  });
  it('adds anacan_click next to the UTM tags, and only a valid token', () => {
    const url = new URL(partnerLink('https://olivia.az/siveno?x=1', 'shop baby', CLICK));
    expect(url.searchParams.get('anacan_click')).toBe(CLICK);
    expect(url.searchParams.get('utm_source')).toBe('anacan');
    expect(url.searchParams.get('x')).toBe('1');
    expect(new URL(partnerLink('https://olivia.az/a', 'shop', 'bad token')).searchParams.has('anacan_click')).toBe(false);
  });
});

describe('panel snippets', () => {
  it('carry the public key and never a secret', () => {
    const s = trackingSnippets(KEY);
    expect(s.head).toContain(`data-key="${KEY}"`);
    expect(s.order).toContain("anacan('order'");
    expect(s.server).toContain(TRACKING_ENDPOINT);
    expect(s.server).toContain('Bearer sk_…');
  });
});

describe('partner-site SDK', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    document.cookie.split(';').forEach((c) => { document.cookie = c.split('=')[0].trim() + '=;max-age=0;path=/'; });
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    delete (window as unknown as { anacan?: unknown }).anacan;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the click from the landing page and reports the order once', () => {
    loadSdk({ search: `?utm_source=anacan&anacan_click=${CLICK}` });
    loadSdk(); // a later page without the parameter
    const w = window as unknown as { anacan: (...a: unknown[]) => unknown };
    expect(w.anacan('click')).toBe(CLICK);
    w.anacan('order', { order_id: 'OL-1', total: '31,98', items: [{ sku: '00-10023595', name: 'Siveno', quantity: 2, price: 15.99 }, null] });
    w.anacan('order', { order_id: 'OL-1', total: 31.98 }); // refresh of the thank-you page
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TRACKING_ENDPOINT);
    expect(init.keepalive).toBe(true);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
    const body = JSON.parse(String(init.body));
    expect(body.key).toBe(KEY);
    expect(body.order).toMatchObject({ order_id: 'OL-1', total: 31.98, currency: 'AZN', click: CLICK });
    expect(body.order.items).toHaveLength(2);
    expect(body.order.items[0]).toMatchObject({ sku: '00-10023595', quantity: 2, price: 15.99 });
  });

  it('runs commands queued before the script loaded and sends nothing for visitors not from Anacan', () => {
    const w = window as unknown as { anacan: ((...a: unknown[]) => unknown) & { q?: unknown[][] } };
    w.anacan = Object.assign(function (...a: unknown[]) { (w.anacan.q = w.anacan.q || []).push(a); }, { q: [] as unknown[][] });
    w.anacan('order', { order_id: 'NOPE', total: 5 });
    loadSdk();
    expect(fetchMock).not.toHaveBeenCalled();
    w.anacan('coupon', 'ANACAN10');
    w.anacan('order', { order_id: 'C-1', total: 20 });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).order).toMatchObject({ coupon: 'ANACAN10', order_id: 'C-1' });
  });

  it('marks test orders and ignores invalid click tokens', () => {
    loadSdk({ search: '?anacan_click=<script>', test: true });
    const w = window as unknown as { anacan: (...a: unknown[]) => unknown };
    expect(w.anacan('click')).toBeNull();
    loadSdk({ search: `?anacan_click=${CLICK}`, test: true });
    w.anacan('order', { order_id: 'T-1', total: 1 });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).order.test).toBe(true);
  });
});

describe('storefront cache safety', () => {
  const raw = { partners: [{ id: 'p1', slug: 'olivia', name: 'Olivia', status: 'live' }], products: [{ id: 'x1', partner_id: 'p1', name: 'Siveno', price: 10 }] };
  it('rebuilds the partner Map from JSON-restored data', () => {
    const restored = JSON.parse(JSON.stringify(raw));
    const s = storefrontFromRpc(restored);
    expect(s.partners.get('p1')?.name).toBe('Olivia');
    expect(s.products).toHaveLength(1);
  });
  it('does not throw on the shape a persisted Map left behind ({} instead of an array)', () => {
    const broken = JSON.parse(JSON.stringify({ partners: new Map([['p1', {}]]), products: [{ id: 'x1', partnerId: 'p1' }] }));
    const s = storefrontFromRpc(broken);
    expect(typeof s.partners.get).toBe('function');
    expect(s.products).toEqual([]);
  });
});
