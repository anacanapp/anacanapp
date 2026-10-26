import { tr } from "@/lib/tr";import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaymentError = () => {
  const navigate = useNavigate();

  return (
    <div className="a-scope min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="a-card max-w-md w-full text-center relative z-10"
        style={{ padding: 32 }}>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--a-alert-bg)' }}>

          <XCircle size={38} style={{ color: 'var(--a-alert-ink)' }} />
        </motion.div>

        <h1 className="mb-2" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
          {tr("paymenterror_odenis_ugursuz_585482", "\xD6d\u0259ni\u015F U\u011Fursuz")}
        </h1>
        <p className="mb-8" style={{ fontSize: 13.5, color: 'var(--a-ink-soft)' }}>
          {tr("paymenterror_odenisiniz_heyata_kecirile_bil_31b720", "\xD6d\u0259ni\u015Finiz h\u0259yata ke\xE7iril\u0259 bilm\u0259di. Z\u0259hm\u0259t olmasa yenid\u0259n c\u0259hd edin v\u0259 ya dig\u0259r \xF6d\u0259ni\u015F \xFCsulundan istifad\u0259 edin.")}
        </p>

        <div className="space-y-3">
          <Button onClick={() => navigate(-1)}
          className="w-full gap-2 rounded-full text-white border-0 hover:opacity-95"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
            <RefreshCw className="w-4 h-4" />
            {tr("paymenterror_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}
          className="w-full gap-2 rounded-full"
          style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}>
            <ArrowLeft className="rtl:rotate-180 w-4 h-4" />
            {tr("paymenterror_ana_sehifeye_qayit_2458e3", "Ana S\u0259hif\u0259y\u0259 Qay\u0131t")}
          </Button>
        </div>
      </motion.div>
    </div>);

};

export default PaymentError;
