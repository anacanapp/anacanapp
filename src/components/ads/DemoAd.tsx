import { useEffect, useState } from 'react';
import { Gift, Play, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { placementDefinition, type AdPlacementId } from '@/lib/ads/config';

export function DemoBanner({ placementId, onClick }: { placementId: AdPlacementId; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="admob-demo-banner" data-testid={`ad-demo-${placementId}`} aria-label="Demo reklam haqqında">
    <span className="admob-demo-icon"><Sparkles size={22} /></span>
    <span className="min-w-0 flex-1 text-start"><span className="admob-demo-label">DEMO · ADMOB</span>
      <strong className="block truncate text-sm">Burada reklamınız görünəcək</strong>
      <span className="block truncate text-[10px] opacity-70">{placementDefinition(placementId).title}</span></span>
    <span className="admob-demo-cta">Nümunə</span>
  </button>;
}

export function DemoFullscreen({ placementId, rewardMinutes, storyFormat = 'native', onFinish }: {
  placementId: AdPlacementId; rewardMinutes: number; storyFormat?: 'native' | 'video'; onFinish: (rewarded: boolean) => void;
}) {
  const rewarded = placementDefinition(placementId).format === 'rewarded';
  const story = placementDefinition(placementId).format === 'native_story';
  const gameReward = placementId === 'game_revive_rewarded';
  const [remaining, setRemaining] = useState(rewarded ? 3 : story ? 6 : 0);
  useEffect(() => {
    if (!rewarded && !story) return;
    const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [rewarded, story]);
  useEffect(() => { if (story && remaining === 0) onFinish(false); }, [story, remaining, onFinish]);
  if (story) return <Dialog open onOpenChange={open => { if (!open) onFinish(false); }}>
    <DialogContent data-ad-overlay="true" overlayClassName="z-[20000]" className="z-[20001] aspect-[9/16] max-h-[94dvh] w-[min(94vw,50dvh)] max-w-none overflow-hidden rounded-2xl border-0 bg-slate-950 p-0 text-white [&>button]:hidden">
      <div className={`absolute inset-0 ${storyFormat === 'video' ? 'animate-pulse bg-gradient-to-br from-violet-800 via-indigo-700 to-fuchsia-800' : 'bg-gradient-to-br from-orange-200 via-rose-100 to-violet-200'}`} />
      <div className="absolute inset-x-3 top-3 z-10"><div className="mb-3 h-1 rounded bg-white/30"><div className="h-full rounded bg-white transition-[width] duration-1000" style={{ width: `${(6 - remaining) / 6 * 100}%` }} /></div><div className="flex items-center justify-between"><span className="rounded-full bg-black/40 px-3 py-1 text-[10px]">REKLAM · DEMO {storyFormat === 'video' ? 'VİDEO' : 'NATIVE'}</span><button aria-label="Demo reklamı bağla" onClick={() => onFinish(false)} className="rounded-full bg-black/40 p-2"><X size={18} /></button></div></div>
      <div className="relative flex h-full flex-col items-center justify-center p-6 text-center"><div className="mb-5 rounded-3xl bg-white/20 p-7">{storyFormat === 'video' ? <Play size={58} /> : <Sparkles size={58} className="text-violet-700" />}</div><DialogTitle className={storyFormat === 'video' ? 'text-2xl text-white' : 'text-2xl text-slate-800'}>Story ölçüsündə reklam</DialogTitle><DialogDescription className={storyFormat === 'video' ? 'mt-3 text-white/80' : 'mt-3 text-slate-600'}>9:16 demo səhnə. Real native mediaya AdMob SDK-sı xidmət edir.</DialogDescription></div>
      <div className="absolute inset-x-4 bottom-5 rounded-2xl bg-black/60 p-4"><p className="text-xs font-semibold">Demo sponsor</p><p className="mt-1 text-[11px] text-white/70">Şəxsi story kimi göstərilmir və baxış sayınıza əlavə olunmur.</p><Button className="mt-3 w-full bg-white text-slate-900 hover:bg-white/90" onClick={() => onFinish(false)}>Növbəti story · {remaining}s</Button></div>
    </DialogContent>
  </Dialog>;
  return <Dialog open onOpenChange={open => { if (!open) onFinish(false); }}>
    <DialogContent data-ad-overlay="true" overlayClassName="z-[20000]" className="z-[20001] max-w-[390px] overflow-hidden rounded-3xl border-0 p-0 [&>button]:hidden" aria-describedby="ad-demo-description">
      <div className="relative bg-gradient-to-br from-orange-100 via-rose-50 to-violet-100 p-7 pb-10 text-slate-800">
        <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold tracking-widest">DEMO · REAL REKLAM DEYİL</span>
        <button className="absolute right-4 top-4 rounded-full bg-white/80 p-2" aria-label="Demo reklamı bağla" onClick={() => onFinish(false)}><X size={18} /></button>
        <div className="mx-auto mb-6 mt-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/80 shadow-sm">{rewarded ? <Gift size={44} className="text-violet-500" /> : <Play size={42} className="text-orange-500" />}</div>
        <DialogTitle className="text-center text-2xl font-bold">{gameReward ? 'Can / gediş bərpası' : rewarded ? `${rewardMinutes} dəqiqə reklamsız` : 'Təbii keçiddə reklam'}</DialogTitle>
        <DialogDescription id="ad-demo-description" className="mt-3 text-center text-sm text-slate-600">
          {gameReward ? 'Videonu tamamladıqda cari oyunda can və ya əlavə gediş bərpa edilir. Xal saxlanır; bağlamaq bərpa vermir.' : rewarded ? 'Videonun tamamlanmasını burada demo olaraq sınaqdan keçirirsiniz. Bağlamaq mükafat vermir.' : 'Bu nümunə təbii keçid nöqtəsini göstərir. Bağladıqdan sonra naviqasiya davam edir.'}
        </DialogDescription>
      </div>
      <div className="space-y-3 p-5">
        <code className="block text-center text-[10px] text-muted-foreground">{placementId}</code>
        <Button className="w-full" disabled={remaining > 0} onClick={() => onFinish(rewarded)}>
          {remaining > 0 ? `Demo video · ${remaining} san.` : gameReward ? 'Demoyu tamamla və canı bərpa et' : rewarded ? 'Demoyu tamamla və fasiləni sına' : 'Davam et'}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">Google-a reklam sorğusu göndərilmir. Demo gəlir yaratmır.</p>
      </div>
    </DialogContent>
  </Dialog>;
}
