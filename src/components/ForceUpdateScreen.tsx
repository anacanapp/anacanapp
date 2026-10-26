import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { Shield, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import logoImage from '@/assets/brand-mark.png';

interface ForceUpdateScreenProps {
  title: string;
  message: string;
  androidUrl: string;
  iosUrl: string;
}

const ForceUpdateScreen = ({ title, message, androidUrl, iosUrl }: ForceUpdateScreenProps) => {
  const handleUpdate = () => {
    const platform = Capacitor.getPlatform();
    const url = platform === 'ios' ? iosUrl : androidUrl;
    window.open(url, '_system');
  };

  return (
    <motion.div
      className="a-scope fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: 'var(--a-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>

      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <div className="flex flex-col items-center text-center max-w-sm relative z-10">
        <motion.img
          src={logoImage}
          alt="Anacan"
          className="w-20 h-20 object-contain mb-6"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }} />


        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--a-peach-1)' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}>

          <ArrowUpCircle size={30} style={{ color: 'var(--a-accent-ink)' }} />
        </motion.div>

        <motion.h1
          className="mb-3"
          style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}>

          {title}
        </motion.h1>

        <motion.p
          className="leading-relaxed mb-8"
          style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}>

          {message}
        </motion.p>

        <motion.div
          className="w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}>

          <Button onClick={handleUpdate} size="lg"
          className="w-full rounded-full text-base font-semibold h-14 text-white border-0 hover:opacity-95"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}>
            <Shield className="w-5 h-5 me-2" />
            {tr("forceupdatescreen_tetbiqi_yenile_18f4f3", "T\u0259tbiqi yenil\u0259")}
          </Button>
        </motion.div>
      </div>
    </motion.div>);

};

export default ForceUpdateScreen;
