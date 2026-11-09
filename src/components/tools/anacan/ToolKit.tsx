import { ReactNode, createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Lock } from 'lucide-react';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from "@/lib/tr";

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

/**
 * Merged tools (src/lib/merged-tools.ts): a host tool shows its sections as a small tab bar under the header, and the
 * sleep pair shows a one-line intro with a link to its companion. Provided by ToolsHub; tools need no changes.
 */
export interface ToolSectionsValue {
  sections?: { id: string; label: string; locked?: boolean }[];
  active?: string;
  onSelect?: (id: string) => void;
  intro?: string;
  link?: { label: string; onOpen: () => void };
}
export const ToolSectionsContext = createContext<ToolSectionsValue | null>(null);

export function ToolSectionsBar() {
  const ctx = useContext(ToolSectionsContext);
  if (!ctx) return null;
  const tabs = ctx.sections && ctx.sections.length > 1 ? ctx.sections : null;
  if (!tabs && !ctx.intro && !ctx.link) return null;
  return (
    <div className="a-tool-sections">
      {tabs && <div className="a-tool-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={ctx.active === t.id}
            className={`a-tool-tab${ctx.active === t.id ? ' on' : ''}`} onClick={() => ctx.onSelect?.(t.id)}>
            {t.label}{t.locked && <Lock size={10} strokeWidth={2.6} aria-hidden style={{ marginInlineStart: 4, opacity: 0.7 }} />}
          </button>
        ))}
      </div>}
      {(ctx.intro || ctx.link) && <div className="a-tool-intro">
        {ctx.intro && <span className="a-tool-intro-text">{ctx.intro}</span>}
        {ctx.link && <button type="button" className="a-tool-intro-link" onClick={ctx.link.onOpen}>
          {ctx.link.label}<ChevronRight className="rtl:rotate-180" size={13} strokeWidth={2.6} aria-hidden /></button>}
      </div>}
    </div>
  );
}

export const ToolHeader = ({ title, eyebrow, onBack, actions }: ToolHeaderProps) => (
  <>
  <header className="a-topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {onBack && (
        <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label={tr("common_back", "Geri")}>
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </motion.button>
      )}
      <div style={{ minWidth: 0 }}>
        {eyebrow && <p className="a-eyebrow">{eyebrow}</p>}
        <p className="a-wordmark" style={{ fontSize: 16 }}>
          {title}
        </p>
      </div>
    </div>
    {actions && <div className="a-topbar-actions">{actions}</div>}
  </header>
  <ToolSectionsBar />
  </>
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
