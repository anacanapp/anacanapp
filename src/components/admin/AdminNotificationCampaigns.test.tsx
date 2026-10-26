import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/admin-insights', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin-insights')>(), adminRpc: fixture.rpc }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: fixture.invoke } } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ azure: true, url: 'https://api.anacan.az' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' }, isAdmin: true }) }));
import AdminNotificationCampaigns from './AdminNotificationCampaigns';
let client: QueryClient;
beforeEach(() => {
  fixture.rpc.mockReset(); fixture.invoke.mockReset();
  fixture.rpc.mockImplementation(async name => name === 'admin_notification_list_v1' ? [] : {
    schema: 'anacan-admin-audience-v1', fingerprint: 'a'.repeat(64), users: 3, eligibleUsers: 2, devices: 2, optedOut: 1, quietHours: 0, noDevice: 0, quietTimezone: 'Asia/Baku',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><AdminNotificationCampaigns /></QueryClientProvider>);
it('submits selected language, module and country together and invalidates an old preview after any change', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hamiləlik' }));
  const country = screen.getByRole('group', { name: /Ölkələr/ });
  fireEvent.change(within(country).getByRole('textbox'), { target: { value: 'TR' } });
  const countryButton = within(country).getAllByRole('button').find(button => button.textContent?.includes('🇹🇷'))!;
  fireEvent.click(countryButton);
  fireEvent.click(screen.getByRole('button', { name: 'Auditoriyanı yoxla' }));
  await screen.findByTestId('admin-audience-preview');
  expect(fixture.rpc).toHaveBeenCalledWith('admin_notification_preview_v1', { p_segment: expect.objectContaining({ languages: ['en'], modules: ['bump'], countries: ['TR'] }) });
  fireEvent.change(screen.getByLabelText('Kampaniya başlığı'), { target: { value: 'Hello' } });
  fireEvent.change(screen.getByLabelText('Kampaniya mətni'), { target: { value: 'Message' } });
  expect(screen.getByRole('button', { name: 'Seçilmiş auditoriyaya göndər' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Azərbaycan' }));
  expect(screen.getByRole('button', { name: 'Seçilmiş auditoriyaya göndər' })).toBeDisabled();
  expect(fixture.invoke).not.toHaveBeenCalled();
});
it('keeps one campaign ID after an interrupted send so retry does not create a second campaign', async () => {
  const campaign = { id: '11111111-1111-4111-8111-111111111111', title: 'Title', body: 'Body', segment: {}, total: 2, pending: 2, claimed: 0, sent: 0, failed: 0, skipped: 0, unknown: 0, cancelled: false };
  fixture.rpc.mockImplementation(async name => name === 'admin_notification_list_v1' ? [] : name === 'admin_notification_create_v1' ? campaign : {
    schema: 'anacan-admin-audience-v1', fingerprint: 'a'.repeat(64), users: 2, eligibleUsers: 2, devices: 2, optedOut: 0, quietHours: 0, noDevice: 0,
  });
  fixture.invoke.mockResolvedValue({ data: null, error: new Error('offline') });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Auditoriyanı yoxla' })); await screen.findByTestId('admin-audience-preview');
  fireEvent.change(screen.getByLabelText('Kampaniya başlığı'), { target: { value: 'Title' } });
  fireEvent.change(screen.getByLabelText('Kampaniya mətni'), { target: { value: 'Body' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Seçilmiş auditoriyaya göndər' })); });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kampaniya saxlanıb'));
  expect(fixture.rpc.mock.calls.filter(([name]) => name === 'admin_notification_create_v1')).toHaveLength(1);
  expect(fixture.invoke).toHaveBeenCalledWith('admin-notification-dispatch', { body: { contract: 'anacan-admin-campaign-v1', notificationId: campaign.id } });
  expect(screen.getByLabelText('Kampaniya başlığı')).toBeDisabled();
});
