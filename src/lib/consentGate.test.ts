import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), platform: vi.fn(() => 'ios'), native: vi.fn(() => false) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.platform, isNativePlatform: mocks.native } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));

import {
  FALLBACK_CONSENT_VERSION,
  acceptConsentGate, canContinue, decideAiConsent, decideConsentGate, fetchConsentState, flushPendingConsents, gateItems,
  isKvkkUser, parseConsentState, readAcceptedVersion, readLocalAiConsent, readPendingConsents, setAiConsent, type ConsentState,
} from './consentGate';

const B = 'https://api.anacan.az';
const U = '00000000-0000-4000-8000-000000000001';
const state = (gate: Partial<ConsentState['gate']>, consents: ConsentState['consents'] = {}): ConsentState =>
  ({ gate: { enabled: true, version: '2.0', ...gate }, consents });
const terms = (version: string, granted = true) => ({ terms: { granted, document_version: version, created_at: '2026-11-07T10:00:00Z' } });

beforeEach(() => { vi.resetAllMocks(); mocks.platform.mockReturnValue('ios'); mocks.native.mockReturnValue(false); localStorage.clear(); });

describe('decideConsentGate', () => {
  it('shows the gate when the Terms acceptance for the current version is missing', () => {
    expect(decideConsentGate({ state: state({}) })).toBe('show');
  });
  it('skips when the current version was already accepted', () => {
    expect(decideConsentGate({ state: state({}, terms('2.0')) })).toBe('skip');
  });
  it('shows again after a version bump (accepted 1.0, current 2.0)', () => {
    expect(decideConsentGate({ state: state({}, terms('1.0')) })).toBe('show');
    expect(decideConsentGate({ state: state({ version: '2.1' }, terms('2.0')) })).toBe('show');
  });
  it('skips when the setting is disabled or has no valid version', () => {
    expect(decideConsentGate({ state: state({ enabled: false }) })).toBe('skip');
    expect(decideConsentGate({ state: state({ version: null }) })).toBe('skip');
  });
  it('never locks anyone out when the RPC failed (state null)', () => {
    expect(decideConsentGate({ state: null })).toBe('skip');
    expect(decideConsentGate({ state: null, localAcceptedVersion: null })).toBe('skip');
  });
  it('trusts a local acceptance of the same version (offline / pending send) but not of an older one', () => {
    expect(decideConsentGate({ state: state({}), localAcceptedVersion: '2.0' })).toBe('skip');
    expect(decideConsentGate({ state: state({}), localAcceptedVersion: '1.0' })).toBe('show');
  });
});

describe('required items', () => {
  it('continues only with terms, health data and age 16 ticked; marketing is optional', () => {
    expect(canContinue({})).toBe(false);
    expect(canContinue({ terms: true, health_data: true })).toBe(false);
    expect(canContinue({ terms: true, age_16: true, marketing: true })).toBe(false);
    expect(canContinue({ terms: true, health_data: true, age_16: true })).toBe(true);
    expect(canContinue({ terms: true, health_data: true, age_16: true, marketing: false })).toBe(true);
  });
  it('records every kind with the current version, marketing as chosen', () => {
    expect(gateItems({ terms: true, health_data: true, age_16: true }, '2.0')).toEqual([
      { kind: 'terms', granted: true, version: '2.0' }, { kind: 'health_data', granted: true, version: '2.0' },
      { kind: 'age_16', granted: true, version: '2.0' }, { kind: 'marketing', granted: false, version: '2.0' },
    ]);
    expect(() => gateItems({ terms: true }, '2.0')).toThrow('CONSENT_REQUIRED_MISSING');
  });
});

describe('server state', () => {
  it('parses my_consents_v1 and rejects malformed payloads', () => {
    expect(parseConsentState({ gate: { enabled: true, version: '2.0' }, consents: { ...terms('2.0'), bogus: { granted: true } } }))
      .toEqual({ gate: { enabled: true, version: '2.0' }, consents: { terms: { granted: true, document_version: '2.0', source: null, created_at: '2026-11-07T10:00:00Z' } } });
    expect(parseConsentState(JSON.stringify({ gate: { enabled: true, version: 'x' }, consents: {} }))?.gate).toEqual({ enabled: false, version: null });
    expect(parseConsentState(null)).toBeNull();
    expect(parseConsentState({ consents: {} })).toBeNull();
  });
  it('returns null (→ skip) on an RPC error, a missing function, a throw or a timeout', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await fetchConsentState()).toBeNull();
    mocks.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await fetchConsentState()).toBeNull();
    mocks.rpc.mockReturnValueOnce(new Promise(() => {}));
    expect(await fetchConsentState(10)).toBeNull();
    expect(decideConsentGate({ state: await fetchConsentState(10) })).toBe('skip');
  });
});

