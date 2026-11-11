import { motion } from 'framer-motion';
import { ArrowUpCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { updateText } from '@/lib/appUpdate-i18n';

interface ForceUpdateScreenProps {
  title?: string | null;
  message?: string | null;
  androidUrl: string;
  iosUrl: string;
  /** Installed version, shown under the button so support can see it in screenshots. */
  currentVersion?: string | null;
  buttonLabel?: string | null;
}

/** Full-screen forced update (cannot be dismissed). Texts come from the update rule in the user's language; any
 *  missing text uses the built-in 23-language labels. */
const ForceUpdateScreen = ({ title, message, androidUrl, iosUrl, currentVersion, buttonLabel }: ForceUpdateScreenProps) => {
  const ios = Capacitor.getPlatform() === 'ios';
  const handleUpdate = () => window.open(ios ? iosUrl : androidUrl, '_system');

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      className="a-scope fixed inset-0 z-[9999] flex flex-col items-center justify-center px-7 overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ background: 'var(--a-bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>
      <div className="flex flex-col items-center text-center max-w-sm w-full relative z-10">
        <motion.div
          className="w-[76px] h-[76px] flex items-center justify-center mb-6"
          style={{ borderRadius: 24, background: 'linear-gradient(135deg, var(--a-peach-1), #ffb9ae)' }}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220 }}>
          <ArrowUpCircle size={36} style={{ color: 'var(--a-accent-ink)' }} />
        </motion.div>
        <h1 id="force-update-title" className="mb-3 a-heading" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
          {title || updateText('required')}
        </h1>
        <p className="leading-relaxed mb-8" style={{ fontSize: 14.5, color: 'var(--a-body-text)' }}>
          {message || updateText('requiredBody')}
        </p>
        <button
          type="button"
          onClick={handleUpdate}
          className="w-full h-14 rounded-full text-white font-bold text-base border-0 active:opacity-90"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 16px 32px -12px rgba(255, 90, 95, 0.6)' }}>
          {buttonLabel || updateText('update')}
        </button>
        <p className="mt-3" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
          {ios ? 'App Store' : 'Google Play'}
          {currentVersion ? ` · ${updateText('yourVersion')}: ${currentVersion}` : ''}
        </p>
      </div>
    </motion.div>
  );
};

export default ForceUpdateScreen;
