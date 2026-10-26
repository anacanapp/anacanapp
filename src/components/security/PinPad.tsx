import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, Fingerprint } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { PIN_LENGTH } from '@/lib/appLock';

/**
 * Paylaşılan PIN klaviaturası — kilid ekranı və quraşdırma sheet-i üçün.
 * 4 nöqtə + 3×4 numpad, xəta zamanı silkələnmə.
 */

interface PinPadProps {
  /** PIN tam yığılanda çağırılır; false qaytarsa xəta animasiyası göstərilir. */
  onComplete: (pin: string) => Promise<boolean> | boolean;
  /** Biometrika düyməsi göstərilsin? */
  showBiometric?: boolean;
  onBiometric?: () => void;
  /** Xarici reset trigger-i (məs. addım dəyişəndə) */
  resetKey?: string | number;
  disabled?: boolean;
}

const PinPad = ({ onComplete, showBiometric = false, onBiometric, resetKey, disabled = false }: PinPadProps) => {
  const [pin, setPinState] = useState('');
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPinState('');
  }, [resetKey]);

  const pushDigit = async (d: string) => {
    if (busy || disabled || pin.length >= PIN_LENGTH) return;
    await hapticFeedback.light();
    const next = pin + d;
    setPinState(next);

    if (next.length === PIN_LENGTH) {
      setBusy(true);
      const ok = await onComplete(next);
      if (!ok) {
        await hapticFeedback.heavy();
        setShake((s) => s + 1);
        setTimeout(() => setPinState(''), 320);
      }
      setBusy(false);
    }
  };

  const backspace = async () => {
    if (busy || disabled) return;
    await hapticFeedback.light();
    setPinState((p) => p.slice(0, -1));
  };

  const keys: (string | 'bio' | 'back')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', showBiometric ? 'bio' : '', '0', 'back'];

  return (
    <div className="w-full max-w-[280px] mx-auto">
      {/* Nöqtələr */}
      <motion.div
        key={shake}
        animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center gap-4 mb-9">

        {Array.from({ length: PIN_LENGTH }).map((_, i) =>
        <motion.span
          key={i}
          animate={{ scale: i === pin.length - 1 ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.18 }}
          className="rounded-full"
          style={{
            width: 16,
            height: 16,
            background: i < pin.length ? 'var(--a-peach-2)' : 'transparent',
            border: i < pin.length ? 'none' : '2px solid var(--a-ink-faint)',
            transition: 'background 0.15s'
          }} />

        )}
      </motion.div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k, idx) => {
          if (k === '') return <span key={idx} />;
          if (k === 'bio') {
            return (
              <motion.button
                key={idx}
                onClick={onBiometric}
                className="flex items-center justify-center mx-auto"
                style={{ width: 68, height: 68, borderRadius: 999, color: 'var(--a-accent-ink)' }}
                whileTap={{ scale: 0.9 }}
                aria-label="Biometric">
                <Fingerprint size={28} strokeWidth={1.8} />
              </motion.button>);
          }
          if (k === 'back') {
            return (
              <motion.button
                key={idx}
                onClick={backspace}
                className="flex items-center justify-center mx-auto"
                style={{ width: 68, height: 68, borderRadius: 999, color: 'var(--a-ink-soft)' }}
                whileTap={{ scale: 0.9 }}
                aria-label="Backspace">
                <Delete size={24} strokeWidth={1.8} />
              </motion.button>);
          }
          return (
            <motion.button
              key={idx}
              onClick={() => pushDigit(k)}
              className="flex items-center justify-center mx-auto select-none"
              style={{
                width: 68,
                height: 68,
                borderRadius: 999,
                background: 'var(--a-surface)',
                boxShadow: '0 6px 14px -8px rgba(217, 108, 74, 0.35)',
                border: '1px solid var(--a-btn-border)',
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--a-ink)'
              }}
              whileTap={{ scale: 0.9, background: 'var(--a-peach-1)' } as any}>
              {k}
            </motion.button>);
        })}
      </div>
    </div>);

};

export default PinPad;
