import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ModeratorActionDialog from './ModeratorActionDialog';
import { moderatorText } from '@/lib/moderator-i18n';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), role: 'moderator', fail: false, done: vi.fn(), close: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'staff' }, isModerator: true, isAdmin: mocks.role === 'admin' }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: 'en' }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://backend.example.test' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = 'moderator'; mocks.fail = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  mocks.rpc.mockImplementation((name: string) => {
    const data = name === 'get_moderator_access_v1' ? { allowed: true, role: mocks.role, user_id: 'staff' }
      : name === 'moderator_content_detail_v1' ? { id: 'post-fixture', user_id: 'author', version: 7, content: 'Original fixture', media_urls: [], created_at: '2026-09-28T00:00:00Z' } : { id: 'action-fixture' };
    const result = Promise.resolve({ data, error: mocks.fail && name.endsWith('_action_v1') ? { code: '40001', message: 'MODERATOR_CONTENT_CONFLICT' } : null });
    return Object.assign(result, { abortSignal: () => result });
  });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = (action: 'edit' | 'restrict') => render(<QueryClientProvider client={client}>
  <ModeratorActionDialog target={{ kind: action === 'edit' ? 'post' : 'user', id: 'post-fixture', userId: 'author' }} action={action} onClose={mocks.close} onDone={mocks.done} />
</QueryClientProvider>);
it('edits the loaded exact content version and keeps a failed draft/request ID for retry', async () => {
  mocks.fail = true; mount('edit');
  const content = await screen.findByDisplayValue('Original fixture');
  fireEvent.change(content, { target: { value: 'Updated fixture' } });
  const submit = screen.getByRole('button', { name: moderatorText('edit', 'en') });
  await waitFor(() => expect(submit).not.toBeDisabled());
  fireEvent.click(submit);
  await screen.findByRole('alert');
  const first = mocks.rpc.mock.calls.find(([name]) => name === 'moderator_content_action_v1')![1];
  expect(first).toMatchObject({ p_kind: 'post', p_id: 'post-fixture', p_version: 7, p_content: 'Updated fixture' });
  expect(content).toHaveValue('Updated fixture'); expect(mocks.close).not.toHaveBeenCalled();
  mocks.fail = false; fireEvent.click(submit);
  await waitFor(() => expect(mocks.done).toHaveBeenCalledOnce());
  const calls = mocks.rpc.mock.calls.filter(([name]) => name === 'moderator_content_action_v1');
  expect(calls[1][1].p_request).toBe(first.p_request);
});
it.each(['moderator', 'admin'])('offers permanent restrictions only to the actual admin role (%s)', async role => {
  mocks.role = role; mount('restrict');
  const submit = screen.getByRole('button', { name: moderatorText('restrict', 'en') });
  await waitFor(() => expect(submit).not.toBeDisabled());
  expect(!!screen.queryByRole('option', { name: moderatorText('duration_permanent', 'en') })).toBe(role === 'admin');
});
