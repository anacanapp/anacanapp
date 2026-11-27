import { describe, expect, it, vi } from 'vitest';
import {
  blockMarketUser, buildMarketReport, isMarketBlockedError, loadMarketBlocks, reportTargetForContact,
  submitMarketReport, unblockMarketUser, visibleListings, visibleMessages } from './marketSafety';

const ME = 'me-1';
const SELLER = 'seller-1';

/** Tiny chainable fake of the Supabase query builder: every call is recorded; awaiting yields `result`. */
function fakeClient(result: { data?: unknown; error: unknown } | (() => never)) {
  const calls: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'select', 'eq', 'delete']) chain[m] = (...args: unknown[]) => { calls.push([m, ...args]); return chain; };
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    try { resolve(typeof result === 'function' ? result() : result); } catch (e) { reject(e); }
  };
  const from = vi.fn((table: string) => { calls.push(['from', table]); return chain; });
  return { client: { from }, calls };
}

describe('buildMarketReport', () => {
  it('builds a listing report without a reported user (the server fills the owner)', () => {
    expect(buildMarketReport(ME, { target: 'listing', listingId: 'l1', reportedUserId: SELLER, reason: 'scam', note: '  fake  ' }))
      .toEqual({ reporter_id: ME, target_type: 'listing', listing_id: 'l1', reported_user_id: null, reason: 'scam', note: 'fake' });
  });
  it('requires listing and user for a conversation, and refuses self reports or unknown reasons', () => {
    expect(buildMarketReport(ME, { target: 'conversation', listingId: 'l1', reason: 'spam' })).toBeNull();
    expect(buildMarketReport(ME, { target: 'user', reportedUserId: ME, reason: 'spam' })).toBeNull();
    expect(buildMarketReport(ME, { target: 'user', reportedUserId: SELLER, reason: 'nope' as never })).toBeNull();
    expect(buildMarketReport('', { target: 'user', reportedUserId: SELLER, reason: 'spam' })).toBeNull();
    expect(buildMarketReport(ME, { target: 'conversation', listingId: 'l1', reportedUserId: SELLER, reason: 'harassment', note: '' }))
      .toMatchObject({ target_type: 'conversation', note: null });
  });
  it('caps the note at 500 characters', () => {
    expect(buildMarketReport(ME, { target: 'user', reportedUserId: SELLER, reason: 'other', note: 'x'.repeat(900) })?.note).toHaveLength(500);
  });
  it('reports the conversation only once a message exists', () => {
    expect(reportTargetForContact(0)).toBe('user');
    expect(reportTargetForContact(3)).toBe('conversation');
  });
});

describe('submitMarketReport', () => {
  const input = { target: 'user' as const, reportedUserId: SELLER, reason: 'spam' as const };
  it('inserts into market_reports', async () => {
    const { client, calls } = fakeClient({ error: null });
    await expect(submitMarketReport(client, ME, input)).resolves.toBe('sent');
    expect(calls[0]).toEqual(['from', 'market_reports']);
    expect(calls[1][0]).toBe('insert');
  });
  it('maps a duplicate pending report, a missing table and other errors', async () => {
    await expect(submitMarketReport(fakeClient({ error: { code: '23505' } }).client, ME, input)).resolves.toBe('duplicate');
    await expect(submitMarketReport(fakeClient({ error: { code: 'PGRST205' } }).client, ME, input)).resolves.toBe('unavailable');
    await expect(submitMarketReport(fakeClient({ error: { code: '500' } }).client, ME, input)).resolves.toBe('failed');
    await expect(submitMarketReport(fakeClient(() => { throw new Error('offline'); }).client, ME, input)).resolves.toBe('failed');
  });
});

describe('blocks', () => {
  it('loads the blocked ids and fails quietly to an empty set', async () => {
    const ok = fakeClient({ data: [{ blocked_id: 'a' }, { blocked_id: 'b' }], error: null });
    expect([...(await loadMarketBlocks(ok.client, ME))]).toEqual(['a', 'b']);
    expect(ok.calls).toContainEqual(['eq', 'blocker_id', ME]);
    expect((await loadMarketBlocks(fakeClient({ data: null, error: { code: '42P01' } }).client, ME)).size).toBe(0);
    expect((await loadMarketBlocks(fakeClient({ error: null }).client, null)).size).toBe(0);
  });
  it('blocks (idempotent on duplicate) and never blocks oneself', async () => {
    await expect(blockMarketUser(fakeClient({ error: null }).client, ME, SELLER)).resolves.toBe(true);
    await expect(blockMarketUser(fakeClient({ error: { code: '23505' } }).client, ME, SELLER)).resolves.toBe(true);
    await expect(blockMarketUser(fakeClient({ error: { code: '42501' } }).client, ME, SELLER)).resolves.toBe(false);
    await expect(blockMarketUser(fakeClient({ error: null }).client, ME, ME)).resolves.toBe(false);
  });
  it('unblocks by blocker and blocked id', async () => {
    const f = fakeClient({ error: null });
    await expect(unblockMarketUser(f.client, ME, SELLER)).resolves.toBe(true);
    expect(f.calls).toEqual([['from', 'market_blocks'], ['delete'], ['eq', 'blocker_id', ME], ['eq', 'blocked_id', SELLER]]);
  });
  it('hides blocked sellers listings (never my own) and blocked senders messages', () => {
    const blocked = new Set([SELLER]);
    const listings = [{ id: '1', user_id: SELLER }, { id: '2', user_id: 'x' }, { id: '3', user_id: ME }];
    expect(visibleListings(listings, blocked, ME).map((l) => l.id)).toEqual(['2', '3']);
    expect(visibleListings(listings, new Set(), ME)).toBe(listings);
    expect(visibleMessages([{ sender_id: SELLER }, { sender_id: ME }], blocked)).toEqual([{ sender_id: ME }]);
  });
  it('recognises the server block refusal', () => {
    expect(isMarketBlockedError({ code: '42501', message: 'MARKET_BLOCKED' })).toBe(true);
    expect(isMarketBlockedError({ code: '42501', message: 'new row violates row-level security' })).toBe(false);
    expect(isMarketBlockedError(null)).toBe(false);
  });
});
