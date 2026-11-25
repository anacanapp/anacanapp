import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = vi.hoisted(() => ({ value: null as any }));
vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) => fallback.replace(/\{(\w+)\}/g, (_m, k) => String(values[k])) }));
vi.mock('@/lib/in-app-epoint', async () => ({
  useInAppEpoint: () => hook.value,
  formatAzn: (n: number) => `${n.toFixed(2)} ₼`,
}));
import EpointPayOption from './EpointPayOption';

const base = () => ({
  available: true, eligible: true, activeSource: null, status: 'idle', messageKey: null, startCheckout: vi.fn(), checkAgain: vi.fn(), priceLabel: () => null,
  offer: { paymentsReady: true, kind: 'campaign', premium: { active: false, source: null },
    plans: { monthly: { price: 2.99, was: 4.99, pct: 40, perMonth: null, usd: null }, yearly: { price: 50.99, was: null, pct: null, perMonth: 4.24, usd: 29.99 } } },
});

describe('EpointPayOption', () => {
  beforeEach(() => { hook.value = base(); });

  it('shows the server price of the selected plan, consent and legal note, and starts the checkout', () => {
    render(<EpointPayOption plan="monthly" source="tool_ai" />);
    expect(screen.getByText('Azərbaycan kartı ilə ödə (Epoint)')).toBeTruthy();
    expect(screen.getByText('2.99 ₼ / ay')).toBeTruthy();
    expect(screen.getByText('4.99 ₼')).toBeTruthy();
    expect(screen.getByText('Kampaniya qiyməti')).toBeTruthy();
    expect(screen.getByText(/hər ay avtomatik yenilənməsinə/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('epoint-pay-monthly'));
    expect(hook.value.startCheckout).toHaveBeenCalledWith('monthly');
  });

  it('shows the AZN price with the USD reference for the in-app offer', () => {
    render(<EpointPayOption plan="yearly" />);
    expect(screen.getByText('50.99 ₼ / il')).toBeTruthy();
    expect(screen.getByText('≈ $29.99')).toBeTruthy();
  });

  it('renders nothing when unavailable or for lifetime', () => {
    hook.value = { ...base(), available: false };
    const { container, rerender } = render(<EpointPayOption plan="yearly" />);
    expect(container.innerHTML).toBe('');
    hook.value = base();
    rerender(<EpointPayOption plan="lifetime" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the error message and the timeout retry, and reports success once', () => {
    hook.value = { ...base(), available: false, status: 'error', messageKey: 'iep_err_premium_store' };
    const { rerender } = render(<EpointPayOption plan="yearly" />);
    expect(screen.getByRole('alert').textContent).toContain('App Store');
    hook.value = { ...base(), status: 'timeout', messageKey: 'iep_timeout' };
    rerender(<EpointPayOption plan="yearly" />);
    fireEvent.click(screen.getByText('Yenidən yoxla'));
    expect(hook.value.checkAgain).toHaveBeenCalled();
    const onPremium = vi.fn();
    hook.value = { ...base(), status: 'success' };
    rerender(<EpointPayOption plan="yearly" onPremium={onPremium} />);
    rerender(<EpointPayOption plan="yearly" onPremium={onPremium} />);
    expect(onPremium).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Premium aktivləşdi');
  });
});
