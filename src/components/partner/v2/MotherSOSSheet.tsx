import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, Baby, X, Check } from 'lucide-react';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { tr } from '@/lib/tr';

/**
 * Ana tərəfi — SOS / "Doğuş başladı!" göndərmə sheet-i.
 * Təsadüfi toxunuşdan qorunmaq üçün 1.5 saniyə basılı tutma tələb olunur.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  lifeStage?: string | null;
}

const HOLD_MS = 1500;

const MotherSOSSheet = ({ open, onClose, lifeStage }: Props) => {
  const { sendSOS, loading, hasPartner } = useSOSAlert();
  const [holdType, setHoldType] = useState<'emergency' | 'birth' | null>(null);
  const [progress, setProgress] = useState(0);
  const [sent, setSent] = useState<'emergency' | 'birth' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  const stopHold = () => {
    if (timerRef.current) {clearInterval(timerRef.current);timerRef.current = null;}
    setHoldType(null);
    setProgress(0);
  };

  useEffect(() => {
    if (!open) {setSent(null);stopHold();}
    return stopHold;
  }, [open]);

  const startHold = (type: 'emergency' | 'birth') => {
    if (loading || sent) return;
    firedRef.current = false;
    setHoldType(type);
    setProgress(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(async () => {
      const pct = Math.min(100, (Date.now() - startedAt) / HOLD_MS * 100);
      setProgress(pct);
      if (pct >= 100 && !firedRef.current) {
        firedRef.current = true;
        stopHold();
        const result = await sendSOS(undefined, true, type);
        if (!result.error) setSent(type);
      }
    }, 50);
  };

  if (!hasPartner) return null;

  // PORTAL: kart transform-lu (framer-motion) valideyn içindədir — fixed overlay
  // stacking context tələsinə düşüb footer nav-ın altında qalırdı.
  return createPortal(
    <AnimatePresence>
      {open &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="a-scope fixed inset-0 z-[90] flex items-end bg-black/45"
        onClick={onClose}>

          <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full relative"
          style={{
            background: 'var(--a-surface)',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 22,
            paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 22px)'
          }}>

            <div className="absolute left-1/2 -translate-x-1/2 top-3 w-12 h-1.5 rounded-full" style={{ background: 'var(--a-line-strong)' }} />

            <div className="flex items-center justify-between mb-1 mt-2">
              <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
                {tr('partnerv2_partnyoru_cagir', 'Partnyoru çağır')}
              </h2>
              <button onClick={onClose} className="a-icon-btn" style={{ width: 32, height: 32, borderRadius: 999 }} aria-label={tr('premiummodal_bagla_84bdc9', 'Bağla')}>
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', marginBottom: 18 }}>
              {tr('partnerv2_sos_hold_hint', 'Göndərmək üçün düyməni 1.5 saniyə basılı tutun. Yeriniz avtomatik paylaşılır.')}
            </p>

            {sent ?
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-green-1)' }}>
                  <Check size={36} style={{ color: 'var(--a-green-ink)' }} strokeWidth={2.5} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--a-ink)' }}>
                  {sent === 'birth' ?
              tr('partnerv2_dogus_siqnali_gonderildi', 'Doğuş siqnalı göndərildi!') :
              tr('partnerv2_sos_gonderildi', 'SOS göndərildi!')}
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', marginTop: 4 }}>
                  {tr('partnerv2_partnyor_xeberdar_edildi', 'Partnyorunuz dərhal xəbərdar edildi. 💙')}
                </p>
              </motion.div> :

          <div className="space-y-3">
                {/* Doğuş siqnalı — yalnız hamiləlik */}
                {lifeStage === 'bump' &&
            <button
              onPointerDown={() => startHold('birth')}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              className="w-full relative overflow-hidden text-start select-none"
              style={{ borderRadius: 20, background: 'var(--a-peach-1)', border: '2px solid var(--a-peach-2)', padding: 18, touchAction: 'none' }}>
                    {holdType === 'birth' &&
              <motion.div className="absolute inset-0" style={{ background: 'rgba(255,157,99,0.35)', width: `${progress}%` }} />
              }
                    <div className="relative flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-peach-2)' }}>
                        <Baby size={22} className="text-white" />
                      </div>
                      <div>
                        <p style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--a-accent-ink)' }}>
                          {tr('partnerv2_dogus_basladi_btn', 'Doğuş başladı! 👶')}
                        </p>
                        <p style={{ fontSize: 11.5, color: 'var(--a-accent-ink)', opacity: 0.8 }}>
                          {tr('partnerv2_dogus_basladi_sub', 'Partnyor xəstəxana rejiminə keçəcək')}
                        </p>
                      </div>
                    </div>
                  </button>
            }

                {/* Təcili SOS */}
                <button
              onPointerDown={() => startHold('emergency')}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              className="w-full relative overflow-hidden text-start select-none"
              style={{ borderRadius: 20, background: 'var(--a-alert-bg)', border: '2px solid rgba(177, 39, 91, 0.35)', padding: 18, touchAction: 'none' }}>
                  {holdType === 'emergency' &&
              <motion.div className="absolute inset-0" style={{ background: 'rgba(177,39,91,0.22)', width: `${progress}%` }} />
              }
                  <div className="relative flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-pink-ink)' }}>
                      <Siren size={22} className="text-white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--a-alert-ink)' }}>
                        {tr('partnerv2_tecili_sos_btn', 'Təcili kömək — SOS 🚨')}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--a-alert-soft)' }}>
                        {tr('partnerv2_tecili_sos_sub', 'Yeriniz və xəbərdarlıq dərhal çatır')}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>,
    document.body);

};

export default MotherSOSSheet;
