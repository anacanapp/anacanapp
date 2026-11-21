import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Check, Gift } from 'lucide-react';
import logoImage from '@/assets/brand-mark.png';
import { useUserStore } from '@/store/userStore';
import { usePromoText } from '@/data/promo';
import { fill } from '@/lib/feature-text';
import { fetchPromoCampaign, normalizePromoCode, promoDurationLabel, savePendingPromo } from '@/lib/promo';

const APP_STORE = 'https://apps.apple.com/app/id6758301924';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan';

/** /h/:code — the page a campaign QR opens. Saves the code on this device and explains the three steps. */
export default function PromoLanding() {
  const { code: raw } = useParams();
  const code = useMemo(() => normalizePromoCode(raw), [raw]);
  const navigate = useNavigate();
  const text = usePromoText(useUserStore((state) => state.language) || 'az');
  const native = Capacitor.isNativePlatform();
  const [copied, setCopied] = useState(false);

  const campaign = useQuery({
    queryKey: ['promo-campaign', code], enabled: !!code, staleTime: 60_000, retry: 1,
    queryFn: () => fetchPromoCampaign(code!),
  });
  const valid = campaign.data?.found === true && campaign.data.state === 'active';

  useEffect(() => {
    if (!valid || !code) return;
    savePendingPromo(code);
    // Inside the app the redeemer takes over: go home (sign-in screen when there is no session).
    if (native) navigate('/', { replace: true });
  }, [valid, code, native, navigate]);

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  if (!text) return <div className="min-h-dvh bg-[#FBF6F2]" />;
  const loading = !!code && campaign.isLoading;
  const duration = promoDurationLabel(text, campaign.data?.duration);

  return (
    <main className="min-h-dvh bg-[#FBF6F2] text-[#1F1A17] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-5">
        <img src={logoImage} alt="Anacan" className="w-14 h-14 rounded-2xl self-center" />
        {loading ? (
          <p className="text-center text-[#6F625B]">{text.loading}</p>
        ) : !valid ? (
          <div className="rounded-3xl bg-white border border-[#EFE4DC] p-6 text-center">
            <p className="text-lg font-semibold">{text.invalid}</p>
            <a href={/iPhone|iPad|iPod/i.test(navigator.userAgent) ? APP_STORE : PLAY_STORE}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-[#D92D3F] px-6 font-bold text-white">{text.step1}</a>
          </div>
        ) : (
          <>
            <section className="rounded-[28px] bg-[#1F1A17] text-[#FBF6F2] p-6">
              <Gift className="w-8 h-8 text-[#FFC7B8]" aria-hidden />
              <h1 className="mt-3 text-[28px] leading-tight font-extrabold tracking-tight">{text.title}</h1>
              <p className="mt-2 text-[15px] text-[#E8DCD3]">{fill(text.subtitle, { campaign: campaign.data?.title ?? '', duration })}</p>
              {campaign.data?.eligibility === 'new_users' && (
                <span className="mt-4 inline-flex rounded-lg bg-[#FFE3DC] px-2.5 py-1 text-xs font-bold text-[#C42536]">{text.new_only}</span>
              )}
            </section>

            <ol className="rounded-3xl bg-white border border-[#EFE4DC] p-5 flex flex-col gap-3">
              {[text.step1, text.step2, text.step3].map((step, index) => (
                <li key={step} className="flex items-center gap-3 text-[15px]">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-[#FFE3DC] text-[#C42536] font-bold flex items-center justify-center">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <section className="rounded-3xl bg-white border border-[#EFE4DC] p-5">
              <p className="text-xs font-bold tracking-wider text-[#6F625B] uppercase">{text.code_label}</p>
              <button type="button" onClick={copy} className="mt-2 w-full h-14 rounded-2xl border-2 border-dashed border-[#E8DCD3] font-mono text-2xl font-bold tracking-[0.12em] flex items-center justify-center gap-2">
                {code}{copied && <Check className="w-5 h-5 text-[#2F5D3A]" aria-hidden />}
              </button>
              <p className="mt-2 text-sm text-[#6F625B]">{text.code_hint}</p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <a href={APP_STORE} className="h-12 rounded-2xl bg-[#1F1A17] text-white font-semibold flex items-center justify-center">App Store</a>
              <a href={PLAY_STORE} className="h-12 rounded-2xl bg-[#1F1A17] text-white font-semibold flex items-center justify-center">Google Play</a>
            </div>
            <button type="button" onClick={() => navigate('/')} className="h-12 rounded-2xl bg-[#D92D3F] text-white font-bold">{text.web_signup}</button>
          </>
        )}
      </div>
    </main>
  );
}
