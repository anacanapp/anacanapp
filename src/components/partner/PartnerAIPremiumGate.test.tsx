import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PartnerAIPremiumGate from './PartnerAIPremiumGate';

const state = vi.hoisted(() => ({ isPremium: false, loading: false, stopped: vi.fn() }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => state }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/hooks/usePartnerData', () => ({ usePartnerData: () => ({
  partnerProfile: { name: 'Fixture', life_stage: 'flow', last_period_date: '2026-10-01', cycle_length: 28 },
  sharing: { share_cycle: false }, getPregnancyWeek: () => 0,
}) }));
vi.mock('@/components/AIChatScreen', () => ({ default: function Chat({ partner }: any) {
  useEffect(() => state.stopped, []);
  return <div data-stage={partner?.lifeStage} data-lmp={String(partner?.lastPeriodDate)}>Paid partner chat</div>;
} }));
vi.mock('@/components/PremiumModal', () => ({ PremiumModal: ({ isOpen, onClose }: any) => isOpen
  ? <div role="dialog"><button onClick={onClose}>Standard Premium paywall</button></div> : null }));
beforeEach(() => { state.isPremium = false; state.loading = false; state.stopped.mockReset(); });
afterEach(cleanup);

it('opens the standard paywall for a free partner without mounting the paid chat', () => {
  render(<PartnerAIPremiumGate />);
  expect(screen.queryByText('Paid partner chat')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Premium-a keç' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Standard Premium paywall');
});

it('stops an open partner chat and opens the standard paywall when its household grant ends', async () => {
  state.isPremium = true;
  const view = render(<PartnerAIPremiumGate />);
  await screen.findByText('Paid partner chat');
  state.isPremium = false;
  view.rerender(<PartnerAIPremiumGate />);
  expect(screen.queryByText('Paid partner chat')).not.toBeInTheDocument();
  expect(state.stopped).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog')).toHaveTextContent('Standard Premium paywall');
  fireEvent.click(screen.getByRole('button', { name: 'Standard Premium paywall' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Paid partner chat')).not.toBeInTheDocument();
});

it('gives Ata AI the woman\'s stage but not unshared cycle dates', async () => {
  state.isPremium = true;
  render(<PartnerAIPremiumGate />);
  const chat = await screen.findByText('Paid partner chat');
  expect(chat).toHaveAttribute('data-stage', 'flow');
  expect(chat).toHaveAttribute('data-lmp', 'null');
});
