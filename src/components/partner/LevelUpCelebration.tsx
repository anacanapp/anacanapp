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

      const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

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

  return (
    <AnimatePresence>
      {isVisible &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}>
        
          <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 180 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="bg-[color:var(--a-coral-strong)] rounded-[28px] p-8 mx-6 text-center relative overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}>
          
            {/* Decorative elements */}
            <div className="absolute -top-10 -start-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -end-10 w-40 h-40 rounded-full bg-[color:var(--a-pink-1)] blur-3xl" />
            
            {/* Floating stars */}
            <motion.div
            className="absolute top-4 start-4"
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: 2 }}>
            
              <Star className="w-6 h-6 text-[color:var(--a-yellow-ink)] fill-[color:var(--a-yellow-2)]" />
            </motion.div>
            <motion.div
            className="absolute top-6 end-6"
            animate={{ y: [0, -8, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 1.5, repeat: 2, delay: 0.3 }}>
            
              <Sparkles className="w-5 h-5 text-[color:var(--a-pink-2)]" />
            </motion.div>
            <motion.div
            className="absolute bottom-8 start-8"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.8, repeat: 2, delay: 0.5 }}>
            
              <Star className="w-4 h-4 text-[color:var(--a-yellow-2)] fill-[color:var(--a-yellow-2)]" />
            </motion.div>

            <div className="relative z-10">
              {/* Trophy icon */}
              <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-24 h-24 mx-auto mb-4 rounded-full bg-[color:var(--a-coral-strong)] flex items-center justify-center shadow-lg">
              
                <Trophy className="w-12 h-12 text-white" />
              </motion.div>

              {/* Text content */}
              <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}>
              
                <h2 className="text-white text-2xl font-black mb-2">
                  {tr("levelupcelebration_tebrik_edirik_283dfe", "T\u0259brik Edirik! \uD83C\uDF89")}
                </h2>
                <p className="text-white/80 text-lg mb-4">
                  {tr("levelupcelebration_yeni_seviyyeye_kecdiniz_72af13", "Yeni s\u0259viyy\u0259y\u0259 ke\xE7diniz!")}
                </p>
              </motion.div>

              {/* Level badge */}
              <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', damping: 10 }}
              className="inline-flex items-center gap-3 bg-white/25 rounded-2xl px-6 py-4 mb-4">
              
                <div className="w-16 h-16 rounded-full bg-[color:var(--a-coral-strong)] flex items-center justify-center shadow-md">
                  <span className="text-white font-black text-2xl">{level}</span>
                </div>
                <div className="text-start">
                  <p className="text-white/70 text-sm">{tr("levelupcelebration_seviyye_8266e7", "Səviyyə")}</p>
                  <p className="text-white font-bold text-xl">Level {level}</p>
                </div>
              </motion.div>

              <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-white/60 text-sm">
                {tr("levelupcelebration_davam_et_ela_gedirsen_326f52", "Davam et, \u0259la gedirs\u0259n! \uD83D\uDCAA")}
              
            </motion.p>

              <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              className="mt-4 px-8 py-3 bg-white text-partner font-bold rounded-xl hover:bg-white/90 transition-colors">{tr("untranslated_davam_et_rchhd5", "Davam et")}</motion.button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

};

export default LevelUpCelebration;