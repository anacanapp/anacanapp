import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PartnerAIPremiumGate from './PartnerAIPremiumGate';

const state = vi.hoisted(() => ({ isPremium: false, loading: false, stopped: vi.fn() }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => state }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/components/AIChatScreen', () => ({ default: function Chat() {
  useEffect(() => state.stopped, []);
  return <div>Paid partner chat</div>;
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
