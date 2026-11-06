import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/components/LegalScreen', () => ({
  default: ({ initialDocument, onBack }: { initialDocument?: string; onBack: () => void }) =>
    <div data-testid="legal-screen">{initialDocument}<button onClick={onBack}>back</button></div>,
}));

import ConsentGateScreen from './ConsentGateScreen';

const props = () => ({ userId: 'u1', backend: 'https://api.anacan.az', version: '2.0', onAccepted: vi.fn(), onSignOut: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.rpc.mockResolvedValue({ data: { gate: { enabled: true, version: '2.0' }, consents: {} }, error: null });
});

describe('ConsentGateScreen', () => {
  it('renders every item unticked with the medical note, and Continue disabled', () => {
    render(<ConsentGateScreen {...props()} />);
    expect(screen.getByText('İstifadə Şərtləri və Məxfilik Siyasəti ilə tanış oldum və qəbul edirəm')).toBeTruthy();
    expect(screen.getByText('16 yaşdan böyükəm')).toBeTruthy();
    expect(screen.getByText('Anacan tibbi xidmət deyil; məlumatlar həkim məsləhətini əvəz etmir.')).toBeTruthy();
    for (const kind of ['terms', 'health_data', 'age_16', 'marketing']) {
      expect(screen.getByTestId(`consent-${kind}`).getAttribute('data-state')).toBe('unchecked');
    }
    expect((screen.getByTestId('consent-continue') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Continue only after the three required items and records them without marketing', async () => {
    const p = props();
    render(<ConsentGateScreen {...p} />);
    fireEvent.click(screen.getByTestId('consent-terms'));
    fireEvent.click(screen.getByTestId('consent-health_data'));
    expect((screen.getByTestId('consent-continue') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('consent-age_16'));
    expect((screen.getByTestId('consent-continue') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('consent-continue'));
    await waitFor(() => expect(p.onAccepted).toHaveBeenCalledTimes(1));
    expect(mocks.rpc).toHaveBeenCalledWith('record_consents_v1', expect.objectContaining({
      p_source: 'android',
      p_items: [
        { kind: 'terms', granted: true, version: '2.0' }, { kind: 'health_data', granted: true, version: '2.0' },
        { kind: 'age_16', granted: true, version: '2.0' }, { kind: 'marketing', granted: false, version: '2.0' },
      ],
    }));
  });

  it('still lets the user in when recording fails (kept locally, sent later)', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const p = props();
    render(<ConsentGateScreen {...p} />);
    for (const kind of ['terms', 'health_data', 'age_16']) fireEvent.click(screen.getByTestId(`consent-${kind}`));
    fireEvent.click(screen.getByTestId('consent-continue'));
    await waitFor(() => expect(p.onAccepted).toHaveBeenCalledTimes(1));
  });

  it('shows the KVKK notice and the owner\'s Turkish texts for Türkiye users, with İYS channels unticked', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const p = props();
    render(<ConsentGateScreen {...p} kvkk />);
    fireEvent.click(screen.getByText("KVKK Aydınlatma Metni'ni okuyun"));
    expect(open).toHaveBeenCalledWith('https://anacan.az/kvkk', '_blank');
    expect(screen.getByText(/″ANACAN″ Mahdud Mesuliyyetli Cemiyyeti/)).toBeTruthy();
    expect(screen.getByText(/Çocuğumun velisi veya yasal temsilcisi/)).toBeTruthy();
    expect(screen.getByText(/6563 sayılı Elektronik Ticaretin/)).toBeTruthy();
    for (const kind of ['child_data', 'marketing_email', 'marketing_push', 'marketing_sms']) {
      expect(screen.getByTestId(`consent-${kind}`).getAttribute('data-state')).toBe('unchecked');
    }
    expect(screen.queryByTestId('consent-marketing')).toBeNull();
    for (const kind of ['terms', 'health_data', 'age_16', 'marketing_push']) fireEvent.click(screen.getByTestId(`consent-${kind}`));
    fireEvent.click(screen.getByTestId('consent-continue'));
    await waitFor(() => expect(p.onAccepted).toHaveBeenCalledTimes(1));
    const items = mocks.rpc.mock.calls.find((c) => c[0] === 'record_consents_v1')![1].p_items;
    expect(items).toHaveLength(8);
    expect(items).toContainEqual({ kind: 'marketing_push', granted: true, version: '2.0', variant: 'kvkk_tr' });
    expect(items).toContainEqual({ kind: 'child_data', granted: false, version: '2.0', variant: 'kvkk_tr' });
    open.mockRestore();
  });

  it('opens the legal documents in-app and signs out on request', async () => {
    const p = props();
    render(<ConsentGateScreen {...p} />);
    fireEvent.click(screen.getByText('Tibbi xəbərdarlıq'));
    expect((await screen.findByTestId('legal-screen')).textContent).toContain('disclaimer');
    fireEvent.click(screen.getByText('back'));
    fireEvent.click(screen.getByText('Məxfilik Siyasəti'));
    expect((await screen.findByTestId('legal-screen')).textContent).toContain('privacy_policy');
    fireEvent.click(screen.getByText('back'));
    fireEvent.click(screen.getByText('Çıxış et'));
    expect(p.onSignOut).toHaveBeenCalledTimes(1);
  });
});
