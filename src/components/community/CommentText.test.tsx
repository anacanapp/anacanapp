import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CommentText from './CommentText';
import { UserBadge } from './UserBadge';

vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
afterEach(cleanup);
it('keeps non-staff links as text and renders safe staff HTTP(S) links', () => {
  const { rerender } = render(<CommentText content="Look https://example.com/page." allowLinks={false} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  rerender(<CommentText content="Look https://example.com/page." allowLinks />);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/page');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});
it('does not render script URLs or raw HTML as an executable link', () => {
  render(<CommentText content={'javascript:alert(1) <script>alert(1)</script>'} allowLinks />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
});
it('shows Premium for a paid member and alongside a staff badge, but respects explicit expiry', () => {
  const { rerender } = render(<UserBadge type={null} premium />);
  expect(screen.getByText('Premium')).toBeInTheDocument();
  rerender(<UserBadge type="admin" premium />);
  expect(screen.getByText('Premium')).toBeInTheDocument(); expect(screen.getByText('İdarəçi')).toBeInTheDocument();
  rerender(<UserBadge type="premium" premium={false} />);
  expect(screen.queryByText('Premium')).not.toBeInTheDocument();
});
it('opens app links the router knows in-app and leaves other links as browser links', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const seen: unknown[] = [];
  const listener = (event: Event) => seen.push((event as CustomEvent).detail);
  window.addEventListener('anacan:deeplink', listener);
  try {
    render(<CommentText content={'Bax:\nhttps://app.anacan.az/parenting/sos/shop-tantrum\nanacan://tool/names, https://example.com/x https://app.anacan.az/unknown/path'} allowLinks />);
    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://app.anacan.az/parenting/sos/shop-tantrum', 'anacan://tool/names', 'https://example.com/x', 'https://app.anacan.az/unknown/path']);
    expect(links[0]).not.toHaveAttribute('target');
    expect(links[0]).toHaveAttribute('data-in-app-link');
    fireEvent.click(links[0]);
    fireEvent.click(links[1]);
    expect(seen).toEqual([
      { action: 'tool', params: { tool_id: 'parenting', parenting_kind: 'sos', parenting_id: 'shop-tantrum' } },
      { action: 'tool', params: { tool_id: 'names' } },
    ]);
    expect(links[2]).toHaveAttribute('target', '_blank');
    expect(links[3]).toHaveAttribute('target', '_blank');
    expect(links[3]).not.toHaveAttribute('data-in-app-link');
  } finally { window.removeEventListener('anacan:deeplink', listener); }
});
