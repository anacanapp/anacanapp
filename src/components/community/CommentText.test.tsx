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
