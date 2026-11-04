import { BarChart3, Megaphone, ShieldCheck, Target, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { PrivacyConsent } from '@/lib/privacyConsent';
import { usePrivacyText, type PrivacyCopyKey } from './privacyCopy';

export type ConsentChoice = Pick<PrivacyConsent, 'analytics' | 'ads' | 'attribution'>;
const ROWS: { key: keyof ConsentChoice; title: PrivacyCopyKey; desc: PrivacyCopyKey; icon: typeof BarChart3; bg: string; ink: string }[] = [
  { key: 'analytics', title: 'analytics_title', desc: 'analytics_desc', icon: BarChart3, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  { key: 'ads', title: 'ads_title', desc: 'ads_desc', icon: Megaphone, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  { key: 'attribution', title: 'attribution_title', desc: 'attribution_desc', icon: Target, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
];
const SWITCH_CLS = 'data-[state=checked]:bg-[var(--a-peach-2)]';

/** Essential row (locked) plus the three opt-in switches. Shared by the first-run sheet and Privacy screen. */
export default function ConsentControls({ value, onChange, disabled, onOpenAdSettings }: {
  value: ConsentChoice; onChange: (next: ConsentChoice) => void; disabled?: boolean; onOpenAdSettings?: () => void;
}) {
  const t = usePrivacyText();
  return (
    <div className="space-y-1">
      <Row icon={ShieldCheck} bg="var(--a-green-1)" ink="var(--a-green-ink)" title={t('essential_title')} desc={t('essential_desc')}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--a-green-ink)', background: 'var(--a-green-1)', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{t('always_on')}</span>
      </Row>
      {ROWS.map(row => (
        <Row key={row.key} icon={row.icon} bg={row.bg} ink={row.ink} title={t(row.title)} desc={t(row.desc)}>
          <Switch className={SWITCH_CLS} checked={value[row.key]} disabled={disabled} aria-label={t(row.title)}
            onCheckedChange={checked => onChange({ ...value, [row.key]: checked })} />
        </Row>
      ))}
      {onOpenAdSettings && (
        <button type="button" onClick={onOpenAdSettings} className="w-full flex items-center justify-between text-start"
          style={{ padding: '10px 4px', fontSize: 12, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
          {t('ump_link')}<ChevronRight className="rtl:rotate-180" size={16} />
        </button>
      )}
    </div>
  );
}

function Row({ icon: Icon, bg, ink, title, desc, children }: { icon: typeof BarChart3; bg: string; ink: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: '10px 4px' }}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: bg }}>
          <Icon size={17} style={{ color: ink }} />
        </div>
        <div className="min-w-0">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-ink)' }}>{title}</p>
          <p style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--a-ink-soft)', marginTop: 2 }}>{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
