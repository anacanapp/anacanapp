import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPartnerCodeForSharing, getPartnerLinkErrorMessage, isAzurePartnerPairingEnabled,
  linkPartnerByCode, normalizeSecurePartnerCode, PartnerLinkError,
} from './partner-link';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', 'true');
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('Azure pairing opt-in', () => {
  it.each([undefined, '', 'false', '1', 'TRUE'])('does not opt in for %s', async (flag) => {
    vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', flag);
    expect(isAzurePartnerPairingEnabled()).toBe(false);
    await expect(getPartnerCodeForSharing('ANACAN-A01F')).resolves.toBe('ANACAN-A01F');
    await expect(linkPartnerByCode('ANACAN-ABCD2345')).rejects.toMatchObject({ code: 'PAIRING_UNAVAILABLE' });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('normalizes current 6/8 character codes and sends only the code', async () => {
    expect(normalizeSecurePartnerCode('  anacan-abcd23  ')).toBe('ANACAN-ABCD23');
    await linkPartnerByCode('  anacan-abcd2345  ');
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('link_partner_by_code', { p_partner_code: 'ANACAN-ABCD2345' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('accepts idempotent success without any client-side link updates', async () => {
    await linkPartnerByCode('ANACAN-ABCD23');
    await linkPartnerByCode('ANACAN-ABCD23');
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects weak invitations before any signup preflight or RPC', async () => {
    await expect(linkPartnerByCode(' anacan-a01f ')).rejects.toMatchObject({ code: 'PARTNER_CODE_EXPIRED' });
    expect(getPartnerLinkErrorMessage(new PartnerLinkError('PARTNER_CODE_EXPIRED'))).toContain('share a new code');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(['', 'ANACAN-ABCDE', 'ANACAN-ABCDEF2', 'ANACAN-ABCD01', 'ANACAN-ABCDEFGI', 'ANACAN-ABCD23456', 'X'.repeat(65), null])(
    'rejects malformed or oversized input %s', async (code) => {
      await expect(linkPartnerByCode(code as string)).rejects.toMatchObject({ code: 'INVALID_PARTNER_CODE' });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(['PAIRING_SELF_LINK', 'PAIRING_CONFLICT', 'PAIRING_RATE_LIMITED', 'PROFILE_NOT_READY', 'PAIRING_RETRY'])(
    'propagates the server rejection %s without falling back', async (error) => {
      mocks.rpc.mockResolvedValue({ data: { ok: false, error }, error: null });
      await expect(linkPartnerByCode('ANACAN-ABCD2345')).rejects.toMatchObject({ code: error });
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it.each([null, false, true, [], {}, { ok: false }, { ok: 'true' }])('does not mistake %j for success', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(linkPartnerByCode('ANACAN-ABCD2345')).rejects.toMatchObject({ code: 'PAIRING_FAILED' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42501'])('never retries a missing/forbidden RPC (%s) via legacy writes', async (code) => {
    const error = { code, message: 'Server detail' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(linkPartnerByCode('ANACAN-ABCD2345')).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propagates transport failure without a fallback', async () => {
    const error = new Error('offline');
    mocks.rpc.mockRejectedValue(error);
    await expect(linkPartnerByCode('ANACAN-ABCD2345')).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe('secure invitation sharing', () => {
  it.each(['ANACAN-ABCD23', 'ANACAN-ABCD2345'])('uses the owner-authenticated RPC value %s', async (code) => {
    mocks.rpc.mockResolvedValue({ data: code, error: null });
    await expect(getPartnerCodeForSharing('ANACAN-A01F')).resolves.toBe(code);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('ensure_secure_partner_code');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([null, 'ANACAN-A01F', false])('does not share a stale code when the server returns %j', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getPartnerCodeForSharing('ANACAN-A01F')).rejects.toMatchObject({ code: 'PAIRING_UNAVAILABLE' });
  });

  it('propagates rotation errors and hides unrecognized server details in UI messages', async () => {
    const error = { code: 'PGRST202', message: 'private-server-detail' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(getPartnerCodeForSharing('ANACAN-A01F')).rejects.toBe(error);
    expect(getPartnerLinkErrorMessage(error)).not.toContain(error.message);
    expect(getPartnerLinkErrorMessage({ code: 'P0001', message: 'PROFILE_NOT_READY' })).toContain('do not register again');
  });
});
