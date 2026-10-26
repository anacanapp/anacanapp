import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Gift, Loader2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AdSurface, useAdExperience } from './AdExperienceProvider';
import { AD_REASON_LABELS } from '@/lib/ads/policy';
import { useSubscription } from '@/hooks/useSubscription';
import { tr } from '@/lib/tr';
import { toast } from 'sonner';

export default function AdPreferencesScreen({ onBack }: { onBack: () => void }) {
  const ads = useAdExperience(), { isPremium } = useSubscription();
  const [requesting, setRequesting] = useState(false);
  const decision = ads.decisionFor('ads_pause_rewarded');
  const premium = ads.preview.enabled ? ads.preview.premium : isPremium;
  const paused = ads.pauseUntil > Date.now();
  const minutes = ads.configuration?.settings.reward_pause_minutes ?? 30;
  return <div className="a-scope min-h-screen pb-24" style={{ background: 'var(--a-bg)' }}>
    <AdSurface id="ads_pause_rewarded" />
    <div className="a-shell space-y-5 pt-4">
      <header className="a-topbar safe-area-top"><button className="a-icon-btn" onClick={onBack} aria-label={tr('ads_back', 'Geri')}><ArrowLeft size={18} className="rtl:rotate-180" /></button><h1 className="text-lg font-bold">{tr('ads_preferences_title', 'Reklam seçimləri')}</h1><SlidersHorizontal size={18} /></header>
      <Card><CardContent className="space-y-3 pt-5"><ShieldCheck className="text-primary" size={28} /><h2 className="font-semibold">{premium ? tr('ads_premium_free', 'Premium ilə reklamsız istifadə') : paused ? tr('ads_pause_active', 'Reklamsız fasilə aktivdir') : tr('ads_your_choices', 'Seçim sizindir')}</h2>
        <p className="text-sm text-muted-foreground">{premium ? tr('ads_premium_description', 'Premium və ailə Premium-u reklam göstərilmədən işləyir.') : paused ? `${Math.max(1, Math.ceil((ads.pauseUntil - Date.now()) / 60000))} ${tr('ads_minutes_left', 'dəqiqə qalıb. Bu cihazda yeni reklam açılmır.')}` : tr('ads_choices_description', 'Reklamlar yalnız müəyyən ekranlarda və tezlik limitləri ilə göstərilir. Tibbi profil məlumatları reklam sorğusuna əlavə edilmir.')}</p>
      </CardContent></Card>
      {!premium && <Card><CardContent className="space-y-4 pt-5"><Gift size={26} className="text-violet-500" /><h2 className="font-semibold">{minutes} {tr('ads_reward_title', 'dəqiqə reklamsız fasilə')}</h2><p className="text-sm text-muted-foreground">{tr('ads_reward_description', 'İstəyə bağlı videonu tamamladıqdan sonra bu cihazda reklam fasiləsi açılır. Videonu bağlamaq kifayət etmir; Premium və ödənişli imkanlar bu mükafata daxil deyil.')}</p>
        {ads.preview.enabled && <p className="rounded-lg bg-violet-50 p-3 text-xs text-violet-700">DEMO · {tr('ads_demo_reward_note', 'Bu sınaq yalnız demo reklamların fasiləsini dəyişir.')}</p>}
        <Button className="w-full" disabled={requesting || ads.busy || (!decision.allowed && decision.reason !== 'consent')} onClick={async () => {
          setRequesting(true);
          try { const earned = await ads.showRewarded(); if (earned) toast.success(tr('ads_reward_success', 'Reklamsız fasilə aktivləşdirildi.')); else toast.info(tr('ads_reward_incomplete', 'Video tamamlanmadı və ya reklam hazır deyil.')); }
          finally { setRequesting(false); }
        }}>{requesting ? <Loader2 className="me-2 animate-spin" size={16} /> : <Gift className="me-2" size={16} />}{tr('ads_watch_reward', 'Reklama bax və fasilə qazan')}</Button>
        {!decision.allowed && <p className="text-xs text-muted-foreground" role="status">{AD_REASON_LABELS[decision.reason]}{decision.waitSeconds > 0 ? ` · ${decision.waitSeconds} san.` : ''}</p>}
      </CardContent></Card>}
      <Card><CardContent className="space-y-4 pt-5"><h2 className="font-semibold">{tr('ads_privacy_title', 'Reklam məxfilik seçimləri')}</h2><p className="text-sm text-muted-foreground">{tr('ads_privacy_description', 'Google UMP tərəfindən təqdim edilən razılıq və məxfilik seçimlərini native tətbiqdə buradan idarə edə bilərsiniz.')}</p><Button variant="outline" disabled={!ads.nativeAvailable || !ads.consent.privacyOptionsRequired || ads.busy} onClick={() => ads.openPrivacy()}><CheckCircle2 size={16} className="me-2" />{tr('ads_manage_privacy', 'Məxfilik seçimlərini aç')}</Button>
        {!ads.nativeAvailable && <p className="text-xs text-muted-foreground">{tr('ads_native_required', 'Real AdMob reklamları və UMP seçimləri SDK daxil edilmiş yeni iOS/Android versiyasında işləyir.')}</p>}
      </CardContent></Card>
    </div>
  </div>;
}
