import { useEffect, useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LevelUpCelebrationProps {
  show: boolean;
  level: number;
  onClose: () => void;
}

const LevelUpCelebration = ({ show, level, onClose }: LevelUpCelebrationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);

      // Fire confetti from multiple angles
      const duration = 3000;
      const end = Date.now() + duration;

      // Anacan palette: coral, peach, warm yellow, soft green.
      const colors = ['#FF5A5F', '#FFB4A2', '#FFD166', '#7FD1AE', '#FFDCDD'];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: colors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      // Initial burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: colors
      });

      frame();

      // Auto close after 4 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const close = () => { setIsVisible(false); setTimeout(onClose, 300); };

  // Anacan style: white card, peach header band, coral action (no violet gradient).
  return (
    <AnimatePresence>
      {isVisible &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="a-scope fixed inset-0 z-[100] flex items-center justify-center px-6"
        style={{ background: 'rgba(20, 16, 18, 0.55)' }}
        onClick={close}>
          <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 240 }}
          role="dialog" aria-modal="true"
          className="w-full max-w-[340px] overflow-hidden text-center"
          style={{ background: 'var(--a-surface)', borderRadius: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          onClick={(e) => e.stopPropagation()}>
            <div className="relative" style={{ background: 'var(--a-grad-peach)', padding: '28px 24px 22px' }}>
              <motion.div
              initial={{ y: -16, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 12 }}
              className="mx-auto flex items-center justify-center"
              style={{ width: 84, height: 84, borderRadius: 999, background: 'var(--a-surface)', boxShadow: '0 8px 24px rgba(255, 90, 95, 0.25)' }}>
                <Trophy size={40} style={{ color: 'var(--a-coral)' }} />
              </motion.div>
              <motion.span
              aria-hidden
              className="absolute"
              style={{ top: 18, insetInlineStart: 22 }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.8, repeat: 2 }}>
                <Sparkles size={18} style={{ color: 'var(--a-coral)' }} />
              </motion.span>
              <motion.span
              aria-hidden
              className="absolute"
              style={{ top: 26, insetInlineEnd: 26 }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.6, repeat: 2, delay: 0.3 }}>
                <Star size={16} style={{ color: 'var(--a-yellow-ink, #b7791f)', fill: 'var(--a-yellow-1, #fff2c8)' }} />
              </motion.span>
            </div>

            <div style={{ padding: '18px 24px 22px' }}>
              <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                <h2 style={{ fontSize: 21, fontWeight: 900, color: 'var(--a-ink)', letterSpacing: '-0.01em' }}>
                  {tr("levelupcelebration_tebrik_edirik_283dfe", "T\u0259brik Edirik! \uD83C\uDF89")}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--a-ink-soft)', marginTop: 4 }}>
                  {tr("levelupcelebration_yeni_seviyyeye_kecdiniz_72af13", "Yeni s\u0259viyy\u0259y\u0259 ke\xE7diniz!")}
                </p>
              </motion.div>

              <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.45, type: 'spring', damping: 12 }}
              className="inline-flex items-center gap-3"
              style={{ marginTop: 16, background: 'var(--a-peach-1)', borderRadius: 18, padding: '10px 16px' }}>
                <span className="flex items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--a-coral)', color: 'var(--a-on-coral, #fff)', fontWeight: 900, fontSize: 20 }}>
                  {level}
                </span>
                <span className="text-start">
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--a-accent-ink)' }}>
                    {tr("levelupcelebration_seviyye_8266e7", "Səviyyə")}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--a-ink)' }}>
                    {tr("levelupcelebration_davam_et_ela_gedirsen_326f52", "Davam et, \u0259la gedirs\u0259n! \uD83D\uDCAA")}
                  </span>
                </span>
              </motion.div>

              <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileTap={{ scale: 0.97 }}
              onClick={close}
              className="w-full"
              style={{ marginTop: 18, background: 'var(--a-coral)', color: 'var(--a-on-coral, #fff)', fontWeight: 800, fontSize: 15, borderRadius: 16, padding: '13px 16px' }}>
                {tr("untranslated_davam_et_rchhd5", "Davam et")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

};

export default LevelUpCelebration;