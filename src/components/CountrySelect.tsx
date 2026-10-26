import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import countriesData from '../../countries.json';
import { tr } from '@/lib/tr';

/**
 * Axtarışlı ölkə seçici — bayraqlar base64 PNG kimi göstərilir.
 * Portal ilə açılır (stacking context tələsinə düşmür), hər yerdə eyni UX.
 */

interface Country {
  id: number;
  name: string;
  isoAlpha2: string;
  isoAlpha3: string;
  isoNumeric: number;
  currency: unknown;
  flag: string;
}

interface CountrySelectProps {
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
  /** Trigger düyməsinin class-ları (form sahələri ilə eyni görünüş üçün) */
  triggerClassName?: string;
}

const flagSrc = (flag: string) =>
flag.startsWith('data:') ? flag : `data:image/png;base64,${flag}`;

const CountrySelect = ({ value, onChange, placeholder, triggerClassName }: CountrySelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => (countriesData as Country[]).find((c) => c.isoAlpha2 === value) || null,
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = countriesData as Country[];
    if (!q) return list;
    return list.filter((c) =>
    c.name.toLowerCase().includes(q) || c.isoAlpha2.toLowerCase().includes(q)
    );
  }, [query]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName || 'a-input w-full flex items-center gap-2'}
        style={{ textAlign: 'start', cursor: 'pointer' }}>
        {selected ?
        <span className="flex items-center gap-2 flex-1 min-w-0">
            <img src={flagSrc(selected.flag)} alt="" style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--a-line)', flexShrink: 0 }} />
            <span className="truncate" style={{ color: 'var(--a-ink)' }}>{selected.name}</span>
          </span> :
        <span className="flex-1" style={{ color: 'var(--a-ink-faint)' }}>
            {placeholder || tr('countryselect_olke_secin', 'Ölkə seçin')}
          </span>
        }
        <ChevronDown size={15} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
      </button>

      {open && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="a-scope fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm flex flex-col"
              style={{ background: 'var(--a-surface)', borderRadius: 22, maxHeight: '70vh', overflow: 'hidden' }}>

              {/* Başlıq + axtarış */}
              <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--a-line)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)', margin: 0 }}>
                    {placeholder || tr('countryselect_olke_secin', 'Ölkə seçin')}
                  </p>
                  <button type="button" onClick={() => setOpen(false)} className="a-icon-btn" style={{ width: 30, height: 30 }}>
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2" style={{ background: 'var(--a-surface-soft)', borderRadius: 12, padding: '9px 12px' }}>
                  <Search size={14} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tr('countryselect_axtar', 'Axtar...')}
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--a-ink)' }} />
                </div>
              </div>

              {/* Siyahı */}
              <div style={{ overflowY: 'auto', padding: 8 }}>
                {filtered.map((c) =>
                <button
                  key={c.isoAlpha2}
                  type="button"
                  onClick={() => pick(c.isoAlpha2)}
                  className="w-full flex items-center gap-3"
                  style={{
                    padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: value === c.isoAlpha2 ? 'var(--a-peach-1)' : 'transparent',
                    textAlign: 'start'
                  }}>
                    <img loading="lazy" decoding="async" src={flagSrc(c.flag)} alt="" style={{ width: 26, height: 18, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--a-line)', flexShrink: 0 }} />
                    <span className="flex-1 truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--a-ink)' }}>{c.name}</span>
                    {value === c.isoAlpha2 && <Check size={15} style={{ color: 'var(--a-peach-2)', flexShrink: 0 }} />}
                  </button>
                )}
                {filtered.length === 0 &&
                <p className="text-center" style={{ padding: 20, fontSize: 12.5, color: 'var(--a-ink-faint)' }}>
                    {tr('countryselect_tapilmadi', 'Ölkə tapılmadı')}
                  </p>
                }
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body)
      }
    </>);

};

export default CountrySelect;