describe('acceptance', () => {
  const choices = { terms: true, health_data: true, age_16: true, marketing: true };
  it('records through record_consents_v1 with source and caches the accepted version', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { gate: { enabled: true, version: '2.0' }, consents: terms('2.0') }, error: null });
    const result = await acceptConsentGate(B, U, choices, '2.0');
    expect(result.synced).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('record_consents_v1', expect.objectContaining({ p_source: 'ios', p_items: expect.arrayContaining([{ kind: 'marketing', granted: true, version: '2.0' }]) }));
    expect(readAcceptedVersion(B, U)).toBe('2.0');
    expect(readAcceptedVersion(B, 'other-user')).toBeNull();
    expect(readAcceptedVersion('https://other.backend', U)).toBeNull();
    expect(readPendingConsents(B, U)).toBeNull();
  });
  it('keeps an offline acceptance locally (no re-ask) and sends it later', async () => {
    mocks.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await acceptConsentGate(B, U, choices, '2.0')).synced).toBe(false);
    expect(readPendingConsents(B, U)?.items).toHaveLength(4);
    expect(decideConsentGate({ state: state({}), localAcceptedVersion: readAcceptedVersion(B, U) })).toBe('skip');
    mocks.rpc.mockResolvedValueOnce({ data: { gate: { enabled: true, version: '2.0' }, consents: terms('2.0') }, error: null });
    expect(await flushPendingConsents(B, U)).toBe(true);
    expect(readPendingConsents(B, U)).toBeNull();
  });
  it('drops a pending acceptance the server rejects for a new version, so the gate asks again', async () => {
    mocks.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await acceptConsentGate(B, U, choices, '2.0');
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'CONSENT_VERSION_MISMATCH' } });
    expect(await flushPendingConsents(B, U)).toBe(false);
    expect(readPendingConsents(B, U)).toBeNull();
    expect(readAcceptedVersion(B, U)).toBeNull();
  });
});

describe('Türkiye (KVKK)', () => {
  it('detects Türkiye by profile country or app language', () => {
    expect(isKvkkUser('TR', 'az')).toBe(true);
    expect(isKvkkUser('tr', 'en')).toBe(true);
    expect(isKvkkUser('AZ', 'tr')).toBe(true);
    expect(isKvkkUser('AZ', 'az')).toBe(false);
    expect(isKvkkUser(null, undefined)).toBe(false);
  });
  it('records child data and each İYS channel separately; marketing = any channel; KVKK rows carry kvkk_tr', () => {
    const items = gateItems({ terms: true, health_data: true, age_16: true, marketing_sms: true }, '2.0', true);
    const by = Object.fromEntries(items.map((i) => [i.kind, i]));
    expect(items.map((i) => i.kind)).toEqual(['terms', 'health_data', 'age_16', 'child_data', 'marketing', 'marketing_email', 'marketing_push', 'marketing_sms']);
    expect(by.health_data).toEqual({ kind: 'health_data', granted: true, version: '2.0', variant: 'kvkk_tr' });
    expect(by.child_data.granted).toBe(false);
    expect(by.marketing.granted).toBe(true);
    expect([by.marketing_email.granted, by.marketing_push.granted, by.marketing_sms.granted]).toEqual([false, false, true]);
    expect(by.terms.variant).toBeUndefined();
    expect(gateItems({ terms: true, health_data: true, age_16: true }, '2.0', true).find((i) => i.kind === 'marketing')?.granted).toBe(false);
    expect(() => gateItems({ terms: true, age_16: true, child_data: true }, '2.0', true)).toThrow('CONSENT_REQUIRED_MISSING');
  });
});

describe('Anacan.AI consent', () => {
  const row = (granted: boolean) => ({ ai_assistant: { granted, document_version: '2.0', created_at: '2026-11-07T10:00:00Z' } });
  it('opens only with a granted consent, asks otherwise; the app_settings switch turns it off', () => {
    expect(decideAiConsent(state({}), null)).toBe('ask');
    expect(decideAiConsent(state({}, row(true)), null)).toBe('open');
    expect(decideAiConsent(state({}, row(false)), true)).toBe('ask');
    expect(decideAiConsent(state({ enabled: false }), null)).toBe('open');
    expect(decideAiConsent(null, null)).toBe('ask');
    expect(decideAiConsent(null, true)).toBe('open');
  });
  it('records grant/decline with the KVKK variant and keeps the decision when offline', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { gate: { enabled: true, version: '2.0' }, consents: row(true) }, error: null });
    expect((await setAiConsent(B, U, true, '2.0', true)).synced).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('record_consents_v1', expect.objectContaining({ p_items: [{ kind: 'ai_assistant', granted: true, version: '2.0', variant: 'kvkk_tr' }] }));
    expect(readLocalAiConsent(B, U)).toBe(true);
    mocks.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await setAiConsent(B, U, false, null)).synced).toBe(false);
    expect(readLocalAiConsent(B, U)).toBe(false);
    expect(readPendingConsents(B, U)?.items).toEqual([{ kind: 'ai_assistant', granted: false, version: FALLBACK_CONSENT_VERSION }]);
  });
});
