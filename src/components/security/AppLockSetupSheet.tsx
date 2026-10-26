import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Fingerprint, KeyRound, ShieldOff, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import PinPad from './PinPad';
import {
  isLockEnabled, setPin, verifyPin, disableLock,
  isBiometricAvailable, isBiometricPrefEnabled, setBiometricPref, verifyBiometric } from
'@/lib/appLock';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';

/**
 * Kilid quraşdırma / idarəetmə sheet-i (SettingsScreen-dən açılır).
 * Aktiv deyil → PIN yarat → təsdiqlə → (biometrika təklifi) → hazır.
 * Aktivdir  → idarə: biometrika toggle · PIN dəyiş · kilidi söndür.
 */

type Step =
'menu' // aktiv olduqda idarəetmə menyusu
| 'create' // yeni PIN
| 'confirm' // yeni PIN təkrar
| 'verify-change' // dəyişmək üçün köhnə PIN
| 'verify-disable' // söndürmək üçün PIN
| 'bio-offer' // biometrika təklifi
| 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const AppLockSetupSheet = ({ open, onClose, onChanged }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('create');
  const [firstPin, setFirstPin] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(isLockEnabled() ? 'menu' : 'create');
      setFirstPin('');
      setMismatch(false);
      setBioEnabled(isBiometricPrefEnabled());
      isBiometricAvailable().then(setBioAvailable);
    }
  }, [open]);

  const finish = () => {
    onChanged?.();
    onClose();
  };

  const handleCreate = (pin: string): boolean => {
    setFirstPin(pin);
    setMismatch(false);
    setStep('confirm');
    return true;
  };

  const handleConfirm = async (pin: string): Promise<boolean> => {
    if (pin !== firstPin) {
      setMismatch(true);
      setStep('create');
      setFirstPin('');
      return true; // pad öz xəta animasiyasını yox, addım geri qayıdır
    }
    await setPin(pin);
    toast({ title: tr('applock_enabled_toast', 'Kilid aktivləşdirildi 🔒') });
    if (bioAvailable) {
      setStep('bio-offer');
    } else {
      finish();
    }
    return true;
  };

  const handleVerifyChange = async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin);
    if (!ok) return false;
    setFirstPin('');
    setStep('create');
    return true;
  };

  const handleVerifyDisable = async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin);
    if (!ok) return false;
    disableLock();
    toast({ title: tr('applock_disabled_toast', 'Kilid söndürüldü') });
    finish();
    return true;
  };

  const handleBioToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await verifyBiometric(
        tr('applock_bio_reason', 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin'),
        tr('applock_bio_title', 'Anacan kilidi')
      );
      if (!ok) return;
    }
    setBiometricPref(checked);
    setBioEnabled(checked);
  };

  const stepTitle: Record<Step, string> = {
    menu: tr('applock_manage_title', 'Tətbiq kilidi'),
    create: tr('applock_create_title', 'Yeni PIN təyin edin'),
    confirm: tr('applock_confirm_title', 'PIN-i təkrar daxil edin'),
    'verify-change': tr('applock_verify_title', 'Cari PIN-i daxil edin'),
    'verify-disable': tr('applock_verify_title', 'Cari PIN-i daxil edin'),
    'bio-offer': tr('applock_bio_offer_title', 'Biometrika ilə açılsın?'),
    done: ''
  };

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="a-scope fixed inset-0 z-[120] flex items-end bg-black/45"
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
            paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 22px)',
            minHeight: 380
          }}>

            <div className="absolute left-1/2 -translate-x-1/2 top-3 w-12 h-1.5 rounded-full" style={{ background: 'var(--a-line-strong)' }} />

            <div className="flex items-center justify-between mb-1 mt-2">
              <h2 style={{ fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
                {stepTitle[step]}
              </h2>
              <button onClick={onClose} className="a-icon-btn" style={{ width: 32, height: 32, borderRadius: 999 }} aria-label={tr('premiummodal_bagla_84bdc9', 'Bağla')}>
                <X size={14} />
              </button>
            </div>

            {/* ── İdarəetmə menyusu ── */}
            {step === 'menu' &&
          <div className="space-y-2.5 mt-4">
                {bioAvailable &&
            <div className="flex items-center gap-3" style={{ padding: '13px 14px', borderRadius: 16, background: 'var(--a-surface-soft)' }}>
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-lav-1)' }}>
                      <Fingerprint size={17} style={{ color: 'var(--a-lav-ink)' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr('applock_bio_row', 'Biometrika ilə aç')}</p>
                      <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr('applock_bio_row_sub', 'Face ID / barmaq izi')}</p>
                    </div>
                    <Switch className="data-[state=checked]:bg-[var(--a-peach-2)]" checked={bioEnabled} onCheckedChange={handleBioToggle} />
                  </div>
            }

                <motion.button
              onClick={() => setStep('verify-change')}
              className="w-full flex items-center gap-3 text-start"
              style={{ padding: '13px 14px', borderRadius: 16, background: 'var(--a-surface-soft)' }}
              whileTap={{ scale: 0.98 }}>
                  <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-blue-1)' }}>
                    <KeyRound size={17} style={{ color: 'var(--a-blue-ink)' }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr('applock_change_pin', 'PIN-i dəyiş')}</p>
                  </div>
                </motion.button>

                <motion.button
              onClick={() => setStep('verify-disable')}
              className="w-full flex items-center gap-3 text-start"
              style={{ padding: '13px 14px', borderRadius: 16, background: 'var(--a-alert-bg)' }}
              whileTap={{ scale: 0.98 }}>
                  <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-chip-overlay)' }}>
                    <ShieldOff size={17} style={{ color: 'var(--a-alert-ink)' }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-alert-ink)' }}>{tr('applock_disable', 'Kilidi söndür')}</p>
                  </div>
                </motion.button>
              </div>
          }

            {/* ── PIN addımları ── */}
            {(step === 'create' || step === 'confirm' || step === 'verify-change' || step === 'verify-disable') &&
          <div className="mt-5">
                {mismatch && step === 'create' &&
            <p className="text-center mb-3" style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-alert-ink)' }}>
                    {tr('applock_mismatch', 'PIN-lər uyğun gəlmədi — yenidən cəhd edin')}
                  </p>
            }
                <PinPad
              resetKey={step + String(mismatch)}
              onComplete={
              step === 'create' ? handleCreate :
              step === 'confirm' ? handleConfirm :
              step === 'verify-change' ? handleVerifyChange :
              handleVerifyDisable
              } />

              </div>
          }

            {/* ── Biometrika təklifi ── */}
            {step === 'bio-offer' &&
          <div className="flex flex-col items-center mt-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--a-lav-1)' }}>
                  <Fingerprint size={36} style={{ color: 'var(--a-lav-ink)' }} />
                </div>
                <p className="text-center mb-6 max-w-[260px]" style={{ fontSize: 13, color: 'var(--a-ink-soft)', lineHeight: 1.5 }}>
                  {tr('applock_bio_offer_desc', 'PIN əvəzinə Face ID / barmaq izi ilə daha sürətli açın.')}
                </p>
                <div className="w-full space-y-2.5">
                  <button
                onClick={async () => {await handleBioToggle(true);finish();}}
                className="w-full flex items-center justify-center gap-2 text-white"
                style={{ height: 50, borderRadius: 999, background: 'var(--a-peach-2)', fontSize: 14, fontWeight: 700, boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
                    <Check size={17} />
                    {tr('applock_bio_offer_yes', 'Bəli, aktivləşdir')}
                  </button>
                  <button
                onClick={finish}
                className="w-full"
                style={{ height: 46, borderRadius: 999, background: 'var(--a-surface-soft)', fontSize: 13, fontWeight: 600, color: 'var(--a-ink-soft)' }}>
                    {tr('applock_bio_offer_no', 'İndi yox')}
                  </button>
                </div>
              </div>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

};

export default AppLockSetupSheet;
