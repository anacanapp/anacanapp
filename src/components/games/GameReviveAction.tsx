import { Gift, Loader2 } from 'lucide-react';
import type { useGameAds } from '@/hooks/useGameAds';

export interface ReviveLabels { action: string; note: string; failed: string; unavailable: string }
export default function GameReviveAction({ ads, game, labels }: { ads: ReturnType<typeof useGameAds>; game: 'basket' | 'match'; labels?: ReviveLabels }) {
  if (!ads.canOffer) return null;
  const benefit = game === 'basket' ? `+${ads.benefits.lives} can${ads.benefits.seconds ? ` / ən azı ${ads.benefits.seconds} san.` : ''}` : `+${ads.benefits.moves} gediş`;
  return <div className="space-y-1.5" data-testid="game-revive-offer">
    <button type="button" disabled={ads.waiting || !ads.canRequest} onClick={() => { void ads.revive(); }}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm font-bold text-violet-800 disabled:opacity-50">
      {ads.waiting ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />}
      {labels?.action ?? (ads.premium ? `Premium ilə davam et · ${benefit}` : `Videoya bax · ${benefit}`)}
    </button>
    {ads.message && <p className="text-[10px] text-muted-foreground" role="status">{labels?.failed ?? ads.message}</p>}
    {!ads.canRequest && !ads.message && <p className="text-[10px] text-muted-foreground">{labels?.unavailable ?? ads.reason}</p>}
    <p className="text-[10px] text-muted-foreground">{labels?.note ?? 'Xal və lövhə saxlanır. Video bağlanarsa bərpa verilmir.'}</p>
  </div>;
}
