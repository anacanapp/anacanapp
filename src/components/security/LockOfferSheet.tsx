import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Fingerprint, KeyRound, ScanFace, Settings2, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { useUserStore } from '@/store/userStore';
import { useLockOfferText } from '@/data/lock-offer';
import { fill } from '@/lib/feature-text';
import { tr } from '@/lib/tr';
import '@/styles/care.css';

/** First-run offer: protect Anacan with Face ID / fingerprint + PIN (can be turned off in Settings). */
export default function LockOfferSheet({ open, onEnable, onClose }: { open: boolean; onEnable: () => void; onClose: () => void }) {
  const language = useUserStore((s) => s.language);
  const t = useLockOfferText(language);
  if (!t) return null;
  const ios = Capacitor.getPlatform() === 'ios';
  const bio = ios ? t.bio_ios : t.bio_android;
  const rows = [
    { icon: ios ? <ScanFace size={20} /> : <Fingerprint size={20} />, bg: 'var(--a-lav-1)', fg: 'var(--a-lav-ink)', title: bio, line: t.bio_line },
    { icon: <KeyRound size={20} />, bg: 'var(--a-blue-1)', fg: 'var(--a-blue-ink)', title: t.pin_title, line: t.pin_line },
    { icon: <Settings2 size={20} />, bg: 'var(--a-surface-soft)', fg: 'var(--a-ink-soft)', title: t.settings_title, line: fill(t.settings_line, { where: `${tr('settingsscreen_tenzimlemeler_085659', 'Tənzimləmələr')} → ${tr('settingsscreen_sifre_ile_qoruma_152a0e', 'Şifrə ilə qoruma')}` }) }
  ];
  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.title}
    footer={
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, width: '100%' }}>
          <button type="button" className="a3-btn ghost" style={{ whiteSpace: "nowrap", paddingInline: 18 }} onClick={onClose}>{t.later}</button>
          <button type="button" className="a3-btn accent cx-wide" onClick={onEnable}>{t.enable}</button>
        </div>
    }>
      <div className="cx-stack">
        <div style={{ display: 'grid', placeItems: 'center', paddingTop: 4 }}>
          <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }}
          style={{ width: 84, height: 84, borderRadius: 28, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--a-peach-1, #ffe3d6), var(--a-lav-1))', boxShadow: '0 16px 30px -16px rgba(217, 108, 74, .55)' }}>
            <ShieldCheck size={40} strokeWidth={1.8} style={{ color: 'var(--a-peach-2)' }} />
          </motion.div>
        </div>
        <p className="cx-sub" style={{ textAlign: 'center' }}>{t.subtitle}</p>
        <div className="cx-card" style={{ padding: '4px 14px' }}>
          {rows.map((r, i) =>
          <motion.div key={r.title} className="cx-li" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 * (i + 1) }}
          style={{ borderTop: i ? '1px solid var(--a-line)' : 0 }}>
              <div className="cx-icon" style={{ background: r.bg, color: r.fg }}>{r.icon}</div>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 14, color: 'var(--a-ink)' }}>{r.title}</b>
                <span className="cx-sub" style={{ fontSize: 12.5 }}>{r.line}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </Sheet>);
}
