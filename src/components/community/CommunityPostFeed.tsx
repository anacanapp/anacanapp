import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Bookmark, MessageCircle, Plus, RefreshCw, Users, WifiOff } from 'lucide-react';
import { useCommunityFeed, type CommunityFeedView } from '@/hooks/useCommunitySocial';
import { tr } from '@/lib/tr';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from './PostCard';
import PostSeenObserver from './PostSeenObserver';
import MyModeratedPosts from './MyModeratedPosts';

// PERF: content-visibility lets the browser skip layout/paint for offscreen cards, but
// the DOM nodes/components still exist. On top of that the feed is now WINDOWED: only a
// bounded slice of posts is mounted (MAX_MOUNTED), with top/bottom spacers sized from the
// real measured heights of the posts outside the window so scrolling stays smooth and the
// scrollbar keeps its size. Infinite scroll (fetchNextPage) is preserved.
const FEED_ITEM_STYLE = { contentVisibility: 'auto', containIntrinsicSize: '0 520px' } as const;

const FIRST_PAGE_ANIMATED = 20;
// Estimated card height (matches containIntrinsicSize) for not-yet-measured posts.
const EST_ITEM = 520;
// Hard cap on how many PostCards are mounted at once; the window follows the scroll.
const MAX_MOUNTED = 36;
const INITIAL_MOUNTED = 18;
const GROW_STEP = 12;

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
  const online = useOnlineStatus();

  // ── List virtualization (windowing) ──────────────────────────────────────────
  const posts = feed.posts;
  const total = posts.length;
  const [mountEnd, setMountEnd] = useState(INITIAL_MOUNTED);
  const heightsRef = useRef<Map<string, number>>(new Map());
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;

  // A new feed (view/filter/search change) resets the window.
  useEffect(() => { setMountEnd(INITIAL_MOUNTED); heightsRef.current.clear(); }, [view, groupId, authorId, search]);

  const clampedEnd = Math.min(mountEnd, total);
  const start = Math.max(0, clampedEnd - MAX_MOUNTED);
  const heightOf = (id: string) => heightsRef.current.get(id) ?? EST_ITEM;
  const topSpacer = posts.slice(0, start).reduce((sum, p) => sum + heightOf(p.id), 0);
  const bottomSpacer = posts.slice(clampedEnd).reduce((sum, p) => sum + heightOf(p.id), 0);

  // Measure mounted cards (and keep measuring as images/comments change height) so the
  // spacers standing in for unmounted posts keep the scrollbar and offset accurate.
  useEffect(() => {
    resizeObsRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.postId;
        const h = entry.contentRect.height;
        if (id && h > 0) heightsRef.current.set(id, h);
      }
    });
    return () => { resizeObsRef.current?.disconnect(); resizeObsRef.current = null; };
  }, []);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const id = el.dataset.postId;
    if (id && el.offsetHeight > 0) heightsRef.current.set(id, el.offsetHeight);
    resizeObsRef.current?.observe(el);
  }, []);

  // Grow the window downward and pull more pages as the bottom sentinel approaches.
  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      setMountEnd((prev) => Math.min(total, prev + GROW_STEP));
      if (clampedEnd >= total && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [total, clampedEnd, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scrolling back up brings the window up so earlier posts re-mount.
  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || start === 0) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setMountEnd((prev) => Math.max(MAX_MOUNTED, prev - GROW_STEP));
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [start]);
  // ─────────────────────────────────────────────────────────────────────────────

  // react-query pauses (not fails) a fetch while offline: without cached posts the
  // skeletons would stay forever. Cached posts (persisted feed) still render below.
  const offlineWithoutPosts = feed.isPending && (feed.fetchStatus === 'paused' || !online);
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
    {offlineWithoutPosts ? <div className="a-card text-center py-8" role="status">
      <WifiOff size={28} className="mx-auto mb-3" style={{ color: 'var(--a-ink-soft)' }} />
      <h3 className="font-bold text-base">{tr('community_offline_title', 'İnternet bağlantısı yoxdur')}</h3>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--a-ink-soft)' }}>{tr('community_offline_hint', 'Bağlantı bərpa olunanda paylaşımlar yüklənəcək.')}</p>
      <button type="button" onClick={() => void feed.refetch()} className="a-btn-soft mt-4"><RefreshCw size={15} />{tr('community_retry', 'Yenidən yoxla')}</button>
    </div> : feed.isPending ? <div className="space-y-4" role="status" aria-label={tr('community_loading', 'Yüklənir')}>
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
    {topSpacer > 0 && <div aria-hidden style={{ height: topSpacer }} />}
    <div ref={topSentinelRef} aria-hidden style={{ height: 1 }} />
    {posts.slice(start, clampedEnd).map((post, i) => {
      const index = start + i;
      const card = <PostSeenObserver postId={post.id} createdAt={post.created_at} postUserId={post.user_id}>
        <PostCard post={post} groupId={post.group_id} onUserClick={onUserClick} />
      </PostSeenObserver>;
      // Giriş animasiyası yalnız ilk səhifədə; sonrakı səhifələr zəif cihazlarda onlarla paralel animasiya yaratmasın
      return index < FIRST_PAGE_ANIMATED
        ? <motion.div key={post.id} ref={measureRef} data-post-id={post.id} style={FEED_ITEM_STYLE} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.015, 0.12) }}>{card}</motion.div>
        : <div key={post.id} ref={measureRef} data-post-id={post.id} style={FEED_ITEM_STYLE}>{card}</div>;
    })}
    <div ref={bottomSentinelRef} aria-hidden style={{ height: 1 }} />
    {bottomSpacer > 0 && <div aria-hidden style={{ height: bottomSpacer }} />}
    {feed.hasNextPage && <button type="button" className="a-btn-soft w-full justify-center" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
      {feed.isFetchingNextPage ? tr('community_loading', 'Yüklənir') : tr('community_load_more', 'Daha çox göstər')}
    </button>}
  </div>;
}
