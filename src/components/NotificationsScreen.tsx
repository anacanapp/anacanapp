import { useState } from 'react';
import { motion } from 'framer-motion';
import { getLocaleTag } from '@/lib/i18n';
import { ArrowLeft, Bell, Check, Trash2, Calendar, Heart, Pill, Gift, MessageCircle, Reply, Megaphone, ChevronDown, UserPlus } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { tr } from "@/lib/tr";
import { useUserStore } from '@/store/userStore';
import { moderatorText } from '@/lib/moderator-i18n';

export interface NotificationCommunityTarget {
  postId?: string;
  commentId?: string;
  storyId?: string;
  userId?: string;
  groupId?: string;
}

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigateToCommunity?: (target?: NotificationCommunityTarget) => void;
  onNavigateToModeration?: () => void;
}

type FilterType = 'all' | 'community' | 'system';

// DÜZƏLİŞ: əvvəllər bu siyahıda `comment_like`/`story_like`/`story_reply`
// yox idi — useCreateComment/useToggleCommentLike/useStories/useStoryReplies
// bu tipləri ARTIQ göndərirdi, amma bura klik edəndə heç nə baş vermirdi
// (nə naviqasiya, nə "Community" filtri, nə "Görmək üçün toxun" işarəsi).
const communityTypes = [
  'community_like', 'community_comment', 'community_reply',
  'comment_like', 'story_like', 'story_reply', 'community_follow',
  'group_message', 'group_invite', 'group_join_request',
  'community_moderation',
];

