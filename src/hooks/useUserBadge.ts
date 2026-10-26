import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserBadgeInfo {
  is_premium: boolean;
  badge_type: string;
  is_admin: boolean;
}

export function useUserBadge(userId: string | undefined) {
  const [badge, setBadge] = useState<UserBadgeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchBadge = async () => {
      // Fetch profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, badge_type')
        .eq('user_id', userId)
        .single();

      // Check if admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const isAdmin = roles?.some(r => r.role === 'admin') || false;

      setBadge({
        is_premium: profile?.is_premium || false,
        badge_type: isAdmin ? 'admin' : (profile?.badge_type || 'user'),
        is_admin: isAdmin,
      });
      setLoading(false);
    };

    fetchBadge();
  }, [userId]);

  return { badge, loading };
}

export function getBadgeConfig(badgeType: string) {
  switch (badgeType) {
    case 'admin':
      return {
        label: 'Admin',
        emoji: '👑',
        className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
      };
    case 'premium':
      return {
        label: 'Premium',
        emoji: '⭐',
        className: 'bg-gradient-to-r from-amber-400 to-amber-600 text-white',
      };
    case 'moderator':
      return {
        label: 'Moderator',
        emoji: '🛡️',
        className: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
      };
    default:
      return null;
  }
}
