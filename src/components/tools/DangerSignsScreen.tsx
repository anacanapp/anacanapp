import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ChevronDown, ShieldAlert, Siren, HeartHandshake } from 'lucide-react';
import { ToolPage, ToolHeader } from '@/components/tools/anacan/ToolKit';
import { getDangerSignsForStage, type DangerSign } from '@/lib/redFlags';
import { getEmergencyNumber } from '@/lib/emergency';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { hapticFeedback } from '@/lib/native';
import { toast } from 'sonner';
import { tr } from '@/lib/tr';

/**
 * Təhlükə Əlamətləri — təcili müraciət tələb edən vəziyyətlər (triage).
 * Urgent → 103 + partnyora SOS; Soon → bu gün həkimlə əlaqə.
 */

interface Props {
  onBack: () => void;
}

const DangerSignsScreen = ({ onBack }: Props) => {
  const { lifeStage, countryCode } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, countryCode: s.countryCode }))
  );
  const { profile } = useAuth();
  // Təcili nömrə İSTİFADƏÇİNİN ÖLKƏSİNƏ görə (dil yox)
  const emergencyNum = getEmergencyNumber((profile as any)?.country_code || countryCode);
  const { sendSOS, hasPartner, loading: sosLoading } = useSOSAlert();
  const [openId, setOpenId] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  // Əkiz/üçüz/dördüz hamiləlikdə TTTS kimi çoxdöllüyə-xas əlamətlər də əlavə olunur
  const isMultiplesPregnancy = !!profile?.multiples_type && profile.multiples_type !== 'single';
  const signs = getDangerSignsForStage(lifeStage, isMultiplesPregnancy);
  const urgentSigns = signs.filter((s) => s.severity === 'urgent');
  const soonSigns = signs.filter((s) => s.severity === 'soon');

  const toggle = async (id: string) => {
    await hapticFeedback.light();
    setOpenId((prev) => prev === id ? null : id);
  };

  const notifyPartner = async (sign: DangerSign) => {
    await hapticFeedback.heavy();
    const result = await sendSOS(
      `${sign.emoji} ${sign.title} — ${tr('rf_partner_msg_suffix', 'dərhal əlaqə saxla!')}`,
      true,
      'emergency'
    );
    if (!result.error) {
      setNotifiedIds((prev) => new Set(prev).add(sign.id));
      toast.success(tr('rf_partner_notified', 'Partnyorunuz xəbərdar edildi 💙'));
    }
  };

  const renderSign = (sign: DangerSign) => {
    const isUrgent = sign.severity === 'urgent';
    const isOpen = openId === sign.id;
    const notified = notifiedIds.has(sign.id);

    return (
      <motion.div
        key={sign.id}
        className="overflow-hidden"
        style={{
          background: 'var(--a-surface)',
          borderRadius: 18,
          boxShadow: 'var(--a-card-shadow)',
          border: isOpen ? `1.5px solid ${isUrgent ? 'var(--a-pink-2)' : '#ffc94d'}` : '1.5px solid transparent'
        }}>

        <button onClick={() => toggle(sign.id)} className="w-full flex items-center gap-3 text-start" style={{ padding: 14 }}>
          <div className="w-11 h-11 flex items-center justify-center text-2xl shrink-0"
          style={{ borderRadius: 14, background: isUrgent ? 'var(--a-pink-1)' : 'var(--a-yellow-1)' }}>
            {sign.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{sign.title}</p>
            <span className="inline-block mt-0.5"
            style={{
              background: isUrgent ? 'var(--a-pink-1)' : 'var(--a-yellow-1)',
              color: isUrgent ? 'var(--a-pink-ink)' : 'var(--a-yellow-ink)',
              borderRadius: 999, padding: '1px 8px', fontSize: 9.5, fontWeight: 800
            }}>
              {isUrgent ? tr('rf_urgent_chip', 'TƏCİLİ') : tr('rf_soon_chip', 'BU GÜN HƏKİMƏ')}
            </span>
          </div>
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
            <ChevronDown size={16} style={{ color: 'var(--a-ink-faint)' }} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}>
              <div style={{ padding: '0 14px 14px' }}>
                <p className="leading-relaxed mb-3" style={{ fontSize: 12.5, color: 'var(--a-body-text)' }}>
                  {sign.desc}
                </p>
                <div
                className="mb-3"
                style={{
                  background: isUrgent ? 'var(--a-alert-bg)' : 'var(--a-yellow-1)',
                  borderRadius: 13, padding: '10px 12px'
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: isUrgent ? 'var(--a-alert-ink)' : 'var(--a-warn-ink)', lineHeight: 1.5 }}>
                    {isUrgent ?
                  tr('rf_urgent_guidance_n', '⚠️ Gözləməyin: dərhal həkiminizə zəng edin və ya təcili yardıma ({n}) müraciət edin.').replace('{n}', emergencyNum) :
                  tr('rf_soon_guidance', '📞 Bu gün ərzində həkiminizlə əlaqə saxlayın və vəziyyəti izləyin.')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isUrgent &&
                <a
                  href={`tel:${emergencyNum}`}
                  className="flex-1 flex items-center justify-center gap-1.5 text-white"
                  style={{ height: 44, borderRadius: 999, background: 'var(--a-pink-ink)', fontSize: 13, fontWeight: 800 }}>
                      <Phone size={15} /> {emergencyNum}
                    </a>
                }
                  {hasPartner &&
                <button
                  onClick={() => notifyPartner(sign)}
                  disabled={sosLoading || notified}
                  className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{
                    height: 44, borderRadius: 999,
                    background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)',
                    fontSize: 12.5, fontWeight: 700
                  }}>
                      <HeartHandshake size={15} />
                      {notified ? tr('rf_partner_done', 'Xəbərdar edildi ✓') : tr('rf_notify_partner', 'Partnyora bildir')}
                    </button>
                }
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </motion.div>);

  };

  return (
    <ToolPage>
      <ToolHeader
        title={tr('rf_title', 'Təhlükə Əlamətləri')}
        eyebrow={lifeStage === 'mommy' ? tr('rf_eyebrow_pp', 'Doğuşdan sonra') : tr('rf_eyebrow_bump', 'Hamiləlik dövrü')}
        onBack={onBack} />

      <div className="space-y-3.5">
        {/* Giriş */}
        <div className="flex items-start gap-2.5" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 16, padding: 14 }}>
          <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--a-disclaimer-strong)' }} />
          <p style={{ fontSize: 11.5, color: 'var(--a-disclaimer-ink)', lineHeight: 1.55 }}>
            {tr('rf_intro', 'Bu əlamətlərdən hər hansı biri sizdə varsa, gözləmək olmaz. Şübhə halında həmişə həkimə müraciət edin — "boş yerə narahat etdim" deyə bir şey yoxdur.')}
          </p>
        </div>

        {/* Təcili yardım sətri — nömrə ölkəyə görə */}
        <a
          href={`tel:${emergencyNum}`}
          className="flex items-center gap-3"
          style={{ background: 'var(--a-alert-bg)', borderRadius: 'var(--a-radius-md)', padding: 14, border: '1.5px solid rgba(177,39,91,0.35)' }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: 2 }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--a-pink-ink)' }}>
            <Siren size={19} className="text-white" />
          </motion.div>
          <div className="flex-1">
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-alert-ink)' }}>{tr('rf_103_title', 'Təcili Tibbi Yardım')}</p>
            <p style={{ fontSize: 11.5, color: 'var(--a-alert-soft)' }}>{tr('rf_103_sub', 'Zəng etmək üçün toxunun')}</p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--a-alert-ink)' }}>{emergencyNum}</span>
        </a>

        {/* Təcili əlamətlər */}
        <div>
          <h3 className="a-section-title" style={{ marginBottom: 10, fontWeight: 800 }}>🚨 {tr('rf_urgent_section', 'Dərhal müraciət')}</h3>
          <div className="space-y-2.5">{urgentSigns.map(renderSign)}</div>
        </div>

        {/* Bu gün həkimə */}
        {soonSigns.length > 0 &&
        <div>
            <h3 className="a-section-title" style={{ marginBottom: 10, fontWeight: 800 }}>📞 {tr('rf_soon_section', 'Bu gün həkimlə əlaqə')}</h3>
            <div className="space-y-2.5">{soonSigns.map(renderSign)}</div>
          </div>
        }

        <p className="text-center" style={{ fontSize: 10.5, color: 'var(--a-ink)', padding: '4px 16px' }}>
          {tr('rf_disclaimer', 'Bu siyahı məlumat xarakterlidir və həkim qiymətləndirməsini əvəz etmir.')}
        </p>
      </div>
    </ToolPage>);

};

export default DangerSignsScreen;
