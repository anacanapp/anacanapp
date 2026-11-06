import { beforeEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));

import { useConsentGate } from './useConsentGate';
import { rememberAcceptedVersion } from '@/lib/consentGate';

const B = 'https://api.anacan.az';
const payload = (consents: object, gate = { enabled: true, version: '2.0' }) => ({ data: { gate, consents }, error: null });
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });

it('skips for a logged-out user without calling the server', () => {
  const { result } = renderHook(() => useConsentGate(null, B));
  expect(result.current.status).toBe('skip');
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('shows the gate when the current Terms version is missing, and hides it once accepted', async () => {
  mocks.rpc.mockResolvedValue(payload({}));
  const { result } = renderHook(() => useConsentGate('u1', B));
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('show'));
  expect(result.current.consent?.gate.version).toBe('2.0');
});

it('skips when disabled in app_settings or when the RPC fails (no lock-out)', async () => {
  mocks.rpc.mockResolvedValueOnce(payload({}, { enabled: false, version: '2.0' }));
  const disabled = renderHook(() => useConsentGate('u1', B));
  await waitFor(() => expect(disabled.result.current.status).toBe('skip'));
  mocks.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const failed = renderHook(() => useConsentGate('u2', B));
  await waitFor(() => expect(failed.result.current.status).toBe('skip'));
});

it('does not wait for the network when this device already accepted the version', async () => {
  rememberAcceptedVersion(B, 'u1', '2.0');
  mocks.rpc.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useConsentGate('u1', B));
  expect(result.current.status).toBe('skip');
});
