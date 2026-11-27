import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Film, Grid3X3, MessageCircle, Pencil, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useCommunityProfileStats, type ConnectionDirection } from '@/hooks/useCommunitySocial';
import { useStories, useToggleStoryLike } from '@/hooks/useStories';
import { getPublicProfileCard } from '@/lib/public-profile-cards';
import { getLifeStageMeta } from '@/lib/lifeStageLabel';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from '@/lib/tr';
import { UserBadge, VerifiedTick, isVerifiedActive } from './UserBadge';
import CommunityPostFeed from './CommunityPostFeed';
import CommunityConnections from './CommunityConnections';
import FollowButton from './FollowButton';
import StoryViewer from './StoryViewer';

interface UserProfileScreenProps {
  userId: string;
  onBack: () => void;
  onUserClick: (userId: string) => void;
  onSendMessage?: (userId: string, name: string, avatar: string | null) => void;
  onEditProfile?: () => void;
  onCreatePost?: () => void;
}

export default function UserProfileScreen({ userId, onBack, onUserClick, onSendMessage, onEditProfile, onCreatePost }: UserProfileScreenProps) {
  const { user } = useAuth();
  const isCurrentUser = user?.id === userId;
  const [activeTab, setActiveTab] = useState<'posts' | 'stories' | 'saved'>('posts');
  const [connections, setConnections] = useState<ConnectionDirection | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  useScrollToTop([userId, activeTab]);
  const profileQuery = useQuery({
    queryKey: ['community-profile-card', user?.id ?? null, userId],
    queryFn: () => getPublicProfileCard(userId),
    enabled: !!userId,
    staleTime: 10000,
  });
  const statsQuery = useCommunityProfileStats(userId);
  const { storyGroups, isLoading: storiesLoading, markAsViewed, deleteStory } = useStories(null);
  const toggleStoryLike = useToggleStoryLike();
  const storyGroup = storyGroups.find((group) => group.user_id === userId);
  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const lifeStage = getLifeStageMeta(profile?.life_stage);
  const verified = isVerifiedActive(profile?.is_verified, profile?.verified_until);

  useEffect(() => { setActiveTab('posts'); setConnections(null); setOpenStoryId(null); }, [userId]);
  useEffect(() => { if (!storyGroup) setOpenStoryId(null); }, [storyGroup]);

  return <div className="a-scope community-native-text min-h-screen pb-24" style={{ background: 'var(--a-bg)' }} data-community-profile={userId}>
    <div className="a-shell">
      <header className="a-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onBack} className="a-icon-btn" aria-label={tr('common_geri', 'Geri')}><ArrowLeft size={18} className="rtl:rotate-180" /></button>
          <h1 className="a-wordmark" style={{ fontSize: 18 }}>{isCurrentUser ? tr('community_my_profile', 'Cəmiyyət profilim') : tr('untranslated_profil_v8b0sk', 'Profil')}</h1>
        </div>
        {isCurrentUser && onEditProfile && <button onClick={onEditProfile} className="a-icon-btn" aria-label={tr('community_edit_profile', 'Profili redaktə et')}><Pencil size={18} /></button>}
      </header>

      {profileQuery.isPending ? <div className="a-card space-y-4" role="status" aria-label={tr('community_loading', 'Yüklənir')}>
        <Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-6 w-40" /><Skeleton className="h-20 w-full" />
      </div> : !profile ? <div className="a-card text-center py-8">
        <p>{profileQuery.isError ? tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.') : tr('community_profile_missing', 'İstifadəçi tapılmadı')}</p>
        {profileQuery.isError && <button className="a-btn-soft mt-3" onClick={() => void profileQuery.refetch()}>{tr('community_retry', 'Yenidən yoxla')}</button>}
      </div> : <>
        <section className="a-card community-profile-card">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 shrink-0" style={{ border: '3px solid var(--a-peach-1)' }}>
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', fontSize: 28, fontWeight: 800 }}>{profile.name?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold break-words">{profile.name || tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi')}</h2>
                {verified && <VerifiedTick size={17} />}
                <UserBadge type={profile.badge_type as 'admin' | 'premium' | 'moderator' | null} premium={profile.is_premium ?? undefined} />
              </div>
              {lifeStage && <span className="inline-block rounded-full px-3 py-1 mt-2 text-xs font-bold" style={{ background: lifeStage.bg, color: lifeStage.ink }}>{lifeStage.label}</span>}
              {profile.created_at && <p className="mt-2 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
                {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true, locale: getCurrentDateLocale() })} {tr('userprofilescreen_qosuldu_78ba1a', 'qoşuldu')}
              </p>}
            </div>
          </div>

          <div className="community-profile-stats">
            {[
              { id: 'posts', label: tr('userprofilescreen_postlar', 'Postlar'), count: stats?.posts_count, open: () => setActiveTab('posts') },
              { id: 'followers', label: tr('community_followers', 'İzləyicilər'), count: stats?.followers_count, open: () => setConnections('followers') },
              { id: 'following', label: tr('community_following_people', 'İzlədikləri'), count: stats?.following_count, open: () => setConnections('following') },
            ].map((stat) => <button type="button" key={stat.id} onClick={stat.open} data-profile-stat={stat.id}>
              <strong>{stat.count ?? '—'}</strong><span>{stat.label}</span>
            </button>)}
          </div>
          {statsQuery.isError && <div role="alert" className="text-sm mt-3">
            <p>{tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.')}</p>
            <button className="a-btn-soft mt-2" onClick={() => void statsQuery.refetch()}>{tr('community_retry', 'Yenidən yoxla')}</button>
          </div>}
          {!!stats?.likes_count && <p className="text-xs mt-3 text-center" style={{ color: 'var(--a-ink-soft)' }}>{stats.likes_count} {tr('community_received_likes', 'bəyənmə')}</p>}

          {!isCurrentUser && <div className="community-profile-actions">
            <FollowButton userId={userId} isFollowing={stats?.is_following || false} loading={!stats} />
            {onSendMessage && <button className="a-btn-soft" onClick={() => onSendMessage(userId, profile.name || tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi'), profile.avatar_url)}>
              <MessageCircle size={17} />{tr('community_message', 'Mesaj yaz')}
            </button>}
          </div>}
          {isCurrentUser && onCreatePost && <button className="a-btn-solid w-full justify-center mt-4" onClick={onCreatePost}><Plus size={17} />{tr('groupfeed_paylasim_yarat_69bdcd', 'Paylaşım yarat')}</button>}
        </section>

        <div className="community-feed-tabs hide-scrollbar mt-4" role="tablist" aria-label={tr('community_profile_sections', 'Profil bölmələri')}>
          <button className={`a-tab${activeTab === 'posts' ? ' active' : ''}`} role="tab" aria-selected={activeTab === 'posts'} onClick={() => setActiveTab('posts')}><Grid3X3 size={15} />{isCurrentUser ? tr('community_my_posts', 'Mənim postlarım') : tr('userprofilescreen_postlar', 'Postlar')}</button>
          <button className={`a-tab${activeTab === 'stories' ? ' active' : ''}`} role="tab" aria-selected={activeTab === 'stories'} onClick={() => setActiveTab('stories')}><Film size={15} />{tr('community_stories', 'Hekayələr')}</button>
          {isCurrentUser && <button className={`a-tab${activeTab === 'saved' ? ' active' : ''}`} role="tab" aria-selected={activeTab === 'saved'} onClick={() => setActiveTab('saved')}><Bookmark size={15} />{tr('community_saved', 'Saxlanmışlar')}</button>}
        </div>

        {activeTab === 'posts' && <CommunityPostFeed view="profile" authorId={userId} onUserClick={onUserClick} onCreatePost={isCurrentUser ? onCreatePost : undefined} />}
        {activeTab === 'saved' && isCurrentUser && <CommunityPostFeed view="saved" onUserClick={onUserClick} onExplore={onBack} />}
        {activeTab === 'stories' && (storiesLoading ? <Skeleton className="h-40 rounded-2xl" /> : !storyGroup?.stories.length ? <div className="a-card text-center py-8"><Film size={28} className="mx-auto mb-3" /><p className="text-sm">{tr('community_stories_empty', 'Aktiv hekayə yoxdur')}</p></div> :
          <div className="grid grid-cols-3 gap-2">
            {storyGroup.stories.map((story) => <button key={story.id} onClick={() => setOpenStoryId(story.id)} className="relative aspect-[9/16] overflow-hidden rounded-2xl" aria-label={tr('community_open_story', 'Hekayəni aç')}>
              {story.media_type === 'video' ? <video src={story.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" /> : <img src={story.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
              <span className="absolute bottom-2 start-2 text-white text-xs rounded-full bg-black/50 px-2 py-1">{formatDistanceToNow(new Date(story.created_at), { locale: getCurrentDateLocale() })}</span>
            </button>)}
          </div>)}
      </>}
    </div>
    {connections && <CommunityConnections userId={userId} direction={connections} onClose={() => setConnections(null)} onUserClick={onUserClick} />}
    {openStoryId && storyGroup && <StoryViewer storyGroups={[storyGroup]} initialGroupIndex={0} initialStoryId={openStoryId}
      onClose={() => setOpenStoryId(null)} onViewed={markAsViewed} onDelete={deleteStory}
      likePending={toggleStoryLike.isPending} onToggleLike={(storyId, isLiked) => toggleStoryLike.mutate({ storyId, isLiked })} />}
  </div>;
}
