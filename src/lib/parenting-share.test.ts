import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  partnerUserId: 'partner-user' as string | null,
  sent: [] as { actor: string; target: string; content: string }[],
  rows: [] as { id: string; content: string | null; created_at: string; is_read?: boolean }[],
  calls: [] as [string, ...unknown[]][],
  updates: [] as unknown[],
}));

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));
vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const rec = (name: string) => (...args: unknown[]) => { db.calls.push([`${table}.${name}`, ...args]); return q; };
    for (const m of ['select', 'eq', 'like', 'gte', 'order']) q[m] = rec(m);
    q.limit = (...args: unknown[]) => { db.calls.push([`${table}.limit`, ...args]); return Promise.resolve({ data: db.rows, error: null }); };
    q.maybeSingle = () => Promise.resolve({ data: db.partnerUserId ? { user_id: db.partnerUserId } : null, error: null });
    q.update = (v: unknown) => { db.updates.push(v); return q; };
    return q;
  };
  return { supabase: { from: chain } };
});
vi.mock('@/lib/chat', () => ({
  sendPartnerMessage: vi.fn(async (actor: string, target: string, content: string) => { db.sent.push({ actor, target, content }); return { id: 'm1' }; }),
}));

import { parseDeeplink } from './deeplink';
import { openParentingDeeplink, parentingTargetFromDeeplink } from './parenting-nav';
import { peekParentingTarget, clearParentingTarget } from './parenting-target';
import { PUSH_NAV_EVENT } from './pushNav';
import {
  dedupeShares, parentingItemLink, parseParentingShare, partnerShareText, plainShareText, readPartnerShares, sendParentingToPartner,
} from './parenting-share';

const SOS = { kind: 'sos' as const, id: 'shop-tantrum', emoji: '🛒', title: 'Mağazada yerə yıxılıb ağlayır', summary: 'Konfet istədi, “yox” dedin.' };

beforeEach(() => { db.partnerUserId = 'partner-user'; db.sent = []; db.rows = []; db.calls = []; db.updates = []; clearParentingTarget(); });

describe('Tərbiyə links (parseDeeplink)', () => {
  it('parses anacan:// and universal links to the parenting tool with the item', () => {
    for (const url of ['anacan://parenting/sos/shop-tantrum', 'https://app.anacan.az/parenting/sos/shop-tantrum', '/parenting/sos/shop-tantrum/']) {
      expect(parseDeeplink(url), url).toEqual({ action: 'tool', params: { tool_id: 'parenting', parenting_kind: 'sos', parenting_id: 'shop-tantrum' } });
    }
    expect(parseDeeplink('anacan://parenting/article/body-safety')?.params).toMatchObject({ parenting_kind: 'article', parenting_id: 'body-safety' });
    expect(parseDeeplink('anacan://parenting/programme/sleep-7')?.params).toMatchObject({ parenting_kind: 'programme', parenting_id: 'sleep-7' });
  });

  it('rejects unknown kinds, bad ids and foreign hosts', () => {
    expect(parseDeeplink('anacan://parenting/quiz/style')).toBeNull();
    expect(parseDeeplink('anacan://parenting/sos/Shop_Tantrum')).toBeNull();
    expect(parseDeeplink('anacan://parenting/sos/a/b')).toBeNull();
    expect(parseDeeplink('https://evil.example/parenting/sos/shop-tantrum')).toBeNull();
  });

  it('turns a parsed link into the tool target and opens the mother’s tool or the partner’s screen', () => {
    const parsed = parseDeeplink('https://app.anacan.az/parenting/sos/shop-tantrum');
    expect(parentingTargetFromDeeplink(parsed)).toEqual({ kind: 'sos', id: 'shop-tantrum' });
    expect(parentingTargetFromDeeplink(parseDeeplink('anacan://tool/parenting'))).toBeNull();
    expect(parentingTargetFromDeeplink({ action: 'tool', params: { tool_id: 'parenting', parenting_kind: 'sos', parenting_id: '../x' } })).toBeNull();
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(PUSH_NAV_EVENT, on);
    expect(openParentingDeeplink(parsed, { partner: true })).toBe(true);
    expect(peekParentingTarget()).toEqual({ kind: 'sos', id: 'shop-tantrum' });
    expect(openParentingDeeplink(parseDeeplink('anacan://parenting/article/body-safety'))).toBe(true);
    expect(openParentingDeeplink(parseDeeplink('anacan://tool/kick'))).toBe(false);
    window.removeEventListener(PUSH_NAV_EVENT, on);
    expect(seen).toEqual([{ screen: 'partner-parenting' }, { tool: 'parenting' }]);
  });
});

