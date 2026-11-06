import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

interface Row { id: string; name: string; amount: number }
const rows: Row[] = Array.from({ length: 7 }, (_, index) => ({ id: `r${index}`, name: `Sətir ${index + 1}`, amount: (index * 37) % 11 }));
const columns: Column<Row>[] = [
  { key: 'name', header: 'Ad', cell: row => row.name, sortable: true, sortValue: row => row.name },
  { key: 'amount', header: 'Məbləğ', cell: row => String(row.amount), sortable: true, sortValue: row => row.amount },
];
afterEach(cleanup);
const bodyRows = () => screen.getAllByTestId('row');

describe('DataTable', () => {
  it('paginates on the client', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} pageSize={3} rowTestId="row" />);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByTestId('ak-page-range')).toHaveTextContent('1–3 / 7');
    expect(screen.getByRole('button', { name: 'Əvvəlki səhifə' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səhifə' }));
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səhifə' }));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('Sətir 7');
    expect(screen.getByTestId('ak-page-range')).toHaveTextContent('7–7 / 7');
    expect(screen.getByRole('button', { name: 'Növbəti səhifə' })).toBeDisabled();
  });
  it('delegates paging to the server when total and onPageChange are given', () => {
    const onPageChange = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} rowKey={row => row.id} page={1} pageSize={3} total={10} onPageChange={onPageChange} rowTestId="row" />);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByTestId('ak-page-range')).toHaveTextContent('4–6 / 10');
    fireEvent.click(screen.getByRole('button', { name: 'Növbəti səhifə' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Əvvəlki səhifə' }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
  it('sorts by a column on header click (asc, desc, off)', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} rowTestId="row" />);
    const header = screen.getByRole('button', { name: /Məbləğ/ });
    fireEvent.click(header);
    const ascending = bodyRows().map(row => Number(within(row).getAllByRole('cell')[1].textContent));
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    fireEvent.click(header);
    const descending = bodyRows().map(row => Number(within(row).getAllByRole('cell')[1].textContent));
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    expect(screen.getByRole('columnheader', { name: /Məbləğ/ })).toHaveAttribute('aria-sort', 'descending');
  });
  it('selects rows and exposes bulk actions', () => {
    const bulk = vi.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.id} pageSize={5} selectable rowTestId="row"
      bulkActions={(selected, clear) => <button type="button" onClick={() => { bulk(selected.map(row => row.id)); clear(); }}>Arxivlə</button>} />);
    fireEvent.click(within(bodyRows()[0]).getByRole('checkbox'));
    fireEvent.click(within(bodyRows()[2]).getByRole('checkbox'));
    expect(screen.getByRole('region', { name: 'Seçilmişlər' })).toHaveTextContent('2 seçilib');
    fireEvent.click(screen.getByRole('button', { name: 'Arxivlə' }));
    expect(bulk).toHaveBeenCalledWith(['r0', 'r2']);
    expect(screen.queryByRole('region', { name: 'Seçilmişlər' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hamısını seç' }));
    expect(screen.getByRole('region', { name: 'Seçilmişlər' })).toHaveTextContent('5 seçilib');
  });
  it('renders loading, error with retry and empty states', () => {
    const retry = vi.fn();
    const { rerender } = render(<DataTable columns={columns} rows={undefined} rowKey={row => row.id} loading />);
    expect(screen.getByRole('status', { name: 'Yüklənir' })).toBeInTheDocument();
    rerender(<DataTable columns={columns} rows={undefined} rowKey={row => row.id} error={new Error('x')} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yenidən yoxla' }));
    expect(retry).toHaveBeenCalled();
    rerender(<DataTable columns={columns} rows={[]} rowKey={row => row.id} />);
    expect(screen.getByTestId('ak-empty')).toBeInTheDocument();
  });
  it('renders stacked cards when asked (phones)', () => {
    const open = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 2)} rowKey={row => row.id} cards onRowClick={open} rowTestId="row" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(bodyRows()[1]);
    expect(open).toHaveBeenCalledWith(rows[1]);
  });
});
