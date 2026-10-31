import { useState } from 'react';
import { AlertTriangle, Check, Phone, Stethoscope } from 'lucide-react';
import { emergencyNumber, type PregnancyLossText } from '@/data/pregnancy-loss';

/**
 * Body and mood check after a pregnancy loss (the mother for herself, or the partner for her). Not a
 * diagnosis: urgent signs lead to the local emergency number, the others to a doctor visit soon.
 */
const LossSignsChecker = ({ text, forPartner = false }: { text: PregnancyLossText; forPartner?: boolean }) => {
  const t = text.ui;
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (sign: string) => setPicked((list) => list.includes(sign) ? list.filter((s) => s !== sign) : [...list, sign]);
  const urgent = picked.some((s) => text.signs.urgent.includes(s));
  const emergency = emergencyNumber(text);

  const group = (title: string, signs: string[], tone: 'urgent' | 'soon') => (
    <div>
      <p className="loss-tag" style={{ color: tone === 'urgent' ? 'var(--a-alert-ink)' : 'var(--loss-accent-ink)', margin: '4px 2px 8px' }}>{title}</p>
      <div className="space-y-2">
        {signs.map((sign) => {
          const on = picked.includes(sign);
          return (
            <button key={sign} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(sign)}
              className="flex items-center gap-3 w-full text-start"
              style={{ background: on ? (tone === 'urgent' ? 'var(--a-peach-1)' : 'var(--loss-soft)') : 'var(--a-surface)', borderRadius: 14, padding: '11px 12px',
                boxShadow: on ? 'none' : '0 6px 16px -14px rgba(120, 90, 170, 0.5)' }}>
              <span className="grid place-items-center shrink-0" style={{ width: 22, height: 22, borderRadius: 7,
                background: on ? (tone === 'urgent' ? 'var(--a-alert-ink)' : 'var(--loss-accent)') : 'transparent',
                border: on ? 0 : '1.5px solid var(--a-line-strong)' }}>
                {on && <Check size={14} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--a-ink)', fontWeight: 600 }}>{sign}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div style={{ padding: '0 4px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--a-ink)' }}>{t.signs_title}</h2>
        <p className="loss-row-sub" style={{ fontSize: 12.5 }}>{forPartner ? t.p_signs_sub : t.signs_sub}</p>
      </div>
      {group(t.signs_urgent_group, text.signs.urgent, 'urgent')}
      {group(t.signs_soon_group, text.signs.soon, 'soon')}
      <div aria-live="polite" className="flex gap-2.5" style={{ borderRadius: 16, padding: 13,
        background: urgent ? 'var(--a-alert-bg)' : picked.length ? 'var(--a-yellow-1)' : 'var(--a-green-1)',
        color: urgent ? 'var(--a-alert-ink)' : picked.length ? 'var(--a-warn-ink)' : 'var(--a-green-ink)' }}>
        {urgent ? <AlertTriangle size={17} className="shrink-0 mt-0.5" /> : picked.length ? <Stethoscope size={17} className="shrink-0 mt-0.5" /> : <Check size={17} className="shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>{urgent ? t.signs_urgent : picked.length ? t.signs_some : t.signs_none}</p>
          {urgent &&
            <a href={`tel:${emergency}`} className="inline-flex items-center gap-2" style={{ marginTop: 10, background: 'var(--a-alert-ink)', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 800 }}>
              <Phone size={15} /> {t.call} {emergency}
            </a>}
        </div>
      </div>
    </div>
  );
};

export default LossSignsChecker;
