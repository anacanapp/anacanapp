import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowUp, Bookmark, MessageCircle, Plus, RefreshCw, Users } from 'lucide-react';
import { useCommunityFeed, type CommunityFeedView } from '@/hooks/useCommunitySocial';
import { tr } from '@/lib/tr';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from './PostCard';
import PostSeenObserver from './PostSeenObserver';
import MyModeratedPosts from './MyModeratedPosts';

// PERF: feed virtualizasiya olunmayıb — ekrandan kənar postların layout/paint
// işini brauzer atlasın (content-visibility), skroll ölçüsü üçün təxmini hündürlük.
const FEED_ITEM_STYLE = { contentVisibility: 'auto', containIntrinsicSize: '0 520px' } as const;

const FIRST_PAGE_ANIMATED = 20;

interface Props {
  view: CommunityFeedView;
  groupId?: string | null;
  authorId?: string | null;
  search?: string;
  onUserClick?: (userId: string) => void;
  onCreatePost?: () => void;
  onExplore?: () => void;
}

export default function CommunityPostFeed({ view, groupId = null, authorId = null, search = '', onUserClick, onCreatePost, onExplore }: Props) {
  const feed = useCommunityFeed(view, groupId, authorId, search);
  const [hasModeratedPosts, setHasModeratedPosts] = useState(false);
  const EmptyIcon = view === 'saved' ? Bookmark : view === 'following' ? Users : MessageCircle;
  const emptyTitle = search ? tr('groupfeed_netice_tapilmadi_4b1b52', 'Nəticə tapılmadı')
    : view === 'saved' ? tr('community_saved_empty', 'Hələ saxlanmış paylaşım yoxdur')
    : view === 'following' ? tr('community_following_empty', 'İzlədiklərinizdən paylaşım yoxdur')
    : view === 'mine' ? tr('community_mine_empty', 'İlk paylaşımınızı yaradın')
    : tr('groupfeed_hele_paylasim_yoxdur_a0a7fa', 'Hələ paylaşım yoxdur');
  const emptyText = search ? tr('groupfeed_basqa_axtaris_sozleri_sinayin_20e63c', 'Başqa axtarış sözləri sınayın')
    : view === 'saved' ? tr('community_saved_hint', 'Sonra oxumaq üçün paylaşımın yadda saxlama ikonuna toxunun.')
    : view === 'following' ? tr('community_following_hint', 'İstifadəçiləri izləyin; onların açıq paylaşımları burada görünəcək.')
    : tr('community_empty_hint', 'Sualınızı və təcrübənizi Cəmiyyətlə paylaşın.');

  return <div className="space-y-4" data-feed-view={view} aria-busy={feed.isFetching}>
    {view === 'mine' && <MyModeratedPosts onPresenceChange={setHasModeratedPosts} />}
    {feed.isError && <div className="a-card" role="alert">
      <p className="text-sm">{tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.')}</p>
      <button type="button" onClick={() => void feed.refetch()} className="a-btn-soft mt-3"><RefreshCw size={15} />{tr('community_retry', 'Yenidən yoxla')}</button>
    </div>}
    {feed.isPending ? <div className="space-y-4" role="status" aria-label={tr('community_loading', 'Yüklənir')}>
      {[1, 2, 3].map((n) => <Skeleton key={n} className="h-40 rounded-2xl" />)}
    </div> : !feed.isError && feed.posts.length === 0 && !(view === 'mine' && hasModeratedPosts) ? <div className="a-card text-center py-8">
      <EmptyIcon size={32} className="mx-auto mb-4" style={{ color: 'var(--a-accent-ink)' }} />
      <h3 className="font-bold text-base">{emptyTitle}</h3>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--a-ink-soft)' }}>{emptyText}</p>
      {!search && (view === 'saved' || view === 'following') && onExplore && <button className="a-btn-soft mt-4" onClick={onExplore}>{tr('community_explore', 'Cəmiyyəti kəşf et')}</button>}
      {!search && view !== 'saved' && view !== 'following' && onCreatePost && <button className="a-cta-btn mt-4" onClick={onCreatePost}><Plus size={16} />{tr('groupfeed_paylasim_yarat_69bdcd', 'Paylaşım yarat')}</button>}
    </div> : null}
    {feed.newPostsCount > 0 && <button type="button" className="a-btn-soft w-full justify-center" onClick={feed.showNewPosts} aria-live="polite">
      <ArrowUp size={15} />{feed.newPostsCount > 99 ? '99+' : feed.newPostsCount} · {tr('createpostscreen_yeni_paylasim_4f5b15', 'Yeni Paylaşım')}
    </button>}
    {feed.posts.map((post, index) => {
      const card = <PostSeenObserver postId={post.id} createdAt={post.created_at} postUserId={post.user_id}>
        <PostCard post={post} groupId={post.group_id} onUserClick={onUserClick} />
      </PostSeenObserver>;
      // Giriş animasiyası yalnız ilk səhifədə; sonrakı səhifələr zəif cihazlarda onlarla paralel animasiya yaratmasın
      return index < FIRST_PAGE_ANIMATED
        ? <motion.div key={post.id} style={FEED_ITEM_STYLE} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.015, 0.12) }}>{card}</motion.div>
        : <div key={post.id} style={FEED_ITEM_STYLE}>{card}</div>;
    })}
    {feed.hasNextPage && <button type="button" className="a-btn-soft w-full justify-center" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
      {feed.isFetchingNextPage ? tr('community_loading', 'Yüklənir') : tr('community_load_more', 'Daha çox göstər')}
    </button>}
  </div>;
}
