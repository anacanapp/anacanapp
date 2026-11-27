import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Apple, ChevronRight, Copy, Gift, HeartHandshake, Link2, Loader2, Lock, Share2, Check } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { useUserStore } from '@/store/userStore';
import { useSponsorText } from '@/data/sponsor';
import { fill } from '@/lib/feature-text';
import { hapticFeedback } from '@/lib/native';
import { createSponsorLink, type SponsorKind, type SponsorRelation } from '@/lib/premium-sponsor';
import '@/styles/care.css';

type Step = 'menu' | 'family' | 'compose';

/**
 * "Who pays for Premium?" — self (store), spouse (partner-mode invite) or a family member (plain payment
 * request). For spouse/family it mints a shareable anacan.az/p/<token> link and a prefilled, editable
 * message. The account and all data stay with the user; the payer only pays.
 */
export default function SponsorSheet({ open, onClose, onSelf }: { open: boolean; onClose: () => void; onSelf: () => void }) {
  const language = useUserStore((s) => s.language);
  const t = useSponsorText(language);
  const [step, setStep] = useState<Step>('menu');
  const [partnerOffer, setPartnerOffer] = useState(true);
  const [relation, setRelation] = useState<SponsorRelation | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null);

  useEffect(() => {
    if (open) { setStep('menu'); setPartnerOffer(true); setRelation(null); setLink(null); setErr(false); setMessage(''); setCopied(null); }
  }, [open]);

  if (!t) return null;

  const template = (url: string, partner: boolean) => fill(partner ? t.msg_partner : t.msg_gift, { link: url });

  const generate = async (kind: SponsorKind, rel: SponsorRelation | null, partner: boolean) => {
    setLoading(true); setErr(false);
    try {
      const made = await createSponsorLink(kind, rel, language);
      setLink(made.url);
      setMessage(template(made.url, partner));
    } catch { setErr(true); }
    setLoading(false);
  };

  const pickSpouse = () => { void hapticFeedback.light(); setRelation('spouse'); setPartnerOffer(true); setStep('compose'); void generate('partner', 'spouse', true); };
  const pickFamily = () => { void hapticFeedback.light(); setStep('family'); };
  const pickRelation = (rel: SponsorRelation) => { void hapticFeedback.light(); setRelation(rel); setPartnerOffer(false); setStep('compose'); void generate('gift', rel, false); };

  const togglePartner = (next: boolean) => {
    setPartnerOffer(next);
    void generate(next ? 'partner' : 'gift', relation, next);
  };

  const copy = async (what: 'link' | 'msg') => {
    const value = what === 'link' ? link : message;
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(what); void hapticFeedback.light(); window.setTimeout(() => setCopied(null), 1800); } catch { /* ignore */ }
  };

  const share = async () => {
    if (!message) return;
    try { const { Share } = await import('@capacitor/share'); await Share.share({ text: message }); }
    catch { void copy('msg'); }
  };

  const privacy = (
    <div className="cx-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, background: 'var(--a-surface-soft)', border: 0 }}>
      <div className="cx-icon" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}><Lock size={16} /></div>
      <div style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 13, color: 'var(--a-ink)' }}>{t.privacy_title}</b>
        <span className="cx-sub" style={{ fontSize: 12 }}>{t.privacy_body}</span>
      </div>
    </div>
  );

  const Option = ({ icon, bg, fg, title, sub, onClick }: { icon: React.ReactNode; bg: string; fg: string; title: string; sub: string; onClick: () => void }) => (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick} className="cx-link" style={{ borderRadius: 18, border: '1px solid var(--a-line)', background: 'var(--a-surface)', padding: '14px 16px' }}>
      <div className="cx-icon" style={{ background: bg, color: fg }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14.5, color: 'var(--a-ink)' }}>{title}</b>
        <span className="cx-sub" style={{ fontSize: 12.5 }}>{sub}</span>
      </div>
      <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
    </motion.button>
  );

  const title = step === 'family' ? t.relation_title : step === 'compose' ? t.compose_title : t.title;
  const onBack = step === 'menu' ? undefined : () => setStep(step === 'compose' && relation && relation !== 'spouse' ? 'family' : 'menu');

  return (
    <Sheet open={open} onClose={onClose} full={false} title={title} onBack={onBack}>
      {step === 'menu' && (
        <div className="cx-stack">
          <p className="cx-sub" style={{ textAlign: 'center', marginTop: -4 }}>{t.reassure}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <Option icon={<Apple size={20} />} bg="var(--a-surface-soft)" fg="var(--a-ink)" title={t.self_title} sub={t.self_sub} onClick={() => { onClose(); onSelf(); }} />
            <Option icon={<HeartHandshake size={20} />} bg="var(--a-pink-1)" fg="var(--a-berry-ink)" title={t.spouse_title} sub={t.spouse_sub} onClick={pickSpouse} />
            <Option icon={<Gift size={20} />} bg="var(--a-lav-1)" fg="var(--a-lav-ink)" title={t.family_title} sub={t.family_sub} onClick={pickFamily} />
          </div>
          {privacy}
        </div>
      )}

      {step === 'family' && (
        <div className="cx-stack">
          <div style={{ display: 'grid', gap: 8 }}>
            {(['mother', 'father', 'sibling', 'other'] as const).map((rel) => (
              <motion.button key={rel} type="button" whileTap={{ scale: 0.98 }} onClick={() => pickRelation(rel)} className="cx-link" style={{ borderRadius: 16, border: '1px solid var(--a-line)', background: 'var(--a-surface)', padding: '14px 16px' }}>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--a-ink)' }}>
                  {rel === 'mother' ? t.rel_mother : rel === 'father' ? t.rel_father : rel === 'sibling' ? t.rel_sibling : t.rel_other}
                </span>
                <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
              </motion.button>
            ))}
          </div>
          {privacy}
        </div>
      )}

      {step === 'compose' && (
        <div className="cx-stack">
          <p className="cx-sub" style={{ textAlign: 'center', marginTop: -4 }}>{t.compose_sub}</p>

          {relation === 'spouse' && (
            <label className="cx-row" style={{ gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--a-surface-soft)', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: 'var(--a-ink)' }}>{t.partner_toggle}</b>
                <span className="cx-sub" style={{ fontSize: 11.5 }}>{t.partner_toggle_sub}</span>
              </div>
              <input type="checkbox" checked={partnerOffer} onChange={(e) => togglePartner(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--a-peach-2)' }} />
            </label>
          )}

          {loading ? (
            <div className="cx-row" style={{ justifyContent: 'center', padding: '24px 0', gap: 8, color: 'var(--a-ink-soft)' }}>
              <Loader2 size={16} className="animate-spin" /><span style={{ fontSize: 13 }}>{t.generating}</span>
            </div>
          ) : err ? (
            <div className="cx-alert">{t.error}</div>
          ) : (
            <>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                className="cx-input" style={{ minHeight: 120, padding: 12, lineHeight: 1.5, resize: 'vertical' }} aria-label={t.compose_title} />

              <div>
                <span className="cx-field">{t.link_label}</span>
                <div className="cx-row" style={{ gap: 8 }}>
                  <input readOnly value={link ?? ''} className="cx-input" style={{ flex: 1, fontSize: 13 }} onFocus={(e) => e.currentTarget.select()} aria-label={t.link_label} />
                  <button type="button" className="a3-btn ghost" style={{ paddingInline: 14, whiteSpace: 'nowrap' }} onClick={() => void copy('link')}>
                    {copied === 'link' ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <p className="cx-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}><Link2 size={13} />{t.valid_7}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" className="a3-btn ghost" onClick={() => void copy('msg')}>
                  {copied === 'msg' ? t.copied : t.copy_msg}
                </button>
                <button type="button" className="a3-btn accent cx-wide" onClick={() => void share()}>
                  <Share2 size={15} style={{ marginInlineEnd: 6 }} />{t.share}
                </button>
              </div>

              {privacy}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
