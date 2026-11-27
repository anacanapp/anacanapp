import { beforeEach, describe, expect, it } from 'vitest';
import { PREMIUM_OFFLINE_GRACE_MS, evaluateGrant, newestRecord, readGrantRecord, recordFromServer, writeGrantRecord } from './premium-grant-cache';

const backend = 'https://api.anacan.az', userId = 'user-a';
const scope = { backend, userId, partner: null };
const T0 = Date.parse('2026-11-25T10:00:00Z');
const grant = (active: boolean, expiresAt: string | null = '2026-12-25T10:00:00Z') => ({ active, expiresAt, source: 'subscription' });
const record = (own = grant(true), household = grant(false), now = T0) =>
  recordFromServer({ backend, userId, partner: null, checkedAt: new Date(T0).toISOString(), own, household, now });
beforeEach(() => localStorage.clear());

describe('offline premium grant', () => {
  it('extends a confirmed grant to min(real expiry, confirmation + 72h)', () => {
    const r = record();
    expect(evaluateGrant(r, scope, T0 + PREMIUM_OFFLINE_GRACE_MS - 1).own).toBe(true);
    expect(evaluateGrant(r, scope, T0 + PREMIUM_OFFLINE_GRACE_MS + 1).own).toBe(false);
    const soon = record(grant(true, new Date(T0 + 3600_000).toISOString()));
    expect(evaluateGrant(soon, scope, T0 + 3599_000).own).toBe(true);
    expect(evaluateGrant(soon, scope, T0 + 3601_000).own).toBe(false);
  });
  it('uses server-relative expiry so a wrong device clock cannot lengthen it', () => {
    // Device clock 10 days ahead of the server at confirmation: remaining time is still 1h.
    const r = recordFromServer({ backend, userId, partner: null, checkedAt: new Date(T0).toISOString(),
      own: grant(true, new Date(T0 + 3600_000).toISOString()), household: grant(false), now: T0 + 10 * 86400_000 });
    expect(evaluateGrant(r, scope, T0 + 10 * 86400_000 + 3601_000).own).toBe(false);
  });
  it('never grants without a confirmed active answer', () => {
    expect(evaluateGrant(record(grant(false)), scope, T0).own).toBe(false);
    expect(evaluateGrant(null, scope, T0)).toMatchObject({ own: false, household: false, hadGrant: false });
    expect(evaluateGrant(record(), { ...scope, userId: 'user-b' }, T0).own).toBe(false);
    expect(evaluateGrant(record(), { ...scope, backend: 'https://source.example' }, T0).own).toBe(false);
  });
  it('drops the household part after the partner link changes', () => {
    const r = recordFromServer({ backend, userId, partner: 'p1', checkedAt: new Date(T0).toISOString(), own: grant(false), household: grant(true), now: T0 });
    expect(evaluateGrant(r, { ...scope, partner: 'p1' }, T0 + 1).household).toBe(true);
    expect(evaluateGrant(r, { ...scope, partner: null }, T0 + 1).household).toBe(false);
  });
  it('treats a clock moved back before the confirmation as invalid', () => {
    expect(evaluateGrant(record(), scope, T0 - 24 * 3600_000)).toMatchObject({ own: false, hadGrant: true });
  });
  it('an explicit inactive answer removes the stored grant', () => {
    writeGrantRecord(record());
    expect(readGrantRecord(backend, userId)?.ownUntil).toBeGreaterThan(T0);
    writeGrantRecord(record(grant(false)));
    expect(readGrantRecord(backend, userId)).toBeNull();
  });
  it('picks the newest record', () => {
    const older = record(grant(true), grant(false), T0), newer = record(grant(false), grant(false), T0 + 1000);
    expect(newestRecord(older, newer)).toBe(newer);
    expect(newestRecord(null, older)).toBe(older);
  });
});
