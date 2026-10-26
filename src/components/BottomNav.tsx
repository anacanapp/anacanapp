import { motion } from 'framer-motion';
import { Home, Compass, MessageCircle, User, Users, Sparkles, HeartHandshake } from 'lucide-react';
import { RiApps2AiLine } from 'react-icons/ri';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useUnreadCommunityPosts } from '@/hooks/useUnreadCommunityPosts';
import { tr } from "@/lib/tr";
import { useChatChromeHidden } from '@/hooks/useChatChrome';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isPartner?: boolean;
}

/**
 * Floating pill bottom navigation — redesigned to match the
 * anacan-demo-app concept (blurred white pill, peach active state,
 * special circular gradient icon for the AI tab).
 * All tabs, badges and translations are unchanged.
 */
const BottomNav = ({ activeTab, onTabChange, isPartner = false }: BottomNavProps) => {
  const { unreadCount } = useUnreadMessages();
  const { unreadCount: communityUnread } = useUnreadCommunityPosts();
  const hiddenForChat = useChatChromeHidden();

  const womanTabs = [
    { id: 'home', label: tr("bottomnav_esas_6d87f7", 'Əsas'), icon: Home },
    { id: 'tools', label: tr("bottomnav_aletler_4778b4", 'Alətlər'), icon: RiApps2AiLine },

    { id: 'community', label: tr("bottomnav_cemiyyet_2dc44d", 'Cəmiyyət'), icon: Users },
    { id: 'ai', label: tr("bottomnav_anacan_ai", 'Anacan.AI'), icon: Sparkles, special: true },
    { id: 'profile', label: tr("bottomnav_profil", 'Profil'), icon: User },
  ];

  const partnerTabs = [
    { id: 'home', label: tr("partnerv2_nav_bugun", 'Bu gün'), icon: Home },
    { id: 'together', label: tr("partnerv2_birlikde", 'Birlikdə'), icon: HeartHandshake },
    { id: 'chat', label: tr("bottomnav_mesajlar", 'Mesajlar'), icon: MessageCircle },
    { id: 'ai', label: tr("bottomnav_meslehet_9a0892", 'Məsləhət'), icon: Compass, special: true },
    { id: 'profile', label: tr("bottomnav_profil", 'Profil'), icon: User },
  ];

  const visibleWomanTabs = womanTabs;

  if (hiddenForChat) return null;

  return (
    <div className="a-nav-wrap a-scope" data-ad-bottom-nav>
      <nav className="a-nav" aria-label="Primary">
        {(isPartner ? partnerTabs : visibleWomanTabs).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          // Show badge on chat tab for unread messages (both partner and woman)
          const showBadge = (tab.id === 'chat' || (tab.id === 'home' && !isPartner)) && unreadCount > 0;
          // Community unread posts badge (woman only)
          const showCommunityBadge = tab.id === 'community' && !isPartner && communityUnread > 0;
          const communityBadgeText = communityUnread > 99 ? '99+' : String(communityUnread);

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`a-nav-item${isActive ? ' active' : ''}`}
              whileTap={{ scale: 0.92 }}
            >
              {tab.special ? (
                <span className="a-nav-ai-icon">
                  <Icon size={15} strokeWidth={2.4} />
                </span>
              ) : (
                <Icon size={tab.id === 'tools' && !isPartner ? 17 : 19} strokeWidth={isActive ? 2.4 : 2} />
              )}

              {/* Unread badge */}
              {showBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="a-nav-badge"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
              {/* Community unread posts badge */}
              {showCommunityBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="a-nav-badge"
                >
                  {communityBadgeText}
                </motion.span>
              )}

              <span className="a-nav-label">{tab.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
