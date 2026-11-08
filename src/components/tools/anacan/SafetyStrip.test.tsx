import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SafetyMore, SafetyStrip } from './SafetyStrip';

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback }));
vi.mock('@/hooks/useEmergencyNumber', () => ({ useEmergencyNumber: () => '103' }));
afterEach(cleanup);

it('renders the sign line and a tel: link with the country emergency number', () => {
  render(<SafetyStrip signs="Zəng edin: qanaxma, baş ağrısı" />);
  expect(screen.getByText('Zəng edin: qanaxma, baş ağrısı')).toBeTruthy();
  const link = screen.getByRole('link');
  expect(link.getAttribute('href')).toBe('tel:103');
  expect(link.textContent).toContain('Zəng et 103');
  expect(screen.getByRole('note')).toBeTruthy();
});

it('renders a collapsed doctor-check line', () => {
  const { container } = render(<SafetyMore summary="Əvvəlcə həkimlə danışın" text="plasenta previa" />);
  expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
  expect(screen.getByText('plasenta previa')).toBeTruthy();
});
