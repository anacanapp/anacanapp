import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityFollow } from '@/hooks/useCommunitySocial';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';

export default function FollowButton({ userId, isFollowing, loading = false }: { userId: string; isFollowing: boolean; loading?: boolean }) {
  const { user } = useAuth();
  const follow = useCommunityFollow(userId);
  if (!user || user.id === userId) return null;
  return <button type="button" className={isFollowing ? 'a-btn-soft' : 'a-btn-solid'}
    aria-pressed={isFollowing} aria-busy={follow.isPending} disabled={loading || follow.isPending}
    onClick={() => { hapticFeedback.light(); follow.setFollowing(!isFollowing); }}>
    {follow.isPending ? <Loader2 size={16} className="animate-spin" /> : isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
    {isFollowing ? tr('community_unfollow', 'İzləmədən çıx') : tr('community_follow', 'İzlə')}
  </button>;
}
