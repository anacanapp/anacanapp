import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));

import AiConsentGate from './AiConsentGate';

const B = 'https://api.anacan.az';
const state = (consents: object = {}) => ({ data: { gate: { enabled: true, version: '2.0' }, consents }, error: null });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('AiConsentGate', () => {
  it('asks first; the chat opens only after consent, which is recorded as ai_assistant', async () => {
    mocks.rpc.mockResolvedValueOnce(state()).mockResolvedValueOnce(state({ ai_assistant: { granted: true, document_version: '2.0', created_at: 'x' } }));
    render(<AiConsentGate userId="u1" backend={B} onDecline={vi.fn()}><div>chat</div></AiConsentGate>);
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(screen.getByText(/Google-un Gemini xidmətinə ötürülür/)).toBeTruthy();
    expect(screen.queryByText('chat')).toBeNull();
    fireEvent.click(screen.getByTestId('ai-consent-accept'));
    expect(await screen.findByText('chat')).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith('record_consents_v1', expect.objectContaining({ p_items: [{ kind: 'ai_assistant', granted: true, version: '2.0' }] }));
  });

  it('declining keeps the chat closed and calls onDecline; Türkiye users see the KVKK text', async () => {
    mocks.rpc.mockResolvedValue(state());
    const onDecline = vi.fn();
    render(<AiConsentGate userId="u1" backend={B} kvkk onDecline={onDecline}><div>chat</div></AiConsentGate>);
    expect(await screen.findByText(/Google LLC'ye \(Gemini\)/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('ai-consent-decline'));
    await waitFor(() => expect(onDecline).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('chat')).toBeNull();
  });

  it('opens straight away when consent was already granted', async () => {
    mocks.rpc.mockResolvedValue(state({ ai_assistant: { granted: true, document_version: '2.0', created_at: 'x' } }));
    render(<AiConsentGate userId="u1" backend={B} onDecline={vi.fn()}><div>chat</div></AiConsentGate>);
    expect(await screen.findByText('chat')).toBeTruthy();
  });
});
