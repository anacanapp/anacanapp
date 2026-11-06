import { useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> { value: T; label: ReactNode; count?: number | null; icon?: ReactNode }

/**
 * Underlined tab bar (scrolls horizontally on phones). Content is rendered by the caller
 * so inactive tabs do not mount or fetch.
 */
export function AdminTabs<T extends string>({ items, value, onChange, label = 'Bölmələr' }: {
  items: TabItem<NoInfer<T>>[]; value: T; onChange: (value: NoInfer<T>) => void; label?: string;
}) {
  return (
    <div className="ak-tabs" role="tablist" aria-label={label}>
      {items.map(item => (
        <button key={item.value} type="button" role="tab" aria-selected={item.value === value} className="ak-tab"
          onClick={() => onChange(item.value)}>
          {item.icon}{item.label}
          {typeof item.count === 'number' && item.count > 0 && <span className="ak-tab-count">{item.count.toLocaleString('az-AZ')}</span>}
        </button>
      ))}
    </div>
  );
}

/** Collapsible, monospace JSON viewer for diagnostics/extra_data. */
export function JsonView({ value, maxHeight = 240, className }: { value: unknown; maxHeight?: number; className?: string }) {
  let text: string;
  try { text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch { text = String(value); }
  return <pre className={cn('ak-json', className)} style={{ maxHeight }}>{text}</pre>;
}

/**
 * Image upload wrapper. Pass the section's existing upload function (`upload(file) => url|null`)
 * so storage buckets, paths and size limits stay exactly as before.
 */
export function ImageUpload({ value, onChange, upload, label = 'Şəkil yüklə', size = 96, accept = 'image/*' }: {
  value: string | null | undefined; onChange: (url: string) => void; upload: (file: File) => Promise<string | null>;
  label?: string; size?: number; accept?: string;
}) {
  const [busy, setBusy] = useState(false), input = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { const url = await upload(file); if (url) onChange(url); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <div className="ak-upload" style={{ width: size, height: size }}>
      {value ? (
        <>
          <img src={value} alt="" />
          <button type="button" className="ak-upload-remove" aria-label="Şəkli sil" onClick={() => onChange('')}><X size={12} /></button>
        </>
      ) : (
        <label className="ak-upload-drop" aria-label={label}>
          <input ref={input} type="file" accept={accept} className="sr-only" onChange={event => void pick(event.target.files?.[0])} />
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span>{busy ? 'Yüklənir…' : label}</span>
        </label>
      )}
    </div>
  );
}

/** Small monochrome avatar with initial. */
export function Avatar({ name, src, size = 32 }: { name?: string | null; src?: string | null; size?: number }) {
  return (
    <span className="ak-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {src ? <img src={src} alt="" /> : (name?.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}

/** Primary/secondary buttons outside shadcn (lighter, dense). */
export function Btn({ children, variant = 'default', size, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'sm';
}) {
  return <button type="button" className={cn('ak-btn', variant !== 'default' && `ak-btn-${variant}`, size === 'sm' && 'ak-btn-sm', className)} {...props}>{children}</button>;
}
