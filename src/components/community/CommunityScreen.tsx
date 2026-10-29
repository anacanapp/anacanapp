import { useState, forwardRef, useCallback, useEffect, useRef } from 'react';
import { validate as isUuid } from 'uuid';
import { getPublicProfileCard } from '@/lib/public-profile-cards';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Plus, Search, TrendingUp, Compass, Sparkles, X, Pen, MessageCircle, Bell, UserRound } from 'lucide-react';
import { useCommunityGroups, useUserMemberships } from '@/hooks/useCommunity';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useUserStore } from '@/store/userStore';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FeedTab } from './PostSearchFilter';
import { useActiveBlock } from '@/hooks/useUserBlock';
import { getLocaleTag } from '@/lib/i18n';
import { Ban } from 'lucide-react';


import GroupsList from './GroupsList';
import GroupFeed from './GroupFeed';
import CreatePostScreen from './CreatePostScreen';
import StoriesBar from './StoriesBar';
import SinglePostView from './SinglePostView';
import UserProfileScreen from './UserProfileScreen';
import ConversationListScreen from './ConversationListScreen';
import DirectMessageScreen from './DirectMessageScreen';
import BannerSlot from '@/components/banners/BannerSlot';
import { AdInlineAnchor, AdSurface } from '@/components/ads/AdExperienceProvider';
import { tr } from "@/lib/chat-i18n";
import ChatGroupsPanel from './ChatGroupsPanel';
import GroupChatScreen from './GroupChatScreen';
import { validSharedBlog, type SharedBlog } from '@/lib/community-blog';

export interface CommunityDeepLinkTarget {
  postId?: string;
  commentId?: string;
  storyId?: string;
  dmUserId?: string;
  conversations?: boolean;
  userId?: string;
  groupId?: string;
  composeBlog?: SharedBlog;
}

interface CommunityScreenProps {
  onBack?: () => void;
  onOpenNotifications?: () => void;
  onEditProfile?: () => void;
  /** Bildiriş/push-tap vasitəsilə: "MƏHZ bu paylaşımı/şərhi aç" — bax Index.tsx */
  deepLinkTarget?: CommunityDeepLinkTarget | null;
  /** Deep-link "istehlak" olunduqdan sonra valideyndə təmizləmək üçün (geri qayıdanda təkrar açılmasın) */
  onDeepLinkConsumed?: () => void;
}

const tabs = [
{ id: 'feed', label: tr("communityscreen_umumi_1b5521", 'Ümumi'), icon: TrendingUp },
{ id: 'groups', label: tr('chat_groups', 'Qruplar'), icon: Users }] as
const;

