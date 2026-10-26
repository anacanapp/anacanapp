import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StoriesBar from './StoriesBar';

const mocks = vi.hoisted(() => ({ groups: [] as any[], fetching: false, refetch: vi.fn() }));
vi.mock('@/hooks/useStories', () => ({
  useStories: () => ({ storyGroups: mocks.groups, isLoading: false, isFetching: mocks.fetching, refetch: mocks.refetch, createStoryAsync: vi.fn(), isCreating: false, markAsViewed: vi.fn(), deleteStory: vi.fn() }),
  useToggleStoryLike: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' }, profile: { name: 'Owner' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('./StoryCropEditor', () => ({ default: () => null }));
vi.mock('./StoryViewer', () => ({ default: ({ initialStoryId }: any) => <div data-testid="viewer">{initialStoryId}</div> }));
let client: QueryClient;
const group = (ids: string[]) => [{ user_id: 'owner', user_name: 'Owner', user_avatar: null, has_unviewed: true, stories: ids.map(id => ({ id })) }];
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient(); mocks.groups = group(['old']); mocks.fetching = false; mocks.refetch.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); client.clear(); });

describe('freshly published story navigation', () => {
  it('refreshes a stale cached list before consuming a new story target', () => {
    const consumed = vi.fn();
    const view = render(<QueryClientProvider client={client}><StoriesBar autoOpenStoryId="new" onAutoOpenConsumed={consumed} /></QueryClientProvider>);
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(consumed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument();
    mocks.groups = group(['old','new']);
    view.rerender(<QueryClientProvider client={client}><StoriesBar autoOpenStoryId="new" onAutoOpenConsumed={consumed} /></QueryClientProvider>);
    expect(screen.getByTestId('viewer')).toHaveTextContent('new');
    expect(consumed).toHaveBeenCalledOnce();
  });

  it('consumes an unavailable target only after a refresh has completed', () => {
    const consumed = vi.fn();
    const view = render(<QueryClientProvider client={client}><StoriesBar autoOpenStoryId="expired" onAutoOpenConsumed={consumed} /></QueryClientProvider>);
    mocks.fetching = true;
    view.rerender(<QueryClientProvider client={client}><StoriesBar autoOpenStoryId="expired" onAutoOpenConsumed={consumed} /></QueryClientProvider>);
    expect(consumed).not.toHaveBeenCalled();
    mocks.fetching = false;
    view.rerender(<QueryClientProvider client={client}><StoriesBar autoOpenStoryId="expired" onAutoOpenConsumed={consumed} /></QueryClientProvider>);
    expect(consumed).toHaveBeenCalledOnce();
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
