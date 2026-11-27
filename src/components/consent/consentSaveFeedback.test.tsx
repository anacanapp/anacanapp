import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/ui/toast';

const mocks = vi.hoisted(() => ({ flush: vi.fn() }));
vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));
vi.mock('@/lib/consentGate', () => ({ flushPendingConsents: mocks.flush }));

import { showConsentSaveFailure } from './consentSaveFeedback';

const target = { backend: 'https://api.anacan.az', userId: 'u1' };
beforeEach(() => { vi.clearAllMocks(); });

describe('consent save feedback', () => {
  it('says "saved on this device" only for a real offline failure', () => {
    const toast = vi.fn();
    showConsentSaveFailure(toast as never, { ...target, offline: true });
    expect(toast).toHaveBeenCalledWith({ title: 'Seçiminiz cihazda saxlanıldı, internet olanda göndəriləcək.' });
  });

  it('shows a localized error with a retry for a server failure, and retries the stored decision', async () => {
    const toast = vi.fn();
    mocks.flush.mockResolvedValue(true);
    showConsentSaveFailure(toast as never, { ...target, offline: false });
    const call = toast.mock.calls[0][0] as { title: string; variant: string; action: ReactElement };
    expect(call.title).toBe('Seçiminizi indi qeydə almaq alınmadı. Bir az sonra yenidən cəhd edin.');
    expect(call.title).not.toContain('internet olanda');
    expect(call.variant).toBe('destructive');
    render(<ToastProvider>{call.action}</ToastProvider>);
    fireEvent.click(screen.getByText('Yenidən cəhd et'));
    await waitFor(() => expect(mocks.flush).toHaveBeenCalledWith(target.backend, target.userId));
    await waitFor(() => expect(toast).toHaveBeenLastCalledWith({ title: 'Razılıq yeniləndi' }));
  });
});
