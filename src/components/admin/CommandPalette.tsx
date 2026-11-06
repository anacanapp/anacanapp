import { useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Clock, CornerDownLeft, Search, Star } from 'lucide-react';
import { ADMIN_GROUPS, ADMIN_SECTIONS, getSection, type AdminSection } from './registry';
import { prefetchSection } from './sections';
import { foldText } from './kit/format';
import { cn } from '@/lib/utils';

/** Rank sections for a query: label prefix > word prefix > label/id contains > group/keywords. Diacritics folded. */
export function searchSections(query: string, sections: AdminSection[] = ADMIN_SECTIONS): AdminSection[] {
  const q = foldText(query.trim());
  if (!q) return sections;
  const terms = q.split(/\s+/);
  const scored = sections.map(section => {
    const label = foldText(section.label), id = section.id.toLowerCase(), group = foldText(ADMIN_GROUPS.find(g => g.id === section.group)?.label ?? '');
    const keywords = foldText(section.keywords ?? '');
    const haystack = `${label} ${id} ${group} ${keywords}`;
    if (!terms.every(term => haystack.includes(term))) return null;
    let score = 0;
    if (label.startsWith(q)) score += 100;
    else if (label.split(/[\s/-]+/).some(word => word.startsWith(terms[0]))) score += 70;
    else if (label.includes(q)) score += 50;
    if (id === q) score += 90; else if (id.startsWith(q)) score += 40; else if (id.includes(q)) score += 20;
    if (keywords.split(/\s+/).some(word => word.startsWith(terms[0]))) score += 15;
    return { section, score };
  }).filter((item): item is { section: AdminSection; score: number } => !!item);
  return scored.sort((a, b) => b.score - a.score || a.section.label.localeCompare(b.section.label, 'az')).map(item => item.section);
}

interface Row { section: AdminSection; heading?: string; hint?: 'favourite' | 'recent' }

export default function CommandPalette({ open, onOpenChange, onNavigate, favourites = [], recents = [], current }: {
  open: boolean; onOpenChange: (open: boolean) => void; onNavigate: (id: string) => void;
  favourites?: string[]; recents?: string[]; current?: string;
}) {
  const [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);

  const rows = useMemo<Row[]>(() => {
    if (query.trim()) return searchSections(query).map(section => ({ section }));
    const seen = new Set<string>(), result: Row[] = [];
    const push = (ids: string[], heading: string, hint?: Row['hint']) => {
      let first = true;
      for (const id of ids) {
        const section = getSection(id);
        if (!section || seen.has(section.id)) continue;
        seen.add(section.id); result.push({ section, heading: first ? heading : undefined, hint }); first = false;
      }
    };
    push(favourites, 'Seçilmişlər', 'favourite');
    push(recents, 'Son baxılanlar', 'recent');
    for (const group of ADMIN_GROUPS) push(ADMIN_SECTIONS.filter(section => section.group === group.id).map(section => section.id), group.label);
    return result;
  }, [query, favourites, recents]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const element = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    element?.scrollIntoView?.({ block: 'nearest' });
    const row = rows[active];
    if (row) prefetchSection(row.section.id);
  }, [active, rows]);

  const choose = (row: Row | undefined) => { if (!row) return; onOpenChange(false); onNavigate(row.section.id); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(rows.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(Math.max(0, rows.length - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(rows[active]); }
  };
  const groupLabel = (section: AdminSection) => ADMIN_GROUPS.find(group => group.id === section.group)?.label;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ak-overlay ak-overlay-soft" />
        <DialogPrimitive.Content className="ak-palette" data-testid="admin-command-palette" aria-label="Bölmə axtarışı">
          <DialogPrimitive.Title className="sr-only">Bölməyə keç</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Bölmənin adını və ya açar sözünü yazın, ox düymələri ilə seçin.</DialogPrimitive.Description>
          <div className="ak-palette-input">
            <Search size={16} aria-hidden />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onKeyDown}
              placeholder="Bölmə axtar: sifariş, push, istifadəçi…" aria-label="Bölmə axtar" role="combobox" aria-expanded
              aria-controls="admin-palette-list" aria-activedescendant={rows[active] ? `palette-${rows[active].section.id}` : undefined} />
            <kbd>Esc</kbd>
          </div>
          <div className="ak-palette-list" id="admin-palette-list" role="listbox" ref={list} aria-label="Bölmələr">
            {!rows.length && <p className="ak-palette-empty">“{query}” üzrə bölmə tapılmadı.</p>}
            {rows.map((row, index) => (
              <div key={row.section.id + (row.hint ?? '')}>
                {row.heading && <div className="ak-palette-heading">{row.heading}</div>}
                <div role="option" id={`palette-${row.section.id}`} aria-selected={index === active} data-index={index}
                  className={cn('ak-palette-item', index === active && 'is-active', row.section.id === current && 'is-current')}
                  onMouseMove={() => { if (index !== active) setActive(index); }} onClick={() => choose(row)}>
                  <row.section.icon size={16} aria-hidden />
                  <span className="ak-palette-label">{row.section.label}</span>
                  {row.hint === 'favourite' && <Star size={12} className="ak-palette-hint" aria-label="Seçilmiş" />}
                  {row.hint === 'recent' && <Clock size={12} className="ak-palette-hint" aria-label="Son baxılan" />}
                  <span className="ak-palette-group">{query ? groupLabel(row.section) : row.section.id}</span>
                  {index === active ? <CornerDownLeft size={13} className="ak-palette-enter" aria-hidden /> : <ArrowRight size={13} className="ak-palette-enter is-idle" aria-hidden />}
                </div>
              </div>
            ))}
          </div>
          <div className="ak-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> seç</span><span><kbd>↵</kbd> aç</span><span><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> açar</span></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
