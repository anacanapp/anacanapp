import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessagesScreen from './MessagesScreen';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), toast: vi.fn(),
  auth: { user: { id: 'current-user' } },
}));
const PROFILE = '01234567-89ab-4cde-8fab-0123456789ab';
const PARTNER_USER = '11234567-89ab-4cde-8fab-0123456789ab';
const NEXT_PROFILE = '21234567-89ab-4cde-8fab-0123456789ab';
const NEXT_USER = '31234567-89ab-4cde-8fab-0123456789ab';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/components/community/ConversationListScreen', () => ({ default: ({ onOpenChat, onOpenGroup, partnerId, onBack }: any) =>
  <section data-testid="conversations" data-partner-user={partnerId || ''}>
    <button onClick={() => onOpenChat('11234567-89ab-4cde-8fab-0123456789ab', 'Partner', null)}>Partner conversation</button>
    <button onClick={() => onOpenChat('other-dm-user', 'Other user', '/other.png')}>DM conversation</button>
    <button onClick={() => onOpenGroup('joined-group')}>Group conversation</button>
    <button onClick={onBack}>Back</button>
  </section>,
}));
vi.mock('@/components/community/DirectMessageScreen', () => ({ default: ({ userId, userName, userAvatar, onBack }: any) =>
  <section data-testid="dm" data-user={userId} data-name={userName} data-avatar={userAvatar || ''}>
    <button onClick={onBack}>Close chat</button>
  </section>,
}));
vi.mock('@/components/MotherChatScreen', () => ({ default: ({ onBack }: any) =>
  <section data-testid="partner-chat"><button onClick={onBack}>Close chat</button></section>,
}));
vi.mock('@/components/community/GroupChatScreen', () => ({ default: ({ groupId, onBack }: any) =>
  <section data-testid="group-chat" data-group={groupId}><button onClick={onBack}>Close group</button></section>,
}));

let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: 'current-user' };
  mocks.from.mockReturnValue(mocks);
  mocks.select.mockReturnValue(mocks);
  mocks.eq.mockReturnValue(mocks);
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: PARTNER_USER }, error: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});

function viewFor(partnerProfileId?: string | null) {
  return <QueryClientProvider client={client}>
    <MessagesScreen partnerProfileId={partnerProfileId} onBack={() => {}} />
  </QueryClientProvider>;
}

describe('MessagesScreen partner identity', () => {
  it('opens a group independently of a failed partner lookup and returns to Messages', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
    render(viewFor(PROFILE)); fireEvent.click(await screen.findByText('Group conversation'));
    expect(await screen.findByTestId('group-chat')).toHaveAttribute('data-group', 'joined-group');
    fireEvent.click(screen.getByText('Close group')); expect(screen.getByTestId('conversations')).toBeVisible();
  });
  it('resolves the linked profile via RLS and uses the user ID for both the list and partner-chat comparison', async () => {
    render(viewFor(PROFILE));
    expect(await screen.findByTestId('conversations')).toHaveAttribute('data-partner-user', PARTNER_USER);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profiles');
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith('user_id');
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith('id', PROFILE);
    fireEvent.click(screen.getByText('Partner conversation'));
    expect(await screen.findByTestId('partner-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Close chat'));
    fireEvent.click(screen.getByText('DM conversation'));
    const dm = await screen.findByTestId('dm');
    expect(dm).toHaveAttribute('data-user', 'other-dm-user');
    expect(dm).toHaveAttribute('data-name', 'Other user');
    expect(dm).toHaveAttribute('data-avatar', '/other.png');
  });

  it('does not expose a selectable conversation before partner resolution finishes', async () => {
    let resolve!: (value: unknown) => void;
    mocks.maybeSingle.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(viewFor(PROFILE));
    expect(screen.queryByTestId('conversations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    await act(async () => { resolve({ data: { user_id: PARTNER_USER }, error: null }); });
    fireEvent.click(await screen.findByText('Partner conversation'));
    expect(await screen.findByTestId('partner-chat')).toBeInTheDocument();
  });

  it.each(['denied', 'missing', 'network'])('never misclassifies a partner as a DM after a %s lookup', async (failure) => {
    if (failure === 'network') mocks.maybeSingle.mockRejectedValue(new Error('Offline'));
    else mocks.maybeSingle.mockResolvedValue({ data: null, error: failure === 'denied' ? { code: '42501' } : null });
    render(viewFor(PROFILE));
    expect(await screen.findByTestId('conversations')).toHaveAttribute('data-partner-user', '');
    fireEvent.click(screen.getByText('Partner conversation'));
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-chat')).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Could not load partner details', variant: 'destructive' });
    await screen.findByTestId('conversations');
  });

  it('retries a failed identity lookup without opening a guessed DM', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    render(viewFor(PROFILE));
    await screen.findByTestId('conversations');
    fireEvent.click(screen.getByText('Partner conversation'));
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('conversations')).toHaveAttribute('data-partner-user', PARTNER_USER));
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Partner conversation'));
    expect(await screen.findByTestId('partner-chat')).toBeInTheDocument();
  });

  it.each([null, undefined])('keeps ordinary DMs working without a linked partner (%s)', async (partnerProfileId) => {
    render(viewFor(partnerProfileId));
    fireEvent.click(screen.getByText('DM conversation'));
    expect(await screen.findByTestId('dm')).toHaveAttribute('data-user', 'other-dm-user');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('ignores an old profile lookup after the linked profile changes', async () => {
    let resolve!: (value: unknown) => void;
    mocks.maybeSingle.mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValue({ data: { user_id: NEXT_USER }, error: null });
    const view = render(viewFor(PROFILE));
    view.rerender(viewFor(NEXT_PROFILE));
    expect(await screen.findByTestId('conversations')).toHaveAttribute('data-partner-user', NEXT_USER);
    await act(async () => { resolve({ data: { user_id: PARTNER_USER }, error: null }); });
    expect(screen.getByTestId('conversations')).toHaveAttribute('data-partner-user', NEXT_USER);
  });

  it('clears a selected chat when the linked partner changes', async () => {
    const view = render(viewFor(PROFILE));
    fireEvent.click(await screen.findByText('Partner conversation'));
    await screen.findByTestId('partner-chat');
    mocks.maybeSingle.mockResolvedValue({ data: { user_id: NEXT_USER }, error: null });
    view.rerender(viewFor(NEXT_PROFILE));
    expect(await screen.findByTestId('conversations')).toHaveAttribute('data-partner-user', NEXT_USER);
    expect(screen.queryByTestId('partner-chat')).not.toBeInTheDocument();
  });

  it('does not reuse another account\'s cached partner mapping', async () => {
    const view = render(viewFor(PROFILE));
    await screen.findByTestId('conversations');
    mocks.auth.user = { id: 'different-user' };
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
    view.rerender(viewFor(PROFILE));
    await waitFor(() => expect(screen.getByTestId('conversations')).toHaveAttribute('data-partner-user', ''));
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Partner conversation'));
    expect(screen.queryByTestId('dm')).not.toBeInTheDocument();
  });
});
