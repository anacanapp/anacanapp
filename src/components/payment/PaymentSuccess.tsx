import { tr } from "@/lib/tr";import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAzureBackend } from '@/integrations/supabase/backend-config';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // A return URL is not a payment receipt. Azure payments remain gated while
  // provider certification and order-bound return verification are completed.
  const awaitingVerification = isAzureBackend();
  const StatusIcon = awaitingVerification ? Clock : CheckCircle;

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
          style={{ background: 'var(--a-green-1)' }}>

          <StatusIcon size={38} style={{ color: awaitingVerification ? 'var(--a-blue-ink)' : 'var(--a-green-ink)' }} />
        </motion.div>

        <h1 className="mb-2" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
          {awaitingVerification ? tr('payment_confirmation_pending', 'Ödənişin təsdiqi gözlənilir') : tr("paymentsuccess_odenis_ugurlu_3d14c3", "\xD6d\u0259ni\u015F U\u011Furlu! \uD83C\uDF89")}
        </h1>
        <p className="mb-8" style={{ fontSize: 13.5, color: 'var(--a-ink-soft)' }}>
          {awaitingVerification ? tr('payment_status_needs_review', 'Ödənişin nəticəsi təsdiqlənmədi. Yenidən ödəməzdən əvvəl sifarişin vəziyyətini dəstək xidməti ilə yoxlayın.') : tr("paymentsuccess_odenisiniz_muveffeqiyyetle_hey_b90350", "\xD6d\u0259ni\u015Finiz m\xFCv\u0259ff\u0259qiyy\u0259tl\u0259 h\u0259yata ke\xE7irildi. Sifari\u015Finiz emal olunacaq.")}
        </p>

        <div className="space-y-3">
          <Button onClick={() => navigate('/')}
          className="w-full gap-2 rounded-full text-white border-0 hover:opacity-95"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
            <ArrowLeft className="rtl:rotate-180 w-4 h-4" />
            {tr("paymentsuccess_ana_sehifeye_qayit_2458e3", "Ana S\u0259hif\u0259y\u0259 Qay\u0131t")}
          </Button>
        </div>
      </motion.div>
    </div>);

};

export default PaymentSuccess;
