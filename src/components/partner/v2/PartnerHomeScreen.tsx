import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Send, MessageCircle, BookOpen, Sparkles } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerData } from '@/hooks/usePartnerData';
import { usePartnerMessages } from '@/hooks/usePartnerMessages';
import { usePregnancyContentByDay } from '@/hooks/usePregnancyContent';
import { useFruitImages, getDynamicFruitData } from '@/hooks/useFruitData';
import { useDailyTip } from '@/hooks/usePartnerDailyTips';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { getPregnancyDay } from '@/lib/pregnancy-utils';
import { supabase } from '@/integrations/supabase/client';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';

import SOSButton from '@/components/partner/SOSButton';
import PartnerOnboardingTour, { PARTNER_TOUR_KEY } from './PartnerOnboardingTour';
import DailyMissionsCard from './DailyMissionsCard';
import PartnerActivityFeed from './PartnerActivityFeed';
import NextAppointmentCard from './NextAppointmentCard';
import PartnerWeekInfoCard from './PartnerWeekInfoCard';
import PartnerBabyCrisisCard from './PartnerBabyCrisisCard';
import PartnerBabyTodayCard from './PartnerBabyTodayCard';
import PartnerFlowStatusCard from '@/components/flow/PartnerFlowStatusCard';
import { AdInlineAnchor } from '@/components/ads/AdExperienceProvider';

/**
 * Partnyor "Bu gün" — v2 ana ekran.
 * Buludlu peach + mavi partnyor vurğusu.
 */

const MOOD_EMOJIS = ['😢', '😔', '😐', '🙂', '😊'];
// Dark mode düzəlişi: hardcode #153e57 dark modda --a-grad-blue/--a-blue-1-in
// tünd tint-inə qarşı demək olar oxunmurdu (icon/mətn görünmürdü).
const BLUE_INK = 'var(--a-blue-ink)';
const BLUE_SOFT = 'var(--a-blue-ink)';

interface Props {
  onNavigate: (screen: string) => void;
  onOpenChat: () => void;
}

