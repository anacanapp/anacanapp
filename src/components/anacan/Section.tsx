import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Section with a title and an optional trailing link/meta. */
export function Section({ title, link, onLink, meta, children, className = '' }: {
  title: ReactNode; link?: string; onLink?: () => void; meta?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`a3-sec ${className}`}>
      <div className="a3-sec-head">
        <h2 className="a3-sec-title">{title}</h2>
        {link && onLink ? <button type="button" className="a3-link" onClick={onLink}>{link}<ChevronRight size={14} className="rtl:rotate-180" /></button> : meta}
      </div>
      {children}
    </section>
  );
}

/** Card with a segmented control switching between short texts (e.g. Baby / You / Tip). */
export function InfoTabs({ tabs }: { tabs: { label: string; text: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const i = Math.min(active, tabs.length - 1);
  if (!tabs.length) return null;
  return (
    <article className="a3-card a3-pad">
      <div className="a3-seg" role="tablist">
        {tabs.map((t, k) => (
          <button key={t.label} type="button" role="tab" aria-selected={k === i} onClick={() => setActive(k)}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" style={{ padding: '4px 2px 2px', fontSize: 15, lineHeight: 1.55, color: 'var(--a-ink)' }}>{tabs[i].text}</div>
    </article>
  );
}
