import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { CheckCircle, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderSuccessScreenProps {
  onContinue: () => void;
}

const OrderSuccessScreen = ({ onContinue }: OrderSuccessScreenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="a-scope min-h-screen flex flex-col items-center justify-center p-6 text-center relative"
      style={{ background: 'var(--a-bg)' }}>

      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6 relative z-10"
        style={{ background: 'var(--a-green-1)', boxShadow: '0 20px 40px -16px rgba(99, 189, 139, 0.5)' }}>

        <CheckCircle size={52} style={{ color: 'var(--a-green-ink)' }} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-2 relative z-10"
        style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>
        {tr("ordersuccessscreen_sifarisiniz_qebul_edildi_3ef5d9", "Sifari\u015Finiz Q\u0259bul Edildi! \uD83C\uDF89")}

      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8 max-w-sm relative z-10"
        style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}>
        {tr("ordersuccessscreen_sifarisiniz_ugurla_yaradildi_t_608073", "Sifari\u015Finiz u\u011Furla yarad\u0131ld\u0131. Tezlikl\u0259 sizinl\u0259 \u0259laq\u0259 saxlan\u0131lacaq.")}

      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="a-card w-full max-w-sm mb-8 relative z-10">

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-peach-1)' }}>
            <Package size={22} style={{ color: 'var(--a-accent-ink)' }} />
          </div>
          <div className="text-start">
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("ordersuccessscreen_catdirilma_muddeti_07869a", "Çatdırılma Müddəti")}</p>
            <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>{tr("ordersuccessscreen_1_3_is_gunu_6b7ab5", "1-3 iş günü")}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10">

        <Button onClick={onContinue} size="lg"
        className="gap-2 rounded-full text-white border-0 hover:opacity-95"
        style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
          {tr("ordersuccessscreen_alis_verise_davam_et_8cd3a3", "Al\u0131\u015F-veri\u015F\u0259 Davam Et")}
          <ArrowRight className="rtl:rotate-180 w-4 h-4" />
        </Button>
      </motion.div>
    </motion.div>);

};

export default OrderSuccessScreen;
