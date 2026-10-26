import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultAdsConfiguration } from '@/lib/ads/config';
const mocks = vi.hoisted(() => ({ show: vi.fn(), count: 0, config: null as ReturnType<typeof defaultAdsConfiguration> | null }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ AdSurface: () => null, useAdExperience: () => ({
  configuration: mocks.config, busy: false, opportunity: () => ++mocks.count % 2 === 0, showStory: mocks.show,
}) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' }, profile: null, isAdmin: false }) }));
vi.mock('@/hooks/useModerator', () => ({ useMyModerationStatus: () => ({ data: null }), useModeratorAccess: () => ({ data: { allowed: false } }) }));
vi.mock('@/hooks/useStoryViewers', () => ({ useStoryViewers: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useStoryReplies', () => ({ useStoryReplies: () => ({ data: [] }), useCreateStoryReply: () => ({ mutate: vi.fn() }), useDeleteStoryReply: () => ({ mutate: vi.fn() }) }));
import StoryViewer from './StoryViewer';
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('inserts a story break after two forward completions and preserves the next story while an ad is open', async () => {
  vi.useFakeTimers(); mocks.count = 0; mocks.config = defaultAdsConfiguration();
  mocks.config.placements.find(item => item.id === 'community_story_break')!.min_screen_seconds = 0;
  let closeAd!: (value: boolean) => void;
  mocks.show.mockImplementation(() => new Promise(resolve => { closeAd = resolve; }));
  const viewed = vi.fn();
  const stories = ['one','two','three'].map(id => ({ id, user_id: 'author', media_type: 'image', media_url: 'https://example.test/image.jpg', created_at: new Date().toISOString(), is_viewed: false, text_overlay: null }));
  render(<StoryViewer storyGroups={[{ user_id: 'author', user_name: 'Fixture', user_avatar: null, stories } as any]} initialGroupIndex={0} onClose={vi.fn()} onViewed={viewed} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(6200); });
  expect(document.querySelector('[data-story-viewer]')?.getAttribute('data-story-viewer')).toBe('two');
  expect(mocks.show).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(6200); });
  expect(mocks.show).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-story-viewer]')?.getAttribute('data-story-viewer')).toBe('two');
  await act(async () => { closeAd(true); });
  expect(document.querySelector('[data-story-viewer]')?.getAttribute('data-story-viewer')).toBe('three');
  expect(viewed.mock.calls.map(args => args[0])).toEqual(['one','two','three']);
});
