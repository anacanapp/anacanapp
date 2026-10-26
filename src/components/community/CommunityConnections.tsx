import { Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCommunityConnections, type ConnectionDirection } from '@/hooks/useCommunitySocial';
import { tr } from '@/lib/tr';
import FollowButton from './FollowButton';
import { UserBadge, VerifiedTick, isVerifiedActive, type BadgeType } from './UserBadge';

interface Props {
  userId: string;
  direction: ConnectionDirection | null;
  onClose: () => void;
  onUserClick: (userId: string) => void;
}

export default function CommunityConnections({ userId, direction, onClose, onUserClick }: Props) {
  const query = useCommunityConnections(userId, direction);
  return <Dialog open={!!direction} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="a-scope max-w-md rounded-3xl w-[calc(100%-24px)] max-h-[82dvh] flex flex-col" style={{ background: 'var(--a-surface)' }}>
      <DialogHeader>
        <DialogTitle>{direction === 'followers' ? tr('community_followers', 'İzləyicilər') : tr('community_following_people', 'İzlədikləri')}</DialogTitle>
        <DialogDescription>{tr('community_connections_hint', 'Profilə baxmaq üçün istifadəçinin adına toxunun.')}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto space-y-3 py-2">
        {query.isPending && <p role="status" className="text-center text-sm py-6">{tr('community_loading', 'Yüklənir')}</p>}
        {query.isError && <div role="alert" className="text-sm text-center">
          <p>{tr('community_load_failed', 'Məlumat yüklənmədi. Yenidən cəhd edin.')}</p>
          <button className="a-btn-soft mt-3" onClick={() => void query.refetch()}>{tr('community_retry', 'Yenidən yoxla')}</button>
        </div>}
        {!query.isPending && !query.isError && query.connections.length === 0 && <div className="text-center py-8">
          <Users size={28} className="mx-auto mb-3" /><p className="text-sm">{tr('community_connections_empty', 'Hələ heç kim yoxdur')}</p>
        </div>}
        {query.connections.map((person) => <div key={person.user_id} className="community-connection-row" data-connection-user={person.user_id}>
          <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => { onClose(); onUserClick(person.user_id); }}>
            <Avatar className="w-10 h-10"><AvatarImage src={person.avatar_url || undefined} /><AvatarFallback>{person.name?.charAt(0) || 'A'}</AvatarFallback></Avatar>
            <span className="min-w-0 text-sm font-bold break-words">{person.name || tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi')}
              {isVerifiedActive(person.is_verified, person.verified_until) && <VerifiedTick size={13} />}
              <span className="block mt-1"><UserBadge type={person.badge_type as BadgeType} premium={person.is_premium ?? undefined}/></span>
            </span>
          </button>
          <FollowButton userId={person.user_id} isFollowing={person.is_following} />
        </div>)}
        {query.hasNextPage && <button className="a-btn-soft w-full justify-center" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? tr('community_loading', 'Yüklənir') : tr('community_load_more', 'Daha çox göstər')}
        </button>}
      </div>
    </DialogContent>
  </Dialog>;
}
