import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DoctorsHospitals from './DoctorsHospitals';

const mocks = vi.hoisted(() => ({ providers: [] as any[], language: 'en' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { country_code: 'AZ' } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: mocks.language, countryCode: 'AZ' }) }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {}, trackEvent: () => {} }));
vi.mock('./doctors/ProviderReviews', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const q: any = {
    select: () => q, eq: () => q,
    order: () => q,
    single: async () => ({ data: null, error: { message: 'x' } }),
    then: (resolve: any) => resolve({ data: mocks.providers, error: null }),
  };
  const channel: any = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => q, channel: () => channel, removeChannel: () => {} } };
});

const provider = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Dr. A', name_az: 'Dr. A', provider_type: 'doctor', specialty: 'Endo', specialty_az: 'Endo',
  description: 'Experience: 16 years\nLanguages: Azerbaijani\nEducation: Medical University\nCertificate: ESC\n\nLong bio.',
  description_az: 'Təcrübə: 16 il', address: 'Nizami 1', address_az: 'Nizami 1', city: 'Baku', country_code: 'AZ',
  phone: '+994 12 000 00 00', email: null, website: null, working_hours: null, services: null, image_url: null,
  rating: 0, review_count: 0, latitude: null, longitude: null, is_featured: false, accepts_reservations: true, ...over,
});
const renderIt = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <DoctorsHospitals onBack={() => {}} /></QueryClientProvider>);

beforeEach(() => { mocks.providers = [provider({ description_en: 'Experience: 16 years\nLanguages: Azerbaijani\nEducation: Medical University\nCertificate: ESC\n\nLong bio.' })]; });
afterEach(cleanup);

it('shows a translated profile as structured fields and replaces the disabled booking with call and directions', async () => {
  const log = vi.spyOn(console, 'log');
  renderIt();
  fireEvent.click(await screen.findByText('Dr. A'));
  expect(screen.getByText('16 years')).toBeInTheDocument();
  expect(screen.getByText('Azerbaijani')).toBeInTheDocument();
  expect(screen.getByTestId('provider-profile-fields')).toHaveTextContent('CertificateESC');
  expect(screen.getByText('Long bio.')).toBeInTheDocument();
  expect(screen.queryByText(/Rezervasiya/)).not.toBeInTheDocument();
  const actions = screen.getByTestId('provider-actions');
  expect(actions.querySelector('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+994 12 000 00 00');
  expect(actions.querySelector('a[href^="https://www.google.com/maps/dir/"]')).not.toBeNull();
  expect(log).not.toHaveBeenCalled();
});

it('shows no action row when there is neither a phone nor an address', async () => {
  mocks.providers = [provider({ phone: null, address: null, address_az: null })];
  renderIt();
  fireEvent.click(await screen.findByText('Dr. A'));
  expect(screen.queryByTestId('provider-actions')).not.toBeInTheDocument();
  expect(screen.queryByText(/Rezervasiya/)).not.toBeInTheDocument();
});
