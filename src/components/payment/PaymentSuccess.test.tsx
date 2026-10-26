import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PaymentSuccess from './PaymentSuccess';

vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it('does not treat an Azure return URL or forged query flag as proof of payment', () => {
  vi.stubEnv('MODE', 'azure');
  render(<MemoryRouter initialEntries={['/payment/success?success=true&status=paid']}><PaymentSuccess /></MemoryRouter>);
  expect(screen.getByRole('heading')).toHaveTextContent('Ödənişin təsdiqi gözlənilir');
  expect(screen.queryByText('Ödəniş Uğurlu! 🎉')).not.toBeInTheDocument();
});

it('keeps the current source-build return screen', () => {
  vi.stubEnv('MODE', 'production');
  render(<MemoryRouter><PaymentSuccess /></MemoryRouter>);
  expect(screen.getByRole('heading')).toHaveTextContent('Ödəniş Uğurlu!');
});