const NotificationsScreen = ({ onBack, onNavigateToCommunity, onNavigateToModeration }: NotificationsScreenProps) => {
  useScrollToTop();
  useScreenAnalytics('Notifications', 'Notifications');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const { notifications, loading, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'community') return communityTypes.includes(n.notification_type);
    if (filter === 'system') return !communityTypes.includes(n.notification_type);
    return true;
  });

  // Palitra: tint fon + sabit ink (dizayn sistemi konvensiyası)
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'community_like':
      case 'comment_like':
        return { icon: Heart, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' };
      case 'community_comment':return { icon: MessageCircle, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' };
      case 'community_reply':return { icon: Reply, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' };
      case 'story_like':return { icon: Heart, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' };
      case 'story_reply':return { icon: Reply, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' };
      case 'community_follow':return { icon: UserPlus, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' };
      case 'reminder':return { icon: Bell, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' };
      case 'appointment':return { icon: Calendar, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' };
      case 'tip':return { icon: Pill, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' };
      case 'partner':return { icon: Heart, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' };
      case 'achievement':return { icon: Gift, bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' };
      case 'push':case 'scheduled':return { icon: Megaphone, bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)' };
      default:return { icon: Bell, bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return tr("notificationsscreen_i_ndice_3c9745", "İndicə");
    if (diffMins < 60) return `${diffMins} ${tr("notificationsscreen_mins", "dəq")}`;
    if (diffHours < 24) return `${diffHours} ${tr("notificationsscreen_hours", "saat")}`;
    if (diffDays === 1) return tr("notificationsscreen_dunen_52b701", "Dünən");
    const { language } = useUserStore.getState();
    return date.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short' });
  };

  // DÜZƏLİŞ: əvvəllər YALNIZ notification_type-a baxıb Community tab-ına
  // (heç bir konkret post/şərh/story olmadan) keçirdi. `action_data` sütunu
  // (send-push-notification/index.ts artıq bunu yazır) burada oxunub, konkret
  // hədəf Index.tsx-ə → CommunityScreen-ə → SinglePostView-a qədər aparılır.
  const handleExpand = (notification: Notification) => {
    if (!notification.is_read) void markAsRead(notification.id);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(notification.id)) next.delete(notification.id);
      else next.add(notification.id);
      return next;
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (!communityTypes.includes(notification.notification_type) || !onNavigateToCommunity) return;

    const actionData = notification.action_data || {};
    const type = notification.action_type || notification.notification_type;

    if (['group_message','group_invite','group_join_request'].includes(type)) {
      onNavigateToCommunity({ groupId: actionData.groupId });
      return;
    }

    if (type === 'community_follow') {
      onNavigateToCommunity({ userId: actionData.userId });
      return;
    }
    if (type === 'story_like' || type === 'story_reply') {
      onNavigateToCommunity({ storyId: actionData.storyId });
      return;
    }
    // community_like / community_comment / community_reply / comment_like — hamısı postId daşıyır
    onNavigateToCommunity({ postId: actionData.postId, commentId: actionData.commentId });
  };

  const filters: {id: FilterType;label: string;}[] = [
  { id: 'all', label: tr("notificationsscreen_hamisi_c73c4d", 'Hamısı') },
  { id: 'community', label: tr("notificationsscreen_cemiyyet_2dc44d", 'Cəmiyyət') },
  { id: 'system', label: tr("notificationsscreen_filter_system", "Sistem") }];


  return (
    <div className="a-scope safe-top h-[100dvh] overflow-y-auto overflow-x-hidden pb-24" style={{ background: 'var(--a-bg)' }} data-scroll-container>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              {unreadCount > 0 && <p className="a-eyebrow">{unreadCount} {tr("notificationsscreen_oxunmamis_8bfc41", "oxunmamış")}</p>}
              <p className="a3-tool-title">{tr("notificationsscreen_bildirisler_54eb88", "Bildirişlər")}</p>
            </div>
          </div>
          {unreadCount > 0 &&
          <div className="a-topbar-actions">
              <motion.button onClick={markAllAsRead} className="a-btn-soft" whileTap={{ scale: 0.95 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <Check size={12} strokeWidth={2.5} />{tr("notificationsscreen_hamisini_oxu_29ceea", "Hamısını oxu")}
              </motion.button>
            </div>
          }
        </header>

        {/* Filter tabs */}
        <div className="a-tabs" style={{ marginBottom: 14 }}>
          {filters.map((f) =>
          <button key={f.id} onClick={() => setFilter(f.id)} className={`a-tab ${filter === f.id ? 'active' : ''}`}>
              {f.label}
            </button>
          )}
        </div>

        {/* List */}
        {loading ?
        <div className="text-center py-16">
            <div className="w-7 h-7 rounded-full animate-spin mx-auto"
          style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
          </div> :
        filteredNotifications.length === 0 ?
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="a-card" style={{ textAlign: 'center', padding: '34px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <Bell size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr("notificationsscreen_bildiris_yoxdur_6ccf4d", "Bildiriş yoxdur")}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{tr("notificationsscreen_yeni_bildirisler_burada_gorunecek_a0484a", "Yeni bildirişlər burada görünəcək")}</p>
          </motion.div> :

        <div className="space-y-2.5">
            {filteredNotifications.map((notification, index) => {
             const { icon: Icon, bg, ink } = getNotificationIcon(notification.notification_type);
             const isCommunity = communityTypes.includes(notification.notification_type);
             const expanded = expandedIds.has(notification.id);
             const messageId = `notification-message-${notification.id}`;
             // Yalnız ilk 12 sətir animasiya olunur (gecikmə ≤0.2s); qalanları adi div
             const animated = index < 12;
             const Row = (animated ? motion.div : 'div') as typeof motion.div;
            return (
              <Row
                key={notification.id}
                {...(animated ? {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: Math.min(index * 0.03, 0.2) }
                } : {})}
                data-notification-id={notification.id}
                style={{
                  background: 'var(--a-surface)',
                  borderRadius: 'var(--a-radius-md)',
                  padding: '14px 15px',
                  boxShadow: 'var(--a-card-shadow)',
                  border: notification.is_read ? '1.5px solid transparent' : '1.5px solid var(--a-peach-2)',
                  transition: 'border-color 0.2s, transform 0.1s'
                }}>

                  <button type="button" onClick={() => handleExpand(notification)} aria-label={notification.title} aria-expanded={expanded} aria-controls={messageId} className="flex w-full min-w-0 items-start gap-3 text-start">
                    <span className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, height: 40, borderRadius: 14, background: bg }}>
                      <Icon size={17} style={{ color: ink }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-start justify-between gap-1.5">
                        <span style={{ fontSize: 15, fontWeight: 700, color: notification.is_read ? 'var(--a-ink)' : 'var(--a-accent-ink)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                          {notification.title}
                        </span>
                        <span className="whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500, color: 'var(--a-ink-faint)' }}>{formatTime(notification.created_at)}</span>
                      </span>
                      <span id={messageId} className={`mt-1 leading-relaxed ${expanded ? 'block whitespace-pre-wrap' : 'line-clamp-2'}`} style={{ fontSize: 14, color: 'var(--a-ink-soft)', overflowWrap: 'anywhere' }}>{notification.message}</span>
                      <span className="mt-2 inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
                        {expanded ? tr('notifications_collapse', 'Yığ') : tr('notifications_read_full', 'Tam mətni oxu')}
                        <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-2 mt-3 justify-end">
                    {notification.notification_type === 'moderation_action' && onNavigateToModeration && <button type="button" className="a-btn-soft me-auto" onClick={() => { void markAsRead(notification.id); onNavigateToModeration(); }}>{moderatorText('details')}</button>}
                    {isCommunity && onNavigateToCommunity && <button type="button" onClick={() => handleNotificationClick(notification)} className="a-btn-soft me-auto" style={{ fontSize: 12 }}>
                      {notification.notification_type === 'community_follow' ? tr('community_view_profile', 'Profilə bax') : tr('notifications_open_content', 'Paylaşıma keç')}
                    </button>}
                    {!notification.is_read &&
                  <button onClick={(e) => {e.stopPropagation();markAsRead(notification.id);}}
                  style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
                        {tr("notificationsscreen_read", "Oxundu")}
                      </button>
                  }
                    <button onClick={(e) => {e.stopPropagation();deleteNotification(notification.id);}}
                  className="inline-flex items-center gap-1"
                  style={{ background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
                      <Trash2 size={13} />{tr("notificationsscreen_delete", "Sil")}
                    </button>
                  </div>
                </Row>);

          })}
          </div>
        }
      </div>
    </div>);

};

export default NotificationsScreen;
