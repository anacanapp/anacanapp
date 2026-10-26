import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminAdModeration from './AdminAdModeration';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { moderationText } from '@/lib/community-moderation-i18n';
import type { AdReviewDetail, AdReviewItem } from '@/lib/community-moderation';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn(), language: 'az', actor: 'admin-fixture', isAdmin: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://api.anacan.az' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.actor }, isAdmin: mocks.isAdmin }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign((selector: (state: object) => unknown) => selector({ language: mocks.language }), { getState: () => ({ language: mocks.language }) }) }));

const row: AdReviewItem = { id: '3f5f56a1-7cb0-4078-b743-fd1d7b291227', post_id: '1c4080e4-77bc-4aac-99d2-8ad0673e0092', author_id: 'author-fixture',
  revision: 3, state: 'review', language: 'az', created_at: '2026-09-26T10:00:00Z', updated_at: '2026-09-26T10:01:00.123456Z', reviewed_at: null,
  decision_reason: null, attempts: 1, preview: 'Order now', is_anonymous: true, media_count: 0, score: 95, reasons: ['commercial_offer'], author_name: 'Fixture', last_error: null };
const detail: AdReviewDetail = { ...row, current: true, moderator_note: null, reviewed_by: null,
  payload: { content: 'Order now', media_urls: [], is_anonymous: true },
  assessment: { score: 95, reasons: ['commercial_offer'], evidence: ['Order now'], confidence: .98, policyVersion: 'v1', model: 'fixture', mediaComplete: true },
  events: [{ id: 'event', event: 'flagged', actor_id: null, detail: {}, created_at: row.created_at }],
  deliveries: [{ id: 'mail', channel: 'admin_email', event: 'review', state: 'unknown', attempts: 1, error_code: 'SMTP_OUTCOME_UNKNOWN', finished_at: row.updated_at }] };
let client: QueryClient;
function response(data: unknown, error: unknown = null) { return Object.assign(Promise.resolve({ data, error }), { abortSignal() { return this; } }); }
const mount = () => render(<QueryClientProvider client={client}><AdminAdModeration /></QueryClientProvider>);
beforeEach(() => {
  vi.clearAllMocks(); mocks.language = 'az'; mocks.isAdmin = true; mocks.actor = 'admin-fixture';
  window.history.replaceState({}, '', '/admin/ad-moderation');
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.rpc.mockImplementation((name: string) => name === 'admin_community_ad_queue_v1'
    ? response({ items: [row], total: 26, stats: { checking: 2, review: 26, approved: 3, rejected: 1 }, worker: null })
    : name === 'community_ad_case_v1' ? response(detail)
      : response({ ...detail, state: 'approved', updated_at: '2026-09-26T11:00:00Z' }));
});
afterEach(() => { cleanup(); client.clear(); });

it.each(APP_LANGUAGE_CODES)('renders the moderation queue and protected email destination in %s', async language => {
  mocks.language = language; mount();
  expect(screen.getByRole('heading', { level: 1, name: moderationText('title', language) })).toBeInTheDocument();
  expect(await screen.findByTestId('ad-moderation-item')).toHaveTextContent(moderationText('reason_commercial_offer', language));
  expect(screen.getByText(moderationText('email_destination', language))).toHaveTextContent('jamil@anacan.az');
  expect(screen.getByTestId('ad-moderation-page')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
});
it('uses server pagination and an exact language filter', async () => {
  mount(); await screen.findByTestId('ad-moderation-item');
  fireEvent.click(screen.getByRole('button', { name: moderationText('next', 'az') }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_community_ad_queue_v1', expect.objectContaining({ p_offset: 25, p_limit: 25 })));
  const selects = screen.getAllByRole('combobox'); fireEvent.change(selects[1], { target: { value: 'ja' } });
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_community_ad_queue_v1', expect.objectContaining({ p_language: 'ja', p_offset: 0 })));
});
it('approves the exact revision with an immutable request ID and timestamp', async () => {
  mount(); fireEvent.click(await screen.findByTestId('ad-moderation-item'));
  await screen.findByTestId('ad-moderation-case');
  fireEvent.click(screen.getByRole('button', { name: moderationText('approve', 'az') }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_community_ad_decide_v1', expect.objectContaining({
    p_id: row.id, p_revision: 3, p_updated_at: row.updated_at, p_action: 'approve', p_reason: 'not_advertising', p_request: expect.any(String) })));
  await waitFor(() => expect(screen.getByTestId('ad-moderation-case')).toHaveAttribute('data-case-state', 'approved'));
  expect(screen.queryByRole('button', { name: moderationText('retry_delivery', 'az') })).not.toBeInTheDocument();
});
it('opens a secured email case link directly and retains pending state on a concurrent-decision error', async () => {
  window.history.replaceState({}, '', `/admin/ad-moderation?case=${row.id}`);
  const prior = mocks.rpc.getMockImplementation()!;
  mocks.rpc.mockImplementation((name: string, ...args: unknown[]) => name === 'admin_community_ad_decide_v1'
    ? response(null, { code: '40001', message: 'MODERATION_REVIEW_CONFLICT' }) : prior(name, ...args));
  mount(); await screen.findByTestId('ad-moderation-case');
  fireEvent.click(screen.getByRole('button', { name: moderationText('approve', 'az') }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: moderationText('conflict', 'az'), variant: 'destructive' }));
  expect(screen.getByTestId('ad-moderation-case')).toHaveAttribute('data-case-state', 'review');
});
