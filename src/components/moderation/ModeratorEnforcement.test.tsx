import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModeratorEnforcement from './ModeratorEnforcement';
import { moderatorText } from '@/lib/moderator-i18n';

const id = '10000000-0000-4000-8000-000000000001';
const warningId = '20000000-0000-4000-8000-000000000002';
const token = '30000000-0000-4000-8000-000000000003';
const mocks = vi.hoisted(() => ({ userId: '10000000-0000-4000-8000-000000000001', status: {} as any,
  rpc: vi.fn(), signOut: vi.fn(), refetch: vi.fn(), stop: vi.fn(), acknowledged: false, offline: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId }, signOut: mocks.signOut }) }));
vi.mock('@/hooks/useModerator', () => ({ useMyModerationStatus: () => ({ data: mocks.status, refetch: mocks.refetch }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: 'en' }) }));
vi.mock('@/store/whiteNoiseStore', () => ({ useWhiteNoiseStore: { getState: () => ({ stop: mocks.stop }) } }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://backend.example.test' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('./MyModerationDecisions', () => ({ default: () => <div>Decision history</div> }));
const warning = { id: warningId, claim_id: token, reason: 'spam', detail: 'Please stop repeated posts.', created_at: '2026-09-28T12:00:00Z', language: 'en' };
const tree = () => <ModeratorEnforcement><div>Private application</div></ModeratorEnforcement>;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.userId = id; mocks.acknowledged = false; mocks.offline = false;
  mocks.status = { user_id: id, full: false, pending_warnings: 1, restrictions: [] };
  mocks.refetch.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation(async name => {
    if (name === 'ack_my_moderator_warning_v1') {
      if (mocks.offline) return { data: null, error: { message: 'offline' } };
      mocks.acknowledged = true; return { data: true, error: null };
    }
    return { data: mocks.acknowledged ? null : warning, error: null };
  });
});
afterEach(cleanup);
describe('account-bound one-time moderator warnings', () => {
  it('closes with ×, acknowledges the authenticated account and does not reappear after remount', async () => {
    const view = render(tree());
    expect(await screen.findByText(warning.detail)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: moderatorText('close', 'en') }));
    await waitFor(() => expect(mocks.acknowledged).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledWith('ack_my_moderator_warning_v1', { p_actor: id, p_warning: warningId, p_claim: token });
    view.unmount(); render(tree());
    await waitFor(() => expect(screen.queryByTestId('moderator-warning')).not.toBeInTheDocument());
  });
  it('persists only a pending acknowledgement while offline and retries without showing the message again', async () => {
    mocks.offline = true;
    const view = render(tree());
    await screen.findByText(warning.detail);
    fireEvent.click(screen.getByRole('button', { name: moderatorText('close', 'en') }));
    await waitFor(() => expect(screen.queryByTestId('moderator-warning')).not.toBeInTheDocument());
    const key = `anacan-moderator-warning-acks-v1:${encodeURIComponent('https://backend.example.test:' + id)}`;
    expect(localStorage.getItem(key)).toContain(warningId);
    expect(localStorage.getItem(key)).not.toContain(warning.detail);
    view.unmount(); mocks.offline = false; render(tree());
    await waitFor(() => expect(mocks.acknowledged).toBe(true));
    expect(screen.queryByTestId('moderator-warning')).not.toBeInTheDocument();
  });
  it('discards a claim response that arrives after switching accounts', async () => {
    let finish!: (value: unknown) => void;
    mocks.rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(tree());
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    mocks.userId = '40000000-0000-4000-8000-000000000004'; mocks.status = { user_id: mocks.userId, pending_warnings: 0, full: false, restrictions: [] };
    view.rerender(tree());
    await act(async () => finish({ data: warning, error: null }));
    expect(screen.queryByTestId('moderator-warning')).not.toBeInTheDocument();
  });
  it('removes the full application and stops background audio while retaining appeal access', async () => {
    mocks.status = { user_id: id, full: true, pending_warnings: 0, restrictions: [{ id: warningId, scope: 'full', reason: 'spam', detail: 'Repeated abuse', expires_at: null }] };
    render(tree());
    expect(screen.queryByText('Private application')).not.toBeInTheDocument();
    expect(screen.getByTestId('moderator-full-block')).toBeInTheDocument();
    await waitFor(() => expect(mocks.stop).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: moderatorText('appeals', 'en') }));
    expect(screen.getByText('Decision history')).toBeInTheDocument();
  });
});
