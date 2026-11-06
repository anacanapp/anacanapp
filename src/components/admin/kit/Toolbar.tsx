import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Filter bar container: search grows, filters wrap; horizontally scrollable chips on phones. */
export function Toolbar({ children, className, end }: { children: ReactNode; className?: string; end?: ReactNode }) {
  return <div className={cn('ak-toolbar', className)}>{children}{end && <div className="ak-toolbar-end">{end}</div>}</div>;
}

/**
 * Search box with built-in debounce. `onChange` fires `delay` ms after typing stops
 * (and immediately on clear), so callers can feed it straight into a server query.
 */
export function SearchInput({ value, onChange, placeholder = 'Axtar…', delay = 300, label, autoFocus, className }: {
  value: string; onChange: (value: string) => void; placeholder?: string; delay?: number; label?: string; autoFocus?: boolean; className?: string;
}) {
  const [text, setText] = useState(value);
  const last = useRef(value), handler = useRef(onChange);
  handler.current = onChange;
  useEffect(() => { if (value !== last.current) { last.current = value; setText(value); } }, [value]);
  useEffect(() => {
    if (text === last.current) return;
    const timer = setTimeout(() => { last.current = text; handler.current(text); }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);
  return (
    <label className={cn('ak-search', className)}>
      <Search size={15} aria-hidden />
      <input type="search" value={text} placeholder={placeholder} aria-label={label ?? placeholder} autoFocus={autoFocus}
        onChange={event => setText(event.target.value)} />
      {text && <button type="button" aria-label="Axtarışı təmizlə" onClick={() => { setText(''); last.current = ''; onChange(''); }}><X size={14} /></button>}
    </label>
  );
}

export interface ChipOption<T extends string = string> { value: T; label: ReactNode; count?: number | null }

/** Single-select chip group ("Hamısı / Gözləyir / …"). */
export function FilterChips<T extends string>({ options, value, onChange, label }: {
  options: ChipOption<NoInfer<T>>[]; value: T; onChange: (value: NoInfer<T>) => void; label?: string;
}) {
  return (
    <div className="ak-chips" role="group" aria-label={label}>
      {options.map(option => (
        <button key={option.value} type="button" className="ak-chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {typeof option.count === 'number' && <span className="ak-chip-count">{option.count.toLocaleString('az-AZ')}</span>}
        </button>
      ))}
    </div>
  );
}

/** Multi-select chip group. Empty selection means "all". */
export function MultiChips<T extends string>({ options, value, onChange, label }: {
  options: ChipOption<T>[]; value: T[]; onChange: (value: T[]) => void; label?: string;
}) {
  return (
    <div className="ak-chips" role="group" aria-label={label}>
      {options.map(option => {
        const on = value.includes(option.value);
        return <button key={option.value} type="button" className="ak-chip" aria-pressed={on}
          onClick={() => onChange(on ? value.filter(item => item !== option.value) : [...value, option.value])}>{option.label}</button>;
      })}
    </div>
  );
}

/** Native select styled for the toolbar. */
export function SelectFilter({ value, onChange, options, label, className }: {
  value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; label: string; className?: string;
}) {
  return (
    <select className={cn('ak-select', className)} aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export interface DateRangeValue { from: string; to: string }
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const lastDays = (days: number, now = new Date()): DateRangeValue => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { from: isoDay(new Date(end.getTime() - days * 86400000)), to: isoDay(end) };
};

/** Preset chips (7/30/90 days) + optional custom from/to inputs. `to` is exclusive. */
export function DateRange({ value, onChange, presets = [7, 30, 90] }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void; presets?: number[] }) {
  const active = presets.find(days => { const range = lastDays(days); return range.from === value.from && range.to === value.to; });
  return (
    <div className="ak-daterange">
      <div className="ak-chips" role="group" aria-label="Müddət">
        {presets.map(days => <button key={days} type="button" className="ak-chip" aria-pressed={active === days} onClick={() => onChange(lastDays(days))}>{days} gün</button>)}
      </div>
      <input type="date" className="ak-input ak-input-date" aria-label="Başlanğıc" value={value.from} onChange={event => onChange({ ...value, from: event.target.value })} />
      <span aria-hidden>–</span>
      <input type="date" className="ak-input ak-input-date" aria-label="Son tarix" value={value.to} onChange={event => onChange({ ...value, to: event.target.value })} />
    </div>
  );
}
