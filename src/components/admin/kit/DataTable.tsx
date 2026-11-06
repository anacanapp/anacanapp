import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useMediaQuery } from './hooks';
import { EmptyState, ErrorState, SkeletonRows } from './States';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Enables header sorting. For client sorting supply `sortValue`; for server sorting handle `onSortChange`. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'start' | 'end' | 'center';
  width?: number | string;
  /** Mobile card role: `title` becomes the card heading, `hidden` skips the field on phones. */
  mobile?: 'title' | 'subtitle' | 'hidden' | 'meta';
  className?: string;
}

export interface RowAction<T> { label: string; icon?: ReactNode; onSelect: (row: T) => void; danger?: boolean; hidden?: (row: T) => boolean; separatorBefore?: boolean }
export interface SortState { key: string; dir: 'asc' | 'desc' }

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  actions?: RowAction<T>[];
  /** Selection + bulk actions bar. */
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  /** Client-side pagination when `pageSize` is set and `total` is not. */
  pageSize?: number;
  /** Server pagination: provide `page` (0-based), `total` and `onPageChange`. */
  page?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  defaultSort?: SortState;
  /** Sticky header inside a max-height scroller. */
  maxHeight?: number | string;
  fetching?: boolean;
  testId?: string;
  rowTestId?: string;
  /** Force card layout regardless of width (tests, narrow panels). */
  cards?: boolean;
}

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'az', { numeric: true });
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, empty, onRowClick, actions, selectable, bulkActions, pageSize, page, total,
  onPageChange, sort, onSortChange, defaultSort, maxHeight, fetching, testId, rowTestId, cards }: DataTableProps<T>) {
  const phone = useMediaQuery('(max-width: 767px)');
  const asCards = cards ?? phone;
  const [localSort, setLocalSort] = useState<SortState | null>(defaultSort ?? null);
  const [localPage, setLocalPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const server = typeof total === 'number' && !!onPageChange;
  const activeSort = onSortChange ? sort ?? null : localSort;

  const sorted = useMemo(() => {
    const list = rows ?? [];
    if (onSortChange || !activeSort) return list;
    const column = columns.find(item => item.key === activeSort.key);
    if (!column?.sortValue) return list;
    const factor = activeSort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => factor * compare(column.sortValue!(a), column.sortValue!(b)));
  }, [rows, columns, activeSort, onSortChange]);

  const currentPage = server ? page ?? 0 : localPage;
  const size = pageSize ?? (server ? sorted.length || 1 : sorted.length || 1);
  const totalCount = server ? total! : sorted.length;
  const visible = server || !pageSize ? sorted : sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const pages = pageSize || server ? Math.max(1, Math.ceil(totalCount / size)) : 1;

  useEffect(() => { if (!server && localPage > 0 && localPage >= pages) setLocalPage(pages - 1); }, [server, localPage, pages]);
  const signature = (rows ?? []).map(rowKey).join('|');
  useEffect(() => { setSelected(previous => (previous.size ? new Set() : previous)); }, [signature]);

  const toggleSort = (key: string) => {
    const next: SortState | null = !activeSort || activeSort.key !== key ? { key, dir: 'asc' } : activeSort.dir === 'asc' ? { key, dir: 'desc' } : null;
    if (onSortChange) onSortChange(next); else setLocalSort(next);
  };
  const setPage = (next: number) => { if (server) onPageChange!(next); else setLocalPage(next); };
  const selectedRows = visible.filter(row => selected.has(rowKey(row)));
  const allSelected = visible.length > 0 && selectedRows.length === visible.length;
  const toggleRow = (key: string) => setSelected(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const menu = (row: T) => {
    const list = (actions ?? []).filter(action => !action.hidden?.(row));
    if (!list.length) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="ak-icon-btn" aria-label="Əməliyyatlar" onClick={event => event.stopPropagation()}><MoreHorizontal size={16} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
          {list.map((action, index) => (
            <div key={action.label}>
              {action.separatorBefore && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem className={cn(action.danger && 'text-destructive focus:text-destructive')} onSelect={() => action.onSelect(row)}>
                {action.icon && <span className="me-2 inline-flex">{action.icon}</span>}{action.label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  let body: ReactNode;
  if (error) body = <div className="ak-table-state"><ErrorState onRetry={onRetry} /></div>;
  else if (loading && !rows) body = <div className="ak-table-state"><SkeletonRows rows={Math.min(size, 8)} columns={Math.min(columns.length, 5)} /></div>;
  else if (!visible.length) body = <div className="ak-table-state">{empty ?? <EmptyState compact />}</div>;
  else if (asCards) {
    const title = columns.find(column => column.mobile === 'title') ?? columns[0];
    const subtitle = columns.find(column => column.mobile === 'subtitle');
    const rest = columns.filter(column => column !== title && column !== subtitle && column.mobile !== 'hidden');
    body = (
      <ul className="ak-cards">
        {visible.map(row => {
          const key = rowKey(row);
          return (
            <li key={key} className={cn('ak-card-row', onRowClick && 'is-clickable', selected.has(key) && 'is-selected')} data-testid={rowTestId}
              onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? event => { if (event.key === 'Enter') onRowClick(row); } : undefined}>
              <div className="ak-card-head">
                {selectable && <input type="checkbox" className="ak-check" aria-label="Seç" checked={selected.has(key)} onClick={event => event.stopPropagation()} onChange={() => toggleRow(key)} />}
                <div className="ak-card-title">{title.cell(row)}{subtitle && <div className="ak-card-sub">{subtitle.cell(row)}</div>}</div>
                {menu(row)}
              </div>
              {rest.length > 0 && <dl className="ak-card-fields">{rest.map(column => <div key={column.key}><dt>{column.header}</dt><dd>{column.cell(row)}</dd></div>)}</dl>}
            </li>
          );
        })}
      </ul>
    );
  } else {
    body = (
      <div className="ak-table-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table className="ak-table">
          <thead>
            <tr>
              {selectable && <th className="ak-col-check"><input type="checkbox" className="ak-check" aria-label="Hamısını seç" checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(rowKey)))} /></th>}
              {columns.map(column => {
                const state = activeSort?.key === column.key ? activeSort.dir : null;
                return (
                  <th key={column.key} style={{ width: column.width, textAlign: column.align === 'end' ? 'end' : column.align === 'center' ? 'center' : 'start' }}
                    aria-sort={state === 'asc' ? 'ascending' : state === 'desc' ? 'descending' : undefined} className={column.className}>
                    {column.sortable ? (
                      <button type="button" className="ak-th-sort" onClick={() => toggleSort(column.key)}>
                        {column.header}{state === 'asc' ? <ArrowUp size={12} /> : state === 'desc' ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-40" />}
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
              {actions?.length ? <th className="ak-col-actions"><span className="sr-only">Əməliyyatlar</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map(row => {
              const key = rowKey(row);
              return (
                <tr key={key} className={cn(onRowClick && 'is-clickable', selected.has(key) && 'is-selected')} data-testid={rowTestId}
                  onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? event => { if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick(row); } : undefined}>
                  {selectable && <td className="ak-col-check" onClick={event => event.stopPropagation()}><input type="checkbox" className="ak-check" aria-label="Seç" checked={selected.has(key)} onChange={() => toggleRow(key)} /></td>}
                  {columns.map(column => <td key={column.key} className={column.className} style={{ textAlign: column.align === 'end' ? 'end' : column.align === 'center' ? 'center' : 'start' }}>{column.cell(row)}</td>)}
                  {actions?.length ? <td className="ak-col-actions">{menu(row)}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn('ak-datatable', fetching && 'is-fetching')} data-testid={testId}>
      {selectable && selectedRows.length > 0 && bulkActions && (
        <div className="ak-bulkbar" role="region" aria-label="Seçilmişlər">
          <span>{selectedRows.length} seçilib</span>
          <div className="ak-bulkbar-actions">{bulkActions(selectedRows, () => setSelected(new Set()))}</div>
          <button type="button" className="ak-btn ak-btn-sm ak-btn-ghost" onClick={() => setSelected(new Set())}>Ləğv et</button>
        </div>
      )}
      {body}
      {(pageSize || server) && totalCount > 0 && (
        <Pagination page={currentPage} pages={pages} total={totalCount} pageSize={size} onPageChange={setPage} disabled={fetching} />
      )}
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPageChange, disabled }: {
  page: number; pages: number; total: number; pageSize: number; onPageChange: (page: number) => void; disabled?: boolean;
}) {
  const from = total ? page * pageSize + 1 : 0, to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav className="ak-pagination" aria-label="Səhifələmə">
      <span data-testid="ak-page-range">{from.toLocaleString('az-AZ')}–{to.toLocaleString('az-AZ')} / {total.toLocaleString('az-AZ')}</span>
      <div>
        <button type="button" className="ak-icon-btn" aria-label="Əvvəlki səhifə" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <span className="ak-page-num">{page + 1} / {pages}</span>
        <button type="button" className="ak-icon-btn" aria-label="Növbəti səhifə" disabled={disabled || page >= pages - 1} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} className="rtl:rotate-180" /></button>
      </div>
    </nav>
  );
}
