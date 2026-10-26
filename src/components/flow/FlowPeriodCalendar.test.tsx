import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FlowPeriodCalendar from './FlowPeriodCalendar';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), logs: [] as any[] }));
vi.mock('@/hooks/usePeriodDayLogs', () => ({ usePeriodDayLogs: () => ({ data: mocks.logs }),
  useRecordPeriodDays: () => ({ mutate: mocks.mutate, isPending: false }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: selector => selector({ cycleLength: 28, periodLength: 5,
  getCycleData: () => ({ lastPeriodDate: new Date(2026, 8, 10) }) }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key, fallback) => fallback }));
vi.mock('@/lib/date-utils', () => ({ getCurrentDateLocale: () => undefined }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const el = tag => ({ initial, animate, exit, transition, whileTap, children, ...props }: any) => createElement(tag, props, children);
  return { motion: { div: el('div'), button: el('button') }, AnimatePresence: ({ children }) => children };
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 14, 12));
  mocks.mutate.mockReset(); mocks.logs = [{ id: 'day-12', log_date: '2026-09-12', flow_intensity: 'medium' }];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('opens an existing day for editing instead of deleting it on tap', () => {
  const view = render(<FlowPeriodCalendar />);
  fireEvent.click(view.container.querySelector('[data-date="2026-09-12"]')!);
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Güclü/ }));
  expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ flow: 'heavy' });
  expect(mocks.mutate.mock.calls[0][0].dates[0].getDate()).toBe(12);
});
it('records today as had flow without inventing an amount or more days', () => {
  render(<FlowPeriodCalendar />);
  fireEvent.click(screen.getByRole('button', { name: 'Bu gün axın oldu' }));
  expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ flow: 'unspecified' });
  expect(mocks.mutate.mock.calls[0][0].dates).toHaveLength(1);
  expect(mocks.mutate.mock.calls[0][0].dates[0].getDate()).toBe(14);
});
it('lets the user explicitly replace no-flow or clear a saved date', () => {
  mocks.logs.push({ id: 'day-14', log_date: '2026-09-14', flow_intensity: 'none' });
  const view = render(<FlowPeriodCalendar />);
  fireEvent.click(screen.getByRole('button', { name: 'Bu gün axın oldu' }));
  expect(mocks.mutate.mock.calls[0][0].preserveExisting).not.toBe(true);
  fireEvent.click(view.container.querySelector('[data-date="2026-09-12"]')!);
  fireEvent.click(screen.getByRole('button', { name: 'Bu günün qeydini sil' }));
  expect(mocks.mutate.mock.calls[1][0].flow).toBe('clear');
});
it('disables future observations and distinguishes no-flow from recorded period days', () => {
  mocks.logs.push({ id: 'none', log_date: '2026-09-13', flow_intensity: 'none' });
  const view = render(<FlowPeriodCalendar />);
  expect(view.container.querySelector('[data-date="2026-09-15"]')).toBeDisabled();
  expect(view.container.querySelector('[data-date="2026-09-12"]')).toHaveAttribute('aria-pressed', 'true');
  expect(view.container.querySelector('[data-date="2026-09-13"]')).toHaveAttribute('aria-pressed', 'false');
});
it('offers Mommy observation-only tracking without fertile/predicted days or a module change', () => {
 const view=render(<FlowPeriodCalendar trackingOnly fromDate="2026-09-11" />);
 expect(screen.queryByText('Məhsuldar')).not.toBeInTheDocument();expect(screen.queryByText('Proqnoz')).not.toBeInTheDocument();expect(view.container.querySelector('[data-date="2026-09-10"]')).toBeDisabled();
 fireEvent.click(view.container.querySelector('[data-date="2026-09-12"]')!);fireEvent.click(screen.getByRole('button',{name:/Yüngül/}));expect(mocks.mutate.mock.calls[0][0]).toMatchObject({flow:'light'});
 expect(mocks.mutate.mock.calls[0][0]).not.toHaveProperty('life_stage');
});
