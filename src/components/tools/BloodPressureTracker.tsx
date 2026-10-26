import { useState } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, Plus, Trash2, Phone, MessageCircle, Info, Activity } from 'lucide-react';
import { ToolPage, ToolHeader, ToolEmpty } from '@/components/tools/anacan/ToolKit';
import { useBloodPressureLogs, useAddBpLog, useDeleteBpLog, type BpLog } from '@/hooks/useBloodPressure';
import { classifyBp } from '@/lib/bloodPressure';
import { useUserStore } from '@/store/userStore';
import { hapticFeedback } from '@/lib/native';
import { toast } from 'sonner';
import { tr } from '@/lib/tr';

/**
 * Qan Təzyiqi İzləyicisi — preeklampsiya nəzarəti ilə.
 * Hamiləlikdə ≥140/90 xəbərdarlıq, ≥160/110 təcili.
 */

interface Props {
  onBack: () => void;
}

const BloodPressureTracker = ({ onBack }: Props) => {
  const lifeStage = useUserStore((s) => s.lifeStage);
  const isPregnant = lifeStage === 'bump';

  const { data: logs = [], isLoading } = useBloodPressureLogs();
  const addLog = useAddBpLog();
  const deleteLog = useDeleteBpLog();

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');

  const latest = logs[0];
  const latestAssessment = latest ? classifyBp(latest.systolic, latest.diastolic, isPregnant) : null;

  const handleSave = async () => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    const pul = pulse ? parseInt(pulse, 10) : null;

    if (!sys || !dia || sys < 50 || sys > 260 || dia < 30 || dia > 200) {
      toast.error(tr('bp_invalid', 'Düzgün dəyərlər daxil edin (məs. 120/80)'));
      return;
    }
    if (pul !== null && (pul < 30 || pul > 220)) {
      toast.error(tr('bp_invalid_pulse', 'Nəbz 30-220 aralığında olmalıdır'));
      return;
    }

    await hapticFeedback.medium();
    try {
      await addLog.mutateAsync({ systolic: sys, diastolic: dia, pulse: pul });
      const assessment = classifyBp(sys, dia, isPregnant);
      toast.success(`${assessment.emoji} ${assessment.label} — ${tr('bp_saved', 'qeyd edildi')}`);
      setSystolic('');
      setDiastolic('');
      setPulse('');
      // Health inteqrasiyası aktivdirsə → Apple Health / Health Connect-ə də yaz (arxa planda)
      import('@/lib/healthVitals').then((m) => m.writeBloodPressureToHealth(sys, dia)).catch(() => {});
    } catch (e) {
      console.error(e);
      toast.error(tr('bp_save_error', 'Saxlanılmadı — bazanın hazır olduğundan əmin olun'));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 62,
    borderRadius: 16,
    background: 'var(--a-surface-soft)',
    border: '2px solid transparent',
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--a-ink)',
    outline: 'none'
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${tr('partnerv2_bu_gun', 'Bu gün')} · ${time}`;
    return `${date.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'short' })} · ${time}`;
  };

  const showUrgent = latestAssessment && (latestAssessment.category === 'crisis' || latestAssessment.pregnancyAlert === 'urgent');
  const showWarning = latestAssessment && !showUrgent && (latestAssessment.pregnancyAlert === 'warning' || latestAssessment.category === 'stage2');

  return (
    <ToolPage>
      <ToolHeader
        title={tr('bp_title', 'Qan Təzyiqi')}
        eyebrow={isPregnant ? tr('bp_eyebrow_bump', 'Preeklampsiya nəzarəti') : tr('bp_eyebrow', 'Ürək sağlamlığı')}
        onBack={onBack} />

      <div className="space-y-3.5">
        {/* ── TƏCİLİ xəbərdarlıq ── */}
        <AnimatePresence>
          {showUrgent &&
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="a-alert-card">
              <span className="a-alert-eyebrow">🚨 {tr('bp_urgent_eyebrow', 'Təcili')}</span>
              <h2 className="a-alert-headline a-heading">
                {isPregnant && latestAssessment?.pregnancyAlert === 'urgent' ?
              tr('bp_urgent_preeclampsia', 'Ağır hipertenziya — preeklampsiya riski!') :
              tr('bp_urgent_crisis', 'Hipertonik böhran!')}
              </h2>
              <p className="a-alert-text">
                {latest?.systolic}/{latest?.diastolic} mmHg. {tr('bp_urgent_text', 'Gözləməyin — dərhal həkiminizə və ya təcili yardıma müraciət edin.')}
              </p>
              <div className="flex gap-2 mt-1">
                <a href="tel:103" className="a-cta-btn" style={{ background: 'var(--a-pink-ink)', flex: 1, justifyContent: 'center' }}>
                  <Phone size={14} strokeWidth={2.2} /> 103
                </a>
              </div>
            </motion.div>
          }
          {showWarning && !showUrgent &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5"
            style={{ background: 'var(--a-yellow-1)', borderRadius: 16, padding: 14 }}>
              <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--a-warn-ink)' }} />
              <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-warn-ink)', lineHeight: 1.5 }}>
                {isPregnant ?
              tr('bp_warning_preeclampsia', 'Son ölçmə ≥140/90 — hamiləlikdə bu, preeklampsiya əlaməti ola bilər. Bu gün həkiminizlə əlaqə saxlayın.') :
              tr('bp_warning_stage2', 'Son ölçməniz yüksəkdir. Bu gün həkiminizlə əlaqə saxlamağı tövsiyə edirik.')}
              </p>
            </motion.div>
          }
        </AnimatePresence>

        {/* ── Ölçmə daxil et ── */}
        <div className="a-card">
          <h3 className="a-card-title" style={{ marginBottom: 14 }}>{tr('bp_new_reading', 'Yeni ölçmə')}</h3>
          <div className="grid grid-cols-3 gap-2.5 mb-2">
            <div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="120"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                style={inputStyle} />
              <p className="text-center mt-1.5" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
                {tr('bp_systolic', 'Sistolik')} <span style={{ fontWeight: 500 }}>{tr('bp_systolic_hint', '(yuxarı)')}</span>
              </p>
            </div>
            <div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="80"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                style={inputStyle} />
              <p className="text-center mt-1.5" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
                {tr('bp_diastolic', 'Diastolik')} <span style={{ fontWeight: 500 }}>{tr('bp_diastolic_hint', '(aşağı)')}</span>
              </p>
            </div>
            <div>
              <input
                type="number"
                inputMode="numeric"
                placeholder="72"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                style={inputStyle} />
              <p className="text-center mt-1.5" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
                {tr('bp_pulse', 'Nəbz')} <span style={{ fontWeight: 500 }}>({tr('bp_optional', 'istəyə bağlı')})</span>
              </p>
            </div>
          </div>

          <motion.button
            onClick={handleSave}
            disabled={addLog.isPending || !systolic || !diastolic}
            className="w-full flex items-center justify-center gap-2 text-white disabled:opacity-50 mt-2"
            style={{ height: 50, borderRadius: 999, background: 'var(--a-peach-2)', fontSize: 14, fontWeight: 700, boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}
            whileTap={{ scale: 0.98 }}>
            <Plus size={17} />
            {tr('bp_save_btn', 'Qeyd et')}
          </motion.button>
        </div>

        {/* ── Son vəziyyət ── */}
        {latestAssessment && latest &&
        <div className="a-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center text-2xl shrink-0"
            style={{ borderRadius: 16, background: latestAssessment.bg }}>
                {latestAssessment.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
                    {latest.systolic}/{latest.diastolic}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>mmHg</span>
                  {latest.pulse &&
                <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
                      <Activity size={11} /> {latest.pulse}
                    </span>
                }
                </div>
                <span className="inline-block mt-1"
              style={{ background: latestAssessment.bg, color: latestAssessment.ink, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
                  {latestAssessment.label}
                </span>
              </div>
            </div>
            <p className="mt-3 leading-relaxed" style={{ fontSize: 12.5, color: 'var(--a-body-text)' }}>
              {latestAssessment.guidance}
            </p>
          </div>
        }

        {/* ── Tarixçə ── */}
        {isLoading ?
        <div className="flex justify-center py-10">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
          </div> :
        logs.length === 0 ?
        <ToolEmpty
          icon={<HeartPulse size={26} style={{ color: 'var(--a-accent-ink)' }} />}
          title={tr('bp_empty_title', 'Hələ ölçmə yoxdur')}
          text={tr('bp_empty_text', 'İlk qan təzyiqi ölçmənizi yuxarıda qeyd edin. Hamiləlikdə həftədə 1-2 dəfə ölçmək tövsiyə olunur.')} /> :

        <div className="a-card" style={{ padding: '16px 16px 6px' }}>
            <h3 className="a-card-title" style={{ marginBottom: 8 }}>{tr('bp_history', 'Tarixçə')}</h3>
            {logs.slice(0, 20).map((log: BpLog) => {
            const a = classifyBp(log.systolic, log.diastolic, isPregnant);
            return (
              <div key={log.id} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--a-line)' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.ink }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>
                      {log.systolic}/{log.diastolic}
                      {log.pulse && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--a-ink-soft)' }}> · {log.pulse} {tr('bp_bpm', 'vur/dəq')}</span>}
                    </p>
                    <p style={{ fontSize: 10.5, color: 'var(--a-ink-faint)' }}>{formatDate(log.measured_at)}</p>
                  </div>
                  <span style={{ background: a.bg, color: a.ink, borderRadius: 999, padding: '2px 9px', fontSize: 9.5, fontWeight: 800 }}>
                    {a.label}
                  </span>
                  <button
                  onClick={() => deleteLog.mutate(log.id)}
                  className="p-1.5 shrink-0"
                  aria-label={tr('untranslated_sil_zwa7lz', 'Sil')}>
                    <Trash2 size={14} style={{ color: 'var(--a-ink-faint)' }} />
                  </button>
                </div>);
          })}
          </div>
        }

        {/* ── Hədlər ── */}
        <div style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 'var(--a-radius-md)', padding: 16 }}>
          <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--a-disclaimer-strong)', marginBottom: 8 }}>
            {tr('bp_thresholds_title', '📋 İstinad hədləri')}
          </p>
          <div className="space-y-1" style={{ fontSize: 11, color: 'var(--a-disclaimer-ink)', lineHeight: 1.6 }}>
            <p>💚 {tr('bp_th_normal', 'Normal')}: {isPregnant ? '90–129 / 60–84' : '90–119 / 60–79'}</p>
            <p>🟡 {tr('bp_cat_elevated', 'Yüksəlmiş')}: {isPregnant ? '130–139 / 85–89' : '120–129 / <80'}</p>
            {!isPregnant && <p>🟠 {tr('bp_cat_monitor', 'Yüksəlmiş — izləyin')}: 130–139 / 80–89</p>}
            <p>🔴 {tr('bp_cat_high_reading', 'Yüksək təzyiq')}: ≥140/90{isPregnant ? ` — ${tr('bp_th_preeclampsia', 'hamiləlikdə preeklampsiya riski, həkimə bildirin')}` : ''}</p>
            {isPregnant && <p>🚨 {tr('bp_urgent_eyebrow', 'Təcili')}: ≥160/110 — {tr('bp_th_crisis', 'dərhal 103')}</p>}
            <p>🚨 {tr('bp_cat_crisis', 'Hipertonik böhran')}: ≥180/120 — {tr('bp_th_crisis', 'dərhal 103')}</p>
          </div>
          <p className="mt-2" style={{ fontSize: 10, color: 'var(--a-disclaimer-ink)', opacity: 0.8 }}>
            {tr('bp_disclaimer', 'Bu alət həkim müayinəsini əvəz etmir.')}
          </p>
        </div>
      </div>
    </ToolPage>);

};

export default BloodPressureTracker;
