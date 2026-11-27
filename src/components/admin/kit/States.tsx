import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shimmer block. Use explicit sizes to avoid layout shift. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn('ak-skeleton', className)} style={style} aria-hidden />;
}

/** N table-like skeleton rows. */
export function SkeletonRows({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="ak-skeleton-rows" role="status" aria-label="Yüklənir">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="ak-skeleton-row">
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} style={{ width: `${column === 0 ? 38 : 18 + ((row + column) % 3) * 8}%` }} />)}
        </div>
      ))}
    </div>
  );
}

/** Generic page skeleton used while a section chunk loads (never a lone spinner). */
export function PageSkeleton() {
  return (
    <div className="ak-page" role="status" aria-label="Bölmə yüklənir" data-testid="admin-page-skeleton">
      <div className="ak-page-header"><div className="ak-page-header-text"><Skeleton style={{ width: 220, height: 24 }} /><Skeleton style={{ width: 320, height: 14, marginTop: 8 }} /></div></div>
      <div className="ak-kpi-row">{[0, 1, 2, 3].map(index => <div key={index} className="ak-stat"><Skeleton style={{ width: '50%', height: 12 }} /><Skeleton style={{ width: '70%', height: 26, marginTop: 10 }} /></div>)}</div>
      <div className="ak-section"><div className="ak-section-body"><SkeletonRows rows={7} columns={5} /></div></div>
    </div>
  );
}

export function EmptyState({ title = 'Məlumat yoxdur', description, icon, action, compact }: {
  title?: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={cn('ak-empty', compact && 'is-compact')} data-testid="ak-empty">
      <span className="ak-empty-icon" aria-hidden>{icon ?? <Inbox size={20} />}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

/** Inline error with retry. */
export function ErrorState({ message = 'Məlumat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.', onRetry, compact }: {
  message?: ReactNode; onRetry?: () => void; compact?: boolean;
}) {
  return (
    <div className={cn('ak-error', compact && 'is-compact')} role="alert">
      <AlertTriangle size={16} aria-hidden />
      <span>{message}</span>
      {onRetry && <button type="button" className="ak-btn ak-btn-sm" onClick={onRetry}><RefreshCw size={13} />Yenidən yoxla</button>}
    </div>
  );
}

/** Small amber/blue notice. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return <div className="ak-notice" data-tone={tone}>{children}</div>;
}