const CommunityScreen = forwardRef<HTMLDivElement, CommunityScreenProps>(({ onBack, onOpenNotifications, onEditProfile, deepLinkTarget, onDeepLinkConsumed }, ref) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'my-groups'>('feed');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  // Bildirişdən gələn "məhz bu postu aç" niyyəti — öz state-inə köçürülür ki,
  // istifadəçi geri düyməsi ilə bağlayanda (deepLinkTarget prop-u valideyndə
  // hələ təmizlənməmiş olsa belə) bu ekran YENİDƏN açılmasın.
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [initialSharedBlog, setInitialSharedBlog] = useState<SharedBlog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileTrail, setProfileTrail] = useState<string[]>([]);
  const [feedView, setFeedView] = useState<FeedTab>('recent');
  const [createReturnUserId, setCreateReturnUserId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [dmChat, setDmChat] = useState<{userId: string;name: string;avatar: string | null;} | null>(null);
  const [resolvingDm, setResolvingDm] = useState(false);
  const [deepLinkKey, setDeepLinkKey] = useState(0);
  const consumedRef = useRef(onDeepLinkConsumed);
  const cancelDmLookup = useRef<(() => void) | null>(null);

  useEffect(() => { consumedRef.current = onDeepLinkConsumed; }, [onDeepLinkConsumed]);
  useEffect(() => () => { cancelDmLookup.current?.(); }, []);

  useScrollToTop([activeTab, selectedGroupId, selectedUserId]);
  useScreenAnalytics('Community', 'Social');

  // CommunityScreen artıq ekranda olsa belə (istifadəçi Community-də ikən YENİ
  // bir bildiriş klik edilsə), yeni deep-link niyyətini qəbul et.
  useEffect(() => {
    if (!deepLinkTarget) return;
    cancelDmLookup.current?.();
    cancelDmLookup.current = null;
    // Also close dialogs/viewers owned by the feed's children.
    setDeepLinkKey((key) => key + 1);
    setSelectedGroupId(null);
    setSelectedUserId(null);
    setProfileTrail([]);
    setFeedView('recent');
    setCreateReturnUserId(null);
    setShowCreatePost(false);
    setInitialSharedBlog(null);
    setShowConversations(false);
    setDmChat(null);
    setResolvingDm(false);
    setOpenPostId(null);
    setOpenCommentId(null);
    setOpenStoryId(null);
    setActiveTab('feed');
    setSearchQuery('');
    setSearchFocused(false);

    if (validSharedBlog(deepLinkTarget.composeBlog)) {
      setInitialSharedBlog(deepLinkTarget.composeBlog); setShowCreatePost(true);
    } else if (deepLinkTarget.dmUserId !== undefined || deepLinkTarget.conversations) {
      setShowConversations(true);
      const userId = deepLinkTarget.dmUserId;
      if (typeof userId === 'string' && isUuid(userId)) {
        let cancelled = false;
        cancelDmLookup.current = () => { cancelled = true; };
        setResolvingDm(true);
        // Push data identifies the sender; only the public card supplies display data.
        void getPublicProfileCard(userId.toLowerCase()).then((card) => {
          if (cancelled || card?.user_id !== userId.toLowerCase()) return;
          setDmChat({
            userId: card.user_id,
            name: card.name || tr('usedirectmessages_i_stifadeci_b6bdd6', '\u0130stifad\u0259\u00e7i'),
            avatar: card.avatar_url,
          });
          setShowConversations(false);
        }).catch(() => {
          // An unavailable card leaves the conversations fallback visible.
        }).finally(() => {
          if (cancelled) return;
          cancelDmLookup.current = null;
          setResolvingDm(false);
        });
      }
    } else if (deepLinkTarget.groupId && isUuid(deepLinkTarget.groupId)) {
      setSelectedGroupId(deepLinkTarget.groupId);
      setActiveTab('groups');
    } else if (deepLinkTarget.userId && isUuid(deepLinkTarget.userId)) {
      setSelectedUserId(deepLinkTarget.userId);
    } else if (deepLinkTarget.postId) {
      setOpenPostId(deepLinkTarget.postId);
      setOpenCommentId(deepLinkTarget.commentId || null);
    } else if (deepLinkTarget.storyId) {
      setOpenStoryId(deepLinkTarget.storyId);
    }
    consumedRef.current?.();
  }, [deepLinkTarget]);

  const handleCloseSinglePost = useCallback(() => {
    setOpenPostId(null);
    setOpenCommentId(null);
  }, []);

  const handleStoryAutoOpenConsumed = useCallback(() => {
    setOpenStoryId(null);
  }, []);

  // Note: do NOT auto mark-all-seen here. Posts are marked individually as
  // they enter the viewport in GroupFeed via the SeenObserver wrapper.

  const lifeStage = useUserStore((s) => s.lifeStage);
  const headerKey = `community_header_${lifeStage || 'mommy'}`;
  const dynamicHeader = useAppSetting(headerKey);
  const defaultHeader = tr("communityscreen_diger_analar_ile_elaqede_olun_4830a3", "Dig\u0259r analar il\u0259 \u0259laq\u0259d\u0259 olun");
  const headerText = typeof dynamicHeader === 'string' ? tr(headerKey, dynamicHeader) : defaultHeader;

  const { data: groups = [], isLoading: groupsLoading } = useCommunityGroups();
  const { data: memberships = [] } = useUserMemberships();
  const { totalUnread } = useDirectMessages();
  const { unreadCount } = useNotifications();
  const { user, profile } = useAuth();
  const ownProfile = profile?.user_id === user?.id ? profile : null;
  // Moderasiya bloku: community/full blokda bu ekran bağlanır (server tərəfdə
  // onsuz da trigger-lər yazmağa imkan vermir — bu, UX qatıdır)
  const { data: activeBlock } = useActiveBlock();

  const memberGroupIds = new Set(memberships.map((m) => m.group_id));
  const myGroups = groups.filter((g) => memberGroupIds.has(g.id));
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // useCallback: PostCard artıq memo() ilə saramalanıb — bu referansın hər
  // render-də dəyişməsi feed-dəki bütün post kartlarının memo-sunu boşa çıxarardı.
  const handleUserClick = useCallback((userId: string) => {
    if (selectedUserId && selectedUserId !== userId) setProfileTrail((trail) => [...trail, selectedUserId]);
    setSelectedUserId(userId);
  }, [selectedUserId]);

  const handleProfileBack = () => {
    setSelectedUserId(profileTrail.at(-1) || null);
    setProfileTrail((trail) => trail.slice(0, -1));
  };

  const handleOpenDmChat = useCallback((userId: string, name: string, avatar: string | null) => {
    setDmChat({ userId, name, avatar });
    setSelectedUserId(null);
    setProfileTrail([]);
    setShowConversations(false);
  }, []);

  // Community bloku: səbəb + bitmə tarixi göstərilir, community tam bağlıdır.
  // (Tam "full" blok isə Index.tsx-də bütün tətbiqi bağlayır.)
  if (activeBlock) {
    const expiryText = activeBlock.expires_at ?
    new Date(activeBlock.expires_at).toLocaleDateString(getLocaleTag(), {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : null;
    return (
      <div ref={ref} className="a-scope min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--a-bg)' }}>
        <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center mb-4">
          <Ban className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-black text-foreground text-center mb-2" style={{ color: 'var(--a-ink)' }}>
          {tr('community_blocked_title', 'Community girişiniz bloklanıb')}
        </h2>
        <p className="text-sm text-center mb-4 max-w-sm" style={{ color: 'var(--a-ink-soft)' }}>
          {tr('community_blocked_subtitle', 'Qaydaların pozulmasına görə community bölməsində paylaşım etmək imkanınız məhdudlaşdırılıb.')}
        </p>
        <div className="w-full max-w-sm rounded-2xl p-4 mb-3" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--a-warn-ink, #b45309)' }}>
            {tr('blocked_reason_label', 'Bloklanma səbəbi')}
          </p>
          <p className="text-sm" style={{ color: 'var(--a-ink)' }}>
            {activeBlock.reason || tr('blocked_reason_default', 'Qaydaların pozulması')}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--a-ink-soft)' }}>
            {expiryText ?
            <>{tr('blocked_until', 'Blokun bitmə tarixi:')} {expiryText}</> :
            tr('blocked_permanent', 'Bu blok daimidir.')}
          </p>
        </div>
        <p className="text-[11px] text-center max-w-xs" style={{ color: 'var(--a-ink-faint)' }}>
          {tr('blocked_appeal', 'Bunun səhv olduğunu düşünürsünüzsə, support@anacan.az ünvanına yazın.')}
        </p>
      </div>);
  }

  if (resolvingDm) {
    return <div className="min-h-screen flex items-center justify-center bg-background" role="status">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  // DM Chat screen
  if (dmChat) {
    return <DirectMessageScreen key={dmChat.userId} userId={dmChat.userId} userName={dmChat.name} userAvatar={dmChat.avatar} onBack={() => setDmChat(null)} />;
  }

  // Conversations list
  if (showConversations) {
    return <ConversationListScreen onBack={() => setShowConversations(false)} onOpenChat={handleOpenDmChat} />;
  }

  if (selectedUserId) {
    return <UserProfileScreen key={selectedUserId} userId={selectedUserId} onBack={handleProfileBack}
      onUserClick={handleUserClick} onSendMessage={handleOpenDmChat} onEditProfile={onEditProfile}
      onCreatePost={() => { setCreateReturnUserId(selectedUserId); setSelectedUserId(null); setSelectedGroupId(null); setShowCreatePost(true); }} />;
  }

  // Full screen create post
  if (showCreatePost) {
    return <CreatePostScreen onBack={() => { setShowCreatePost(false); setInitialSharedBlog(null); setSelectedUserId(createReturnUserId); setCreateReturnUserId(null); }} groupId={selectedGroupId} groups={myGroups} initialBlog={initialSharedBlog} />;
  }

  // Bildiriş/deep-link ilə "məhz bu paylaşımı" açma
  if (openPostId) {
    return <SinglePostView postId={openPostId} commentId={openCommentId} onBack={handleCloseSinglePost} onUserClick={handleUserClick} />;
  }

  if (selectedGroupId) return <GroupChatScreen groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />;

  return (
    <div key={deepLinkKey} ref={ref} className="a-scope pb-8 community-native-text" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <AdSurface id="community_banner" />
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {onBack &&
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }}>
                <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
              </motion.button>
            }
            <div className="min-w-0">
              <p className="a-eyebrow truncate">{headerText}</p>
              <p className="a-wordmark" style={{ fontSize: 18 }}>{tr("communityscreen_cemiyyet_2dc44d", "Cəmiyyət")}</p>
            </div>
          </div>
          <div className="a-topbar-actions">
            {user && <button type="button" className="a-icon-btn" onClick={() => handleUserClick(user.id)} aria-label={tr('community_my_profile', 'Cəmiyyət profilim')}>
              <Avatar className="w-8 h-8"><AvatarImage src={ownProfile?.avatar_url || undefined} /><AvatarFallback style={{ background: 'var(--a-peach-1)' }}><UserRound size={18} /></AvatarFallback></Avatar>
            </button>}
            {onOpenNotifications && <motion.button
              onClick={onOpenNotifications}
              className="a-icon-btn"
              aria-label={tr('notificationsscreen_bildirisler_54eb88', 'Bildirişlər')}
              whileTap={{ scale: 0.9 }}>
              <Bell size={19} strokeWidth={2} />
              {unreadCount > 0 && <span className="community-count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </motion.button>}
            <motion.button
              onClick={() => setShowConversations(true)}
              className="a-icon-btn"
              aria-label={tr("bottomnav_mesajlar", "Mesajlar")}
              whileTap={{ scale: 0.9 }}>
              
              <MessageCircle size={19} strokeWidth={2} />
              {totalUnread > 0 &&
              <span className="community-count-badge">
                
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              }
            </motion.button>
          </div>
        </header>

        <div className="flex gap-2 mb-3 rounded-2xl bg-muted/40 p-1" role="tablist" aria-label={tr('communityscreen_cemiyyet_2dc44d', 'Cəmiyyət')}>
          {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${activeTab === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}><tab.icon size={15} />{tab.label}</button>)}
        </div>

        {/* Search */}
        <motion.div animate={{ scale: searchFocused ? 1.01 : 1 }} transition={{ duration: 0.2 }}>
          <div className="a-search">
            <Search size={15} strokeWidth={2} color={searchFocused ? 'var(--a-peach-2)' : 'var(--a-ink-faint)'} />
            <input
              type="text"
              maxLength={200}
              placeholder={tr("untranslated_axtar_92w4nn", "Axtar...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)} />
            
            <AnimatePresence>
              {searchQuery &&
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                onClick={() => setSearchQuery('')}
                style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--a-surface-soft)', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={11} style={{ color: 'var(--a-ink-soft)' }} />
                </motion.button>
              }
            </AnimatePresence>
          </div>
        </motion.div>

        {activeTab === 'groups' ? <ChatGroupsPanel search={searchQuery} onOpen={setSelectedGroupId} /> : <>
        <BannerSlot placement="community_top" className="mt-4" />

        {/* Stories */}
        <div style={{ marginTop: 14 }}>
          <StoriesBar groupId={null} autoOpenStoryId={openStoryId} onAutoOpenConsumed={handleStoryAutoOpenConsumed} />
        </div>

        {/* Composer prompt (anacan-demo) */}
        <motion.button
          onClick={() => setShowCreatePost(true)}
          className="a-composer"
          style={{ marginTop: 12 }}
          whileTap={{ scale: 0.98 }}>
          
          <Avatar className="a-composer-avatar"><AvatarImage src={ownProfile?.avatar_url || undefined} /><AvatarFallback>{ownProfile?.name?.charAt(0) || 'A'}</AvatarFallback></Avatar>
          <span className="a-composer-text">{tr("communityscreen_ne_dusunursunuz_0378b3", "Nə düşünürsünüz?")}</span>
          <span className="a-cta-btn" style={{ padding: '9px 14px', fontSize: 11.5 }}>
            <Sparkles size={12} /> {tr("storiesbar_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </span>
        </motion.button>

        {/* Feed */}
        <AdInlineAnchor id="community_banner" />
        <div style={{ marginTop: 16 }}>
          <GroupFeed group={null} onBack={() => {}} onCreatePost={() => setShowCreatePost(true)} isEmbedded onUserClick={handleUserClick} externalSearchQuery={searchQuery} view={feedView} onViewChange={setFeedView} />
        </div>
        </>}
      </div>
    </div>);

});

CommunityScreen.displayName = 'CommunityScreen';

export default CommunityScreen;