describe('Tərbiyə share texts', () => {
  it('the partner message carries the title, summary, hint and a link that parses back to the item', () => {
    const text = partnerShareText(SOS, 'Birlikdə → Tərbiyə:');
    expect(text.split('\n')).toEqual(['🛒 Mağazada yerə yıxılıb ağlayır', 'Konfet istədi, “yox” dedin.', '', 'Birlikdə → Tərbiyə:', 'https://app.anacan.az/parenting/sos/shop-tantrum']);
    expect(parseParentingShare(text)).toEqual({ kind: 'sos', id: 'shop-tantrum' });
    expect(parseDeeplink(parentingItemLink('article', 'body-safety'))?.params.parenting_id).toBe('body-safety');
  });

  it('the share-sheet text has no link and long summaries are cut', () => {
    const text = plainShareText({ ...SOS, summary: 'x'.repeat(600) }, 'Anacan');
    expect(text).not.toContain('https://');
    expect(text.split('\n')[1]).toHaveLength(400);
    expect(text.endsWith('Anacan')).toBe(true);
  });

  it('ignores ordinary messages and other links', () => {
    expect(parseParentingShare('Salam!')).toBeNull();
    expect(parseParentingShare(null)).toBeNull();
    expect(parseParentingShare('https://app.anacan.az/blog/x')).toBeNull();
    expect(parseParentingShare('https://app.anacan.az/parenting/sos/shop-tantrum-but-longer')).toEqual({ kind: 'sos', id: 'shop-tantrum-but-longer' });
  });
});

describe('Tərbiyə: send to partner and the partner’s received list', () => {
  it('resolves the partner’s user id from his profile and sends one chat message', async () => {
    expect(await sendParentingToPartner({ userId: 'me', partnerProfileId: 'p-profile' }, 'hello')).toBe(true);
    expect(db.sent).toEqual([{ actor: 'me', target: 'partner-user', content: 'hello' }]);
    expect(db.calls).toContainEqual(['profiles.eq', 'id', 'p-profile']);
  });

  it('sends nothing when the partner profile cannot be read', async () => {
    db.partnerUserId = null;
    expect(await sendParentingToPartner({ userId: 'me', partnerProfileId: 'p-profile' }, 'hello')).toBe(false);
    expect(db.sent).toEqual([]);
  });

  it('lists the items she sent him, newest first, one row per item', async () => {
    db.rows = [
      { id: 'm3', content: partnerShareText(SOS, 'h'), created_at: '2026-11-08T10:00:00Z', is_read: false },
      { id: 'm2', content: partnerShareText({ ...SOS, kind: 'article', id: 'body-safety' }, 'h'), created_at: '2026-11-07T10:00:00Z', is_read: true },
      { id: 'm1', content: partnerShareText(SOS, 'h'), created_at: '2026-11-06T10:00:00Z', is_read: true },
      { id: 'm0', content: 'not a share', created_at: '2026-11-05T10:00:00Z' },
    ];
    const list = await readPartnerShares('him', { now: Date.parse('2026-11-08T12:00:00Z') });
    expect(list).toEqual([
      { kind: 'sos', id: 'shop-tantrum', messageId: 'm3', at: '2026-11-08T10:00:00Z', read: false },
      { kind: 'article', id: 'body-safety', messageId: 'm2', at: '2026-11-07T10:00:00Z', read: true },
    ]);
    expect(db.calls).toContainEqual(['partner_messages.eq', 'receiver_id', 'him']);
    expect(db.calls).toContainEqual(['partner_messages.eq', 'message_type', 'text']);
    expect(dedupeShares(db.rows, 1)).toHaveLength(1);
  });
});
