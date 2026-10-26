import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut } from 'lucide-react';
import PinPad from './PinPad';
import {
  verifyPin, verifyBiometric,
  isBiometricPrefEnabled, isBiometricAvailable,
  disableLock, clearBackgroundMark } from
'@/lib/appLock';
import { useAuth } from '@/hooks/useAuth';
import logoImage from '@/assets/brand-mark.png';
import { tr } from '@/lib/tr';

/**
 * Tam-ekran kilid — tətbiq açılanda / arxa fondan qayıdanda.
 * PIN + (mövcuddursa) biometrika. "Unutdum" → hesabdan çıxış + kilid sıfırlanır.
 */

interface Props {
  onUnlock: () => void;
}

const MAX_ATTEMPTS_BEFORE_HINT = 3;

const AppLockScreen = ({ onUnlock }: Props) => {
  const { signOut, user } = useAuth();
  const [bioReady, setBioReady] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [confirmForgot, setConfirmForgot] = useState(false);
  const bioTriedRef = useRef(false);

  const unlock = () => {
    clearBackgroundMark();
    onUnlock();
  };

  // Biometrika mövcudluğu + avtomatik cəhd (bir dəfə)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isBiometricPrefEnabled()) return;
      const available = await isBiometricAvailable();
      if (cancelled || !available) return;
      setBioReady(true);
      if (!bioTriedRef.current) {
        bioTriedRef.current = true;
        const ok = await verifyBiometric(
          tr('applock_bio_reason', 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin'),
          tr('applock_bio_title', 'Anacan kilidi')
        );
        if (!cancelled && ok) unlock();
      }
    })();
    return () => {cancelled = true;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePin = async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin);
    if (ok) {
      unlock();
      return true;
    }
    setAttempts((a) => a + 1);
    return false;
  };

  const handleBiometric = async () => {
    const ok = await verifyBiometric(
      tr('applock_bio_reason', 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin'),
      tr('applock_bio_title', 'Anacan kilidi')
    );
    if (ok) unlock();
  };

  const handleForgot = async () => {
    // Təhlükəsiz çıxış yolu: hesabdan çıx + kilidi sıfırla
    disableLock();
    try {
      await signOut();
    } catch {/* boş */}
    window.location.reload();
  };

  return (
    <div
      className="a-scope fixed inset-0 z-[400] flex flex-col items-center justify-center px-6" data-ad-block="true"
      style={{
        background: 'var(--a-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)'
      }}>

      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" /><span className="a-cloud c2" /><span className="a-cloud c3" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Brend + kilid */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="relative mb-5">
          <div className="w-16 h-16 flex items-center justify-center overflow-hidden"
          style={{ borderRadius: 20, background: 'var(--a-grad-peach)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.5)' }}>
            <img src={logoImage} alt="Anacan" className="w-10 h-10 object-contain" />
          </div>
          <div className="absolute -bottom-1.5 -end-1.5 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)' }}>
            <Lock size={13} style={{ color: 'var(--a-accent-ink)' }} />
          </div>
        </motion.div>

        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
          {tr('applock_title', 'Tətbiq kilidlidir')}
        </h1>
        <p className="mb-8" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', marginTop: 4 }}>
          {tr('applock_subtitle', 'Davam etmək üçün PIN daxil edin')}
        </p>

        <PinPad
          onComplete={handlePin}
          showBiometric={bioReady}
          onBiometric={handleBiometric} />

        {/* Unutdum */}
        <div className="mt-8 text-center" style={{ minHeight: 44 }}>
          {attempts >= MAX_ATTEMPTS_BEFORE_HINT && !confirmForgot &&
          <button
            onClick={() => setConfirmForgot(true)}
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>
              {tr('applock_forgot', 'PIN-i unutmusunuz?')}
            </button>
          }
          {confirmForgot &&
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2">
              <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', maxWidth: 260 }}>
                {tr('applock_forgot_desc', 'Kilid sıfırlanacaq və hesabdan çıxacaqsınız. Yenidən daxil olduqdan sonra PIN təyin edə bilərsiniz.')}
              </p>
              <button
              onClick={handleForgot}
              className="inline-flex items-center gap-1.5"
              style={{ background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', borderRadius: 999, padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }}>
                <LogOut size={14} />
                {user ? tr('applock_signout_reset', 'Çıxış et və kilidi sıfırla') : tr('applock_reset', 'Kilidi sıfırla')}
              </button>
            </motion.div>
          }
        </div>
      </div>
    </div>);

};

export default AppLockScreen;