const PartnerHomeScreen = ({ onNavigate, onOpenChat }: Props) => {
  useScrollToTop();

  const { name, language } = useUserStore(
    useShallow((s) => ({ name: s.name, language: s.language }))
  );
  const { profile } = useAuth();
  const { toast } = useToast();
  const {
    partnerProfile, partnerDailyLog, sharing, loading,
    getPregnancyWeek, getDaysUntilDue, getBabyAgeDays,
    getCyclePhaseInfo, getDaysUntilNextPeriod
  } = usePartnerData();
  const { getUnreadCount } = usePartnerMessages();

  const [loveMessage, setLoveMessage] = useState('');

  // Onboarding turu — ilk girişdə bir dəfə
  const [showTour, setShowTour] = useState(() => {
    try {
      return !localStorage.getItem(PARTNER_TOUR_KEY);
    } catch {
      return false;
    }
  });
  const closeTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem(PARTNER_TOUR_KEY, String(Date.now()));
    } catch {/* boş */}
  };

  const womanName = partnerProfile?.name || tr('partnerdashboard_heyat_yoldasin_fc543b', 'Həyat yoldaşın');
  const lifeStage = partnerProfile?.life_stage || 'bump';
  const currentWeek = getPregnancyWeek() || 0;
  const daysUntilDue = getDaysUntilDue() || 0;
  const babyAgeDays = getBabyAgeDays();
  const cyclePhase = getCyclePhaseInfo();
  const pregnancyDay = partnerProfile?.last_period_date ? getPregnancyDay(partnerProfile.last_period_date) : 0;

  const { data: dayContent } = usePregnancyContentByDay(pregnancyDay > 0 ? pregnancyDay : undefined);
  const { data: fruitImages = [] } = useFruitImages();
  const { tipText, tipEmoji } = useDailyTip(lifeStage, currentWeek);

  const weekData = currentWeek > 0 ? getDynamicFruitData(fruitImages, pregnancyDay, currentWeek, dayContent) : null;

  // Həftəlik partnyor bələdçisi (pregnancy_daily_content.partner_tip — dil suffiksi ilə)
  const partnerTip: string | null = (() => {
    if (!dayContent) return null;
    const d = dayContent as any;
    const localized = language !== 'az' ? d[`partner_tip_${language}`] || (language === 'kk' || language === 'uz' || language === 'ka' ? d.partner_tip_ru : null) || (language === 'de' || language === 'ar' ? d.partner_tip_en : null) : null;
    return localized || d.partner_tip || null;
  })();

  const mood = partnerDailyLog?.mood ?? null;
  const needsSupport = sharing.share_mood && mood !== null && mood <= 2;

  const sendLove = async () => {
    await hapticFeedback.heavy();
    if (!profile || !partnerProfile) return;
    try {
      await supabase.from('partner_messages').insert({
        sender_id: profile.user_id,
        receiver_id: partnerProfile.user_id,
        message_type: 'love',
        content: '❤️'
      });
      toast({ title: tr('partnerdashboard_sevgi_gonderildi_4284b1', '💕 Sevgi göndərildi!'), description: `${womanName} ${tr('partner_will_receive_notification', 'bildiriş alacaq')}` });
    } catch (err) {
      console.error('Error sending love:', err);
    }
  };

  const sendQuickMessage = async (text?: string) => {
    const content = (text ?? loveMessage).trim();
    if (!content || !profile || !partnerProfile) return;
    await hapticFeedback.medium();
    try {
      await supabase.from('partner_messages').insert({
        sender_id: profile.user_id,
        receiver_id: partnerProfile.user_id,
        message_type: 'text',
        content
      });
      toast({ title: tr('partnerdashboard_mesaj_gonderildi_dca65e', '💌 Mesaj göndərildi!'), description: content });
      if (!text) setLoveMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // ── Stage-ə görə hero statları ──
  const heroStats: {emoji: string;value: string;label: string;}[] = (() => {
    if (lifeStage === 'bump') {
      return [
      { emoji: weekData?.emoji || '🍎', value: `${currentWeek}`, label: tr('partnerv2_hefte', 'həftə') },
      { emoji: '⏳', value: `${daysUntilDue}`, label: tr('partnerv2_gun_qaldi', 'gün qaldı') },
      ...(sharing.share_water ? [{ emoji: '💧', value: `${partnerDailyLog?.water_intake || 0}`, label: 'ml' }] : [])];
    }
    if (lifeStage === 'mommy') {
      const months = Math.floor(babyAgeDays / 30);
      return [
      { emoji: partnerProfile?.baby_gender === 'boy' ? '👦' : '👧', value: partnerProfile?.baby_name || tr('partnerv2_korpe', 'Körpə'), label: '' },
      { emoji: '🎂', value: months > 0 ? `${months}` : `${babyAgeDays}`, label: months > 0 ? tr('common_ay', 'ay') : tr('common_gun', 'gün') },
      ...(sharing.share_water ? [{ emoji: '💧', value: `${partnerDailyLog?.water_intake || 0}`, label: 'ml' }] : [])];
    }
    // flow
    if (!sharing.share_cycle) return [];
    const phaseMeta: Record<string, {emoji: string;label: string;}> = {
      menstrual: { emoji: '🩸', label: tr('partnerv2_faza_menstrual', 'Menstruasiya') },
      follicular: { emoji: '🌱', label: tr('partnerv2_faza_follikulyar', 'Follikulyar') },
      ovulation: { emoji: '✨', label: tr('partnerv2_faza_ovulyasiya', 'Ovulyasiya') },
      luteal: { emoji: '🌙', label: tr('partnerv2_faza_luteal', 'Luteal') }
    };
    const pm = cyclePhase ? phaseMeta[cyclePhase.phase] : null;
    return [
    { emoji: pm?.emoji || '🌸', value: pm?.label || '—', label: tr('partnerv2_faza', 'faza') },
    { emoji: '📅', value: `${getDaysUntilNextPeriod()}`, label: tr('partnerv2_gun_novbetiye', 'gün növbətiyə') }];
  })();

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <motion.div className="w-14 h-14 rounded-full"
        style={{ border: '4px solid var(--a-blue-2)', borderTopColor: 'transparent' }}
        animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>);
  }

  // Bağlantı yoxdur
  if (!partnerProfile) {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <div className="a-sky" aria-hidden>
          <span className="a-cloud c1" /><span className="a-cloud c2" /><span className="a-cloud c3" />
        </div>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
          className="w-28 h-28 rounded-full flex items-center justify-center mb-6 relative z-10"
          style={{ background: 'var(--a-grad-blue)', boxShadow: '0 24px 48px -16px rgba(99, 172, 223, 0.6)' }}>
          <Heart size={52} style={{ color: BLUE_INK }} className="fill-white/40" />
        </motion.div>
        <h1 className="relative z-10 mb-2" style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
          {tr('partnerdashboard_hele_baglanmamisiniz_bc4f93', 'Hələ bağlanmamısınız')}
        </h1>
        <p className="relative z-10 mb-6 max-w-sm" style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}>
          {tr('partnerdashboard_heyat_yoldasinizin_anacan_tetb_9b4f56', 'Həyat yoldaşınızın Anacan tətbiqindəki partnyor kodunu daxil edib bağlanın — bütün məlumatlar real vaxtda sinxronlaşacaq.')}
        </p>
        <div className="a-card relative z-10 max-w-sm" style={{ padding: 20 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)', marginBottom: 8 }}>{tr('partnerdashboard_nece_baglanmali_8234cb', '📲 Necə bağlanmalı?')}</p>
          <ol className="text-start space-y-1.5 list-decimal list-inside" style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>
            <li>{tr('partnerdashboard_heyat_yoldasinizdan_onun_profilindeki_pa_c8a86f', 'Həyat yoldaşınızdan onun profilindəki partnyor kodunu istəyin')}</li>
            <li>{tr('partnerdashboard_profil_bolmesine_kecerek_kodu_daxil_edin_2d8a3e', 'Profil bölməsinə keçərək kodu daxil edin')}</li>
            <li>{tr('partnerdashboard_bir_nece_saniye_icinde_baglanti_yaranaca_99fbd5', 'Bir neçə saniyə içində bağlantı yaranacaq')}</li>
          </ol>
        </div>
      </div>);
  }

  return (
    <div className="a-scope pb-6 min-h-screen relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" /><span className="a-cloud c2" /><span className="a-cloud c3" />
        <span className="a-cloud c4" /><span className="a-cloud c5" />
      </div>

      <div className="a-shell relative z-10">
        {/* Top bar */}
        <header className="a-topbar">
          <div>
            <motion.p className="a-eyebrow" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              {tr('partnerv2_birlikde_eyebrow', 'BİRLİKDƏ')}
            </motion.p>
            <motion.h1 className="a-wordmark" style={{ fontSize: 19 }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
              {tr('partnerv2_salam', 'Salam')}, {name || 'Partner'}! 👋
            </motion.h1>
          </div>
          <div className="a-topbar-actions">
            <SOSButton variant="compact" />
          </div>
        </header>

        <div className="space-y-4">
          {/* ── HERO: onun günü ── */}
          <motion.div className="a-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
              style={{ background: 'var(--a-grad-blue)' }}>
                {lifeStage === 'bump' ? '🤰' : lifeStage === 'mommy' ? '👩‍🍼' : '🌸'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="truncate" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{womanName}</h2>
                <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
                  {lifeStage === 'bump' ? tr('partnerv2_hamilelik_yolculugu', 'Hamiləlik yolçuluğu') :
                  lifeStage === 'mommy' ? tr('partnerv2_analiq_dovru', 'Analıq dövrü') :
                  tr('partnerv2_tsikl_izleme', 'Tsikl izləmə')}
                </p>
              </div>
              {sharing.share_mood && mood !== null &&
              <div className="flex flex-col items-center shrink-0"
              style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '6px 12px' }}>
                  <span style={{ fontSize: 20 }}>{MOOD_EMOJIS[mood - 1]}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--a-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tr('partnerv2_ehval', 'əhval')}
                  </span>
                </div>
              }
              <motion.button
                onClick={sendLove}
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--a-pink-1)' }}
                whileTap={{ scale: 0.85 }}
                aria-label="❤️">
                <Heart size={19} style={{ color: 'var(--a-pink-ink)', fill: 'var(--a-pink-ink)' }} />
              </motion.button>
            </div>

            {/* Stat trio */}
            {heroStats.length > 0 &&
            <div className={`grid gap-2 ${heroStats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {heroStats.map((s, i) =>
              <div key={i} className="text-center" style={{ background: 'var(--a-surface-soft)', borderRadius: 16, padding: '10px 6px' }}>
                    <div style={{ fontSize: 18 }}>{s.emoji}</div>
                    <p className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)', marginTop: 2 }}>{s.value}</p>
                    {s.label && <p style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{s.label}</p>}
                  </div>
              )}
              </div>
            }

            {/* Simptomlar */}
            {sharing.share_symptoms && (partnerDailyLog?.symptoms?.length || 0) > 0 &&
            <div className="flex flex-wrap gap-1.5 mt-3">
                {partnerDailyLog!.symptoms!.slice(0, 4).map((s) =>
              <span key={s} className="a-tag" style={{ cursor: 'default', fontSize: 10.5, padding: '5px 10px' }}>{s}</span>
              )}
              </div>
            }

            {/* Dəstək banneri */}
            {needsSupport &&
            <div className="flex items-center gap-2.5 mt-3" style={{ background: 'var(--a-pink-1)', borderRadius: 14, padding: '10px 13px' }}>
                <Heart size={15} style={{ color: 'var(--a-pink-ink)' }} className="shrink-0" />
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-alert-ink)' }}>
                  {tr('partnerv2_destek_banner', 'Bu gün əhvalı yaxşı deyil — ona xüsusi diqqət göstər 💗')}
                </p>
              </div>
            }
          </motion.div>

          {/* Oxunmamış mesaj banneri */}
          {getUnreadCount() > 0 &&
          <motion.button
            onClick={onOpenChat}
            className="w-full flex items-center gap-3 text-start"
            style={{ background: 'var(--a-blue-1)', borderRadius: 18, padding: 14, border: '1.5px solid rgba(99, 172, 223, 0.5)' }}
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            whileTap={{ scale: 0.99 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-chip-overlay)' }}>
                <MessageCircle size={18} style={{ color: BLUE_SOFT }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 13.5, fontWeight: 800, color: BLUE_INK }}>{tr('partnerdashboard_yeni_mesajiniz_var_0ef93a', 'Yeni mesajınız var!')}</p>
                <p style={{ fontSize: 11.5, color: BLUE_SOFT }}>{getUnreadCount()} {tr('partnerdashboard_oxunmamis_mesaj_4cf5d8', 'oxunmamış mesaj')}</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-blue-2)' }}>
                <span className="text-white font-black" style={{ fontSize: 13 }}>{getUnreadCount()}</span>
              </div>
            </motion.button>
          }

          {/* ── Bu həftə körpəniz (bump) ── */}
          {lifeStage === 'bump' &&
          <PartnerWeekInfoCard
            currentWeek={currentWeek}
            weekData={weekData}
            dayContent={dayContent}
            language={language}
            isMultiple={!!partnerProfile?.multiples_type && partnerProfile.multiples_type !== 'single'} />
          }

          {/* ── Tsikl statusu (flow) ── */}
          {/* NOT: bu kart əvvəllər FlowDashboard.tsx-də (qadının öz ekranında)
          səhvən mount olunmuşdu və heç vaxt görünmürdü - düzgün yeri
          budur (partnyorun öz ekranı, burada usePartnerData() qadının
          profilini qaytarır, komponentin öz life_stage yoxlaması düzgün
          işləyir). */}
          {lifeStage === 'flow' && sharing.share_cycle &&
          <PartnerFlowStatusCard />
          }

          {/* ── Körpə bu gün + Kriz dövrü (mommy) ── */}
          {lifeStage === 'mommy' && sharing.share_baby_logs &&
          <PartnerBabyTodayCard
            motherUserId={partnerProfile.user_id}
            babyName={partnerProfile.baby_name || tr('partnerv2_korpe', 'Körpə')}
            onOpen={() => onNavigate('partner-baby-day')} />
          }
          {lifeStage === 'mommy' && babyAgeDays > 0 &&
          <PartnerBabyCrisisCard
            babyAgeWeeks={Math.floor(babyAgeDays / 7)}
            babyName={partnerProfile.baby_name || tr('partnerv2_korpe', 'Körpə')} />
          }

          {/* ── Günlük tapşırıqlar ── */}
          <AdInlineAnchor id="home_banner" />
          <DailyMissionsCard />

          {/* ── Növbəti randevu ── */}
          {sharing.share_appointments &&
          <NextAppointmentCard motherUserId={partnerProfile.user_id} onOpen={() => onNavigate('partner-appointments')} />
          }

          {/* ── Sürətli mesaj ── */}
          <motion.div className="a-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={loveMessage}
                onChange={(e) => setLoveMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendQuickMessage()}
                placeholder={tr('partnerdashboard_sevgi_mesaji_yaz_54b43a', 'Sevgi mesajı yaz...')}
                className="flex-1 h-11 px-4 outline-none min-w-0"
                style={{ borderRadius: 999, background: 'var(--a-surface-soft)', fontSize: 13, color: 'var(--a-ink)' }} />
              <motion.button
                onClick={() => sendQuickMessage()}
                disabled={!loveMessage.trim()}
                className="w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-50 shrink-0"
                style={{ background: 'var(--a-blue-2)' }}
                whileTap={{ scale: 0.95 }}
                aria-label={tr('helpscreen_gonder_3f11bd', 'Göndər')}>
                <Send size={16} />
              </motion.button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {[
              tr('partnerdashboard_seni_sevirem_d85d3c', '❤️ Səni sevirəm!'),
              tr('partnerdashboard_gozelsen_1124fe', '🌹 Gözəlsən!'),
              tr('partnerdashboard_guclusen_673231', '💪 Güclüsən!'),
              tr('partnerv2_nece_hiss_edirsen', '🤗 Necə hiss edirsən?')].
              map((msg) =>
              <motion.button
                key={msg}
                onClick={() => sendQuickMessage(msg)}
                style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--a-blue-1)', color: BLUE_SOFT, fontSize: 11, fontWeight: 600 }}
                whileTap={{ scale: 0.95 }}>
                  {msg}
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* ── Aktivlik lenti ── */}
          <PartnerActivityFeed />

          {/* ── Həftəlik bələdçi / günün tövsiyəsi ── */}
          {(partnerTip || tipText) &&
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="a-card" style={{ background: 'var(--a-surface)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: 'var(--a-yellow-1)' }}>
                  {partnerTip ? <BookOpen size={16} style={{ color: 'var(--a-yellow-ink)' }} /> : <Sparkles size={16} style={{ color: 'var(--a-yellow-ink)' }} />}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>
                    {partnerTip ?
                  `${currentWeek}. ${tr('partnerv2_hefte_beledci', 'həftə — partnyor bələdçisi')}` :
                  tr('partnerdashboard_gunun_tovsiyesi_b3a563', 'Günün Tövsiyəsi')}
                  </h3>
                </div>
                {!partnerTip && <span className="ms-auto text-2xl">{tipEmoji}</span>}
              </div>
              <p className="leading-relaxed" style={{ fontSize: 13, color: 'var(--a-body-text)' }}>
                {partnerTip || tipText}
              </p>
            </motion.div>
          }
        </div>
      </div>

      {/* Onboarding turu — ilk girişdə */}
      <AnimatePresence>
        {showTour && <PartnerOnboardingTour onClose={closeTour} />}
      </AnimatePresence>
    </div>);

};

export default PartnerHomeScreen;
