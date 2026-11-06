import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page title row: title + short subtitle on the left, actions on the right (wraps on phones). */
export function PageHeader({ title, subtitle, icon, actions, meta, className }: {
  title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; meta?: ReactNode; className?: string;
}) {
  return (
    <header className={cn('ak-page-header', className)}>
      <div className="ak-page-header-text">
        <div className="ak-page-title-row">
          {icon && <span className="ak-page-icon" aria-hidden>{icon}</span>}
          <h1>{title}</h1>
          {meta}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ak-page-actions">{actions}</div>}
    </header>
  );
}

/** Vertical page container with consistent gaps. */
export function Page({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <div className={cn('ak-page', className)} data-testid={testId}>{children}</div>;
}

/** Card-like block with optional header row. `flush` removes body padding (tables). */
export function Section({ title, description, actions, children, flush, className, id, testId }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; flush?: boolean; className?: string; id?: string; testId?: string;
}) {
  return (
    <section className={cn('ak-section', flush && 'is-flush', className)} id={id} data-testid={testId}>
      {(title || actions) && (
        <div className="ak-section-head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="ak-section-actions">{actions}</div>}
        </div>
      )}
      <div className="ak-section-body">{children}</div>
    </section>
  );
}

/** Responsive grid: 1 column on phones, `cols` from md upward. */
export function Grid({ children, cols = 2, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  return <div className={cn('ak-grid', `ak-grid-${cols}`, className)}>{children}</div>;
}

/** Compact label/value list used in drawers. */
export function DescriptionList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="ak-dl">
      {items.map(([label, value], index) => (
        <div key={index}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>
      ))}
    </dl>
  );
}
