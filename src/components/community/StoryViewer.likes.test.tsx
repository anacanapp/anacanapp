import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'viewer'},profile:null,isAdmin:false})}));
vi.mock('@/hooks/useModerator',()=>({useMyModerationStatus:()=>({data:null}),useModeratorAccess:()=>({data:{allowed:false}})}));
vi.mock('@/hooks/useStoryViewers',()=>({useStoryViewers:()=>({data:[]})}));
vi.mock('@/hooks/useStoryReplies',()=>({useStoryReplies:()=>({data:[]}),useCreateStoryReply:()=>({mutate:vi.fn()}),useDeleteStoryReply:()=>({mutate:vi.fn()})}));
vi.mock('@/lib/tr',()=>({getPersistedLanguage:()=> 'az',tr:(_key:string,fallback:string)=>fallback}));
vi.mock('@/components/ads/AdExperienceProvider',()=>({AdSurface:()=>null,useAdExperience:()=>({busy:false,opportunity:()=>false})}));
import StoryViewer from './StoryViewer';
const groups=(liked=false)=>[{user_id:'author',user_name:'Author',user_avatar:null,stories:[{id:'story',user_id:'author',media_type:'image',media_url:'/fixture.png',created_at:'2026-09-21T10:00:00Z',is_liked:liked,likes_count:27,is_viewed:true,view_count:3}]}] as any;
afterEach(()=>{cleanup();vi.useRealTimers();});
it('animates only a newly requested like, clears the animation, and does not advance the story',async()=>{
  vi.useFakeTimers();const toggle=vi.fn(),close=vi.fn();
  const view=render(<StoryViewer storyGroups={groups()} initialGroupIndex={0} onClose={close} onViewed={()=>{}} onToggleLike={toggle}/>);
  expect(document.querySelector('[data-story-like-animation]')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Bəyən'}));
  expect(toggle).toHaveBeenCalledWith('story',false);expect(document.querySelector('[data-story-like-animation]')).not.toBeNull();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1400);});
  expect(document.querySelector('[data-story-like-animation]')).toBeNull();expect(close).not.toHaveBeenCalled();
  view.rerender(<StoryViewer storyGroups={groups(true)} initialGroupIndex={0} onClose={close} onViewed={()=>{}} onToggleLike={toggle}/>);
  fireEvent.click(screen.getByRole('button',{name:'Bəyənməni geri götür'}));
  expect(toggle).toHaveBeenLastCalledWith('story',true);expect(document.querySelector('[data-story-like-animation]')).toBeNull();
});
it('does not replay hearts on existing likes and blocks duplicate pending writes',()=>{
  const toggle=vi.fn();render(<StoryViewer storyGroups={groups(true)} initialGroupIndex={0} onClose={()=>{}} onViewed={()=>{}} onToggleLike={toggle} likePending/>);
  expect(screen.getByRole('button',{name:'Bəyənməni geri götür'})).toBeDisabled();
  expect(document.querySelector('[data-story-like-animation]')).toBeNull();expect(screen.queryByText('27')).toBeNull();
});
