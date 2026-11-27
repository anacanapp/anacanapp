import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Package, Check, Car, FileText, Phone, HeartPulse } from 'lucide-react';
import { usePartnerHospitalBag } from '@/hooks/usePartnerHospitalBag';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/**
 * "Xəstəxana rejimi" — doğuş siqnalından sonra partnyorun yol xəritəsi:
 * addım-addım checklist + çanta vəziyyəti + lokasiya.
 */

interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
  onOpenContractions?: () => void;
}

const HospitalRunScreen = ({ onBack, onNavigate, onOpenContractions }: Props) => {
  useScrollToTop();
  const { user } = useAuth();
  const { checkedCount, totalCount, getProgress } = usePartnerHospitalBag();
  const { alerts } = useSOSAlert();
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());

  // Ən son doğuş siqnalı (lokasiya üçün)
  const birthAlert = alerts.find((a) => a.alert_type === 'birth' && a.receiver_id === user?.id);
  const hasLocation = birthAlert?.latitude != null && birthAlert?.longitude != null;

  const steps = [
  { icon: HeartPulse, text: tr('partnerv2_hr_step_sakit', 'Sakit ol — dərin nəfəs al. Sən hazırsan!') },
  { icon: Package, text: tr('partnerv2_hr_step_canta', 'Xəstəxana çantasını götür') },
  { icon: FileText, text: tr('partnerv2_hr_step_senedler', 'Sənədləri yoxla (vəsiqə, analizlər, kart)') },
  { icon: Car, text: tr('partnerv2_hr_step_masin', 'Maşını hazırla / taksi çağır') },
  { icon: Phone, text: tr('partnerv2_hr_step_hekim', 'Həkimə / xəstəxanaya zəng et') }];


  const toggleStep = (i: number) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);else next.add(i);
      return next;
    });
  };

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerv2_dogus_vaxti', 'Doğuş vaxtı')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('partnerv2_xestexana_rejimi', 'Xəstəxana Rejimi')} 🏥</p>
            </div>
          </div>
        </header>

        <div className="space-y-3.5">
          {/* Lokasiya */}
          {hasLocation &&
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => window.open(`https://maps.google.com/?q=${birthAlert!.latitude},${birthAlert!.longitude}`, '_blank')}
            className="w-full flex items-center gap-3 text-start"
            style={{ background: 'var(--a-blue-2)', borderRadius: 'var(--a-radius-md)', padding: 16, boxShadow: '0 14px 28px -12px rgba(99, 172, 223, 0.6)' }}
            whileTap={{ scale: 0.98 }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }}>
                <MapPin size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: 14.5, fontWeight: 800 }}>{tr('partnerv2_onun_yeri', 'Onun yeri')}</p>
                <p className="text-white/85" style={{ fontSize: 11.5 }}>{tr('partnerv2_xeritede_ac', 'Xəritədə aç və yola düş')}</p>
              </div>
              <Car size={20} className="text-white shrink-0" />
            </motion.button>
          }

          {/* Çanta vəziyyəti */}
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => onNavigate('partner-hospital-bag')}
            className="w-full a-card text-start"
            whileTap={{ scale: 0.98 }}>
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-peach-1)' }}>
                <Package size={19} style={{ color: 'var(--a-accent-ink)' }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>{tr('syncedfeaturesgrid_xestexana_cantasi_045078', 'Xəstəxana Çantası')}</p>
                <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>{checkedCount}/{totalCount} {tr('partner_ready', 'hazır')}</p>
              </div>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--a-accent-ink)' }}>{getProgress().toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'var(--a-grad-peach)' }}
              initial={{ width: 0 }} animate={{ width: `${getProgress()}%` }} transition={{ duration: 0.6 }} />
            </div>
          </motion.button>

          {/* Canlı sancılar */}
          {onOpenContractions &&
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            onClick={onOpenContractions}
            className="w-full flex items-center gap-3 text-start"
            style={{ background: 'var(--a-pink-1)', borderRadius: 'var(--a-radius-md)', padding: 16 }}
            whileTap={{ scale: 0.98 }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-chip-overlay)' }}>
                <HeartPulse size={19} style={{ color: 'var(--a-pink-ink)' }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-alert-ink)' }}>{tr('partnerv2_canli_sancilar', 'Canlı sancılar')}</p>
                <p style={{ fontSize: 11.5, color: 'var(--a-berry-ink)' }}>{tr('partnerv2_interval_ve_muddet', 'İnterval və müddəti izlə')}</p>
              </div>
            </motion.button>
          }

          {/* Addımlar */}
          <motion.div className="a-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="a-card-title" style={{ marginBottom: 12 }}>{tr('partnerv2_addim_addim', 'Addım-addım')}</h3>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const done = doneSteps.has(i);
                return (
                  <motion.button
                    key={i}
                    onClick={() => toggleStep(i)}
                    className="w-full flex items-center gap-3 text-start transition-all"
                    style={{
                      padding: '11px 13px',
                      borderRadius: 14,
                      background: done ? 'var(--a-green-1)' : 'var(--a-surface-soft)'
                    }}
                    whileTap={{ scale: 0.98 }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: done ? 'var(--a-green-2)' : 'rgba(255,255,255,0.7)' }}>
                      {done ? <Check size={14} className="text-white" strokeWidth={3} /> : <Icon size={14} style={{ color: 'var(--a-ink-soft)' }} />}
                    </div>
                    <p className={done ? 'line-through' : ''}
                    style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--a-ink-soft)' : 'var(--a-ink)' }}>
                      {s.text}
                    </p>
                  </motion.button>);
              })}
            </div>
          </motion.div>

          {/* Sakitləşdirici qeyd */}
          <div style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 16, padding: 14 }}>
            <p className="text-center" style={{ fontSize: 12, color: 'var(--a-disclaimer-ink)', lineHeight: 1.5 }}>
              {tr('partnerv2_hr_sakit_qeyd', 'İlk doğuşlar adətən saatlarla çəkir — tələsik amma təmkinli ol. Sən onun ən böyük dayağısan. 💪')}
            </p>
          </div>
        </div>
      </div>
    </div>);

};

export default HospitalRunScreen;
