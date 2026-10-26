import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { rd } from '@/lib/redesign-i18n';
import { useScrollToTop } from '@/hooks/useScrollToTop';

/**
 * Anacan redesign — shared tool-screen primitives.
 * Thin JSX wrappers over the `a-*` design-system classes
 * (src/styles/anacan-design.css) so every tool screen shares
 * the exact same chrome: peach page, topbar, empty & loading states.
 */

interface ToolPageProps {
  children: ReactNode;
  /** Extra classes for the outer scope element */
  className?: string;
  /** Disable the inner a-shell horizontal padding (full-bleed screens) */
  noShell?: boolean;
}

export const ToolPage = ({ children, className = '', noShell = false }: ToolPageProps) => {
  // Mərkəzi qoruyucu: hər alət səhifəsi HƏMİŞƏ yuxarıdan başlayır —
  // ayrı-ayrı alətlər öz useScrollToTop-unu unutsa belə.
  useScrollToTop();

  return (
    <div
      className={`a-scope pb-24 ${className}`}
      style={{ background: 'var(--a-bg)', minHeight: '100%' }}
    >
      {noShell ? children : <div className="a-shell">{children}</div>}
    </div>
  );
};

interface ToolHeaderProps {
  /** Screen title (wordmark) */
  title: string;
  /** Small uppercase line above the title */
  eyebrow?: ReactNode;
  onBack?: () => void;
  /** Right-side action buttons (use .a-icon-btn / .a-btn-soft) */
  actions?: ReactNode;
}

export const ToolHeader = ({ title, eyebrow, onBack, actions }: ToolHeaderProps) => (
  <header className="a3-topbar a3-tool-head">
    {onBack && (
      <button type="button" onClick={onBack} className="a3-icon-btn" aria-label={rd('back')}>
        <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
      </button>
    )}
    <div className="a3-grow" style={{ minWidth: 0 }}>
      {eyebrow && <p className="a3-eyebrow" style={{ margin: 0 }}>{eyebrow}</p>}
      <h1 className="a3-tool-title">{title}</h1>
    </div>
    {actions && <div className="a-topbar-actions">{actions}</div>}
  </header>
);

interface ToolEmptyProps {
  /** Emoji string or an icon element */
  icon: ReactNode;
  title: string;
  text?: string;
  /** Optional CTA (e.g. <button className="a-cta-btn">…</button>) */
  action?: ReactNode;
  className?: string;
}

export const ToolEmpty = ({ icon, title, text, action, className = '' }: ToolEmptyProps) => (
  <div className={`a-card ${className}`} style={{ textAlign: 'center', padding: '34px 18px' }}>
    <div
      className="mx-auto mb-4 flex items-center justify-center"
      style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)', fontSize: 28 }}
    >
      {icon}
    </div>
    <h3 className="a-list-title" style={{ marginBottom: 4 }}>{title}</h3>
    {text && <p className="a-list-sub" style={{ margin: action ? '0 0 16px' : 0, whiteSpace: 'normal' }}>{text}</p>}
    {action}
  </div>
);

export const ToolLoading = () => (
  <div className="a-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--a-bg)' }}>
    <div
      className="w-8 h-8 rounded-full animate-spin"
      style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }}
    />
  </div>
);
