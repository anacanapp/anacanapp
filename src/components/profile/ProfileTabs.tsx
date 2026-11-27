import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChevronRight, Edit } from 'lucide-react';
import { tr } from '@/lib/tr';

export type ProfileTab = 'me' | 'family' | 'settings';

export interface ProfileRow {
  id: string;
  icon: LucideIcon;
  label: string;
  sub?: string;
  badge?: string;
  /** Icon tile colours: background and ink tokens. */
  tint?: [string, string];
}

const DEFAULT_TINT: [string, string] = ['var(--a-surface-soft)', 'var(--a-ink-soft)'];

/** Rows of the tabbed profile: coloured icon tile, label, optional hint and badge. */
export function ProfileRows({ rows, onPick, title, compact = false }: { rows: ProfileRow[]; onPick: (id: string) => void; title?: string; compact?: boolean }) {
  if (!rows.length) return null;
  return (
    <section style={{ marginTop: 12 }}>
      {title && <p style={{ margin: '4px 4px 8px', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--a-ink-soft)' }}>{title}</p>}
      <div className="a-list-card">
        {rows.map((row) => {
          const Icon = row.icon;
          const [bg, ink] = row.tint || DEFAULT_TINT;
          return (
            <button key={row.id} type="button" onClick={() => onPick(row.id)} className="a-list-row w-full"
              style={{ width: '100%', textAlign: 'start', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', padding: compact ? '10px 16px' : undefined, gap: 12 }}>
              <span className="a-list-icon" style={{ width: compact ? 30 : 38, height: compact ? 30 : 38, borderRadius: compact ? 10 : 12, background: bg, color: ink }}>
                <Icon size={compact ? 14 : 18} strokeWidth={2} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className={compact ? 'a-list-sub' : 'a-list-title'} style={{ display: 'block', margin: 0, fontWeight: compact ? 600 : undefined }}>{row.label}</span>
                {row.sub && !compact && <span className="a-list-sub" style={{ display: 'block', margin: '2px 0 0' }}>{row.sub}</span>}
              </span>
              {row.badge && <span className="a-tag on" style={{ cursor: 'default', padding: '4px 9px', fontSize: 10 }}>{row.badge}</span>}
              <ChevronRight size={compact ? 14 : 16} className="rtl:rotate-180 a-list-chevron" />
            </button>);
        })}
      </div>
    </section>);
}

/** Profile layout "Mən · Ailə · Ayarlar": centred identity, a segmented switch and one short page per tab. */
export default function ProfileTabs({ tab, onTab, name, avatarUrl, emoji, badge, onEdit, me, family, settings, showFamily = true }: {
  tab: ProfileTab; onTab: (tab: ProfileTab) => void; name: string; avatarUrl: string | null; emoji: string; badge: string;
  onEdit: () => void; me: ReactNode; family: ReactNode; settings: ReactNode; showFamily?: boolean;
}) {
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'me', label: tr('profiletabs_me', 'Mən') },
    ...(showFamily ? [{ id: 'family' as ProfileTab, label: tr('profiletabs_family', 'Ailə') }] : []),
    { id: 'settings', label: tr('profiletabs_settings', 'Ayarlar') }];
  const active = tabs.some((t) => t.id === tab) ? tab : 'me';
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', padding: '6px 0 4px', position: 'relative' }}>
        <span style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 34, background: 'var(--a-grad-peach)', boxShadow: '0 0 0 4px var(--a-coral-soft, #ffe7e1)' }}>
          {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emoji}
        </span>
        <h2 className="a-heading" style={{ margin: '4px 0 0', fontSize: 19, color: 'var(--a-ink)' }}>{name}</h2>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--a-peach-ink, #9e2b2e)', background: 'var(--a-coral-soft, #ffe7e1)', borderRadius: 999, padding: '3px 10px' }}>{badge}</span>
        <button type="button" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, border: 0, background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--a-coral-text, #c4262e)' }}>
          <Edit size={14} strokeWidth={2.2} />{tr('profiletabs_edit', 'Profili redaktə et')}
        </button>
      </div>
      <div role="tablist" aria-label={tr('untranslated_profil_v8b0sk', 'Profil')} style={{ display: 'flex', gap: 4, padding: 4, marginTop: 12, borderRadius: 16, background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onTab(t.id)}
              style={{ flex: 1, position: 'relative', border: 0, background: 'none', borderRadius: 12, padding: '10px 0', fontSize: 13.5, fontWeight: on ? 900 : 800, color: on ? 'var(--a-on-deep, #fff)' : 'var(--a-ink)', cursor: 'pointer' }}>
              {on && <motion.span layoutId="profile-tab-pill" style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'var(--a-deep, #2a2120)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span style={{ position: 'relative' }}>{t.label}</span>
            </button>);
        })}
      </div>
      <div role="tabpanel" key={active}>
        {active === 'me' ? me : active === 'family' ? family : settings}
      </div>
    </>);
}
