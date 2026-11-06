import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'violet';

/** Compact rounded status label. */
export function StatusPill({ tone = 'neutral', children, dot = true, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return <span className="ak-pill" data-tone={tone} title={title}>{dot && <i aria-hidden />}{children}</span>;
}

/** Map of common workflow statuses to tones/labels used across commerce and support sections. */
export const STATUS_TONES: Record<string, Tone> = {
  pending: 'warning', open: 'warning', checking: 'warning', review: 'warning', draft: 'neutral',
  confirmed: 'info', processing: 'info', preparing: 'info', in_progress: 'info', shipped: 'violet', ready: 'violet',
  delivered: 'success', paid: 'success', success: 'success', resolved: 'success', active: 'success', live: 'success', approved: 'success', reviewed: 'success',
  cancelled: 'neutral', closed: 'neutral', dismissed: 'neutral', expired: 'neutral', paused: 'neutral',
  failed: 'danger', error: 'danger', refunded: 'danger', returned: 'danger', rejected: 'danger', urgent: 'danger', high: 'warning', low: 'neutral', normal: 'info',
};
export const toneFor = (status: string | null | undefined): Tone => (status && STATUS_TONES[status]) || 'neutral';
