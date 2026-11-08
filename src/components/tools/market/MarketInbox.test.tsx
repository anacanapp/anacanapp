import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { groupConversations, type MarketMessage } from '@/lib/marketInbox';
import { MarketInbox } from './MarketInbox';

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (_m, name) => String(values[name])),
}));
vi.mock('@/lib/date-utils', () => ({ getCurrentDateLocale: () => undefined }));
afterEach(cleanup);

const ME = 'me';
const m = (p: Partial<MarketMessage>): MarketMessage => ({
  id: Math.random().toString(36), listing_id: 'L1', sender_id: 'b1', receiver_id: ME, content: 'Hələ satılır?',
  is_read: false, created_at: '2026-11-08T10:00:00', ...p,
});

const messages = [
  m({ created_at: '2026-11-08T10:00:00' }),
  m({ created_at: '2026-11-08T10:02:00', content: 'Bu gün götürə bilərəm' }),
  m({ listing_id: 'L2', sender_id: ME, receiver_id: 's2', content: 'Salam, ölçüsü?', created_at: '2026-11-07T09:00:00' }),
];
const conversations = groupConversations(messages, ME, { listingOwners: { L1: ME } });
const listings = {
  L1: { id: 'L1', user_id: ME, title: 'Uşaq arabası', images: [], category: 'stroller', is_free: false, price: 120, status: 'active' },
};

it('lists seller and buyer conversations with preview, time and unread badge', () => {
  const onOpen = vi.fn();
  render(
    <MarketInbox
      conversations={conversations}
      listings={listings}
      names={{ b1: 'Aynur', s2: 'Leyla' }}
      myId={ME}
      loading={false}
      failed={false}
      onOpen={onOpen}
      onRetry={() => {}}
      now={new Date('2026-11-08T12:00:00')} />,
  );
  const rows = screen.getAllByRole('button');
  expect(rows).toHaveLength(2);
  // newest first: my listing, a buyer wrote twice
  expect(rows[0].textContent).toContain('Uşaq arabası');
  expect(rows[0].textContent).toContain('Alıcı');
  expect(rows[0].textContent).toContain('Aynur');
  expect(rows[0].textContent).toContain('Bu gün götürə bilərəm');
  expect(rows[0].textContent).toContain('10:02');
  expect(screen.getByTestId('market-unread-badge').textContent).toBe('2');
  expect(rows[0].getAttribute('aria-label')).toContain('2 oxunmamış');
  // listing I cannot see: generic title, I am the buyer, my own last message
  expect(rows[1].textContent).toContain('Elan');
  expect(rows[1].textContent).toContain('Satıcı');
  expect(rows[1].textContent).toContain('Siz: Salam, ölçüsü?');
  fireEvent.click(rows[1]);
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'L2', counterpartId: 's2', role: 'buyer' }));
});

it('shows the empty state', () => {
  render(<MarketInbox conversations={[]} listings={{}} names={{}} myId={ME} loading={false} failed={false} onOpen={() => {}} onRetry={() => {}} />);
  expect(screen.getByText('Hələ mesaj yoxdur')).toBeTruthy();
});

it('offers a retry when loading failed', () => {
  const onRetry = vi.fn();
  render(<MarketInbox conversations={[]} listings={{}} names={{}} myId={ME} loading={false} failed onOpen={() => {}} onRetry={onRetry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Yenidən cəhd et' }));
  expect(onRetry).toHaveBeenCalled();
});
