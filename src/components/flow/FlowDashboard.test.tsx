import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FlowDashboard from './FlowDashboard';

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('@/lib/tr', () => ({ tr: (_key, fallback) => fallback }));
vi.mock('@/lib/tip-translations', () => ({ getTranslatedTip: value => value }));
vi.mock('@/lib/date-utils', () => ({ getCurrentDateLocale: () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: {} }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: selector => selector({ cycleLength: 28, periodLength: 5, language: 'az',
  getCycleData: () => ({ lastPeriodDate: new Date(2026, 8, 10) }) }) }));
vi.mock('@/hooks/usePeriodDayLogs', () => ({ useRecordPeriodDays: () => ({ mutateAsync: mocks.record }), usePeriodDayLogs: () => ({ data: [] }) }));
vi.mock('@/hooks/useCycleHistory', () => ({ useCycleHistory: () => ({ data: [] }) }));
vi.mock('@/hooks/useFlowDailyLogs', () => ({ useFlowDailyLogs: () => ({ data: [] }) }));
vi.mock('@/hooks/usePhaseTips', () => ({ usePhaseTips: () => ({ data: [], isLoading: false }),
  PHASE_INFO: Object.fromEntries(['menstrual','follicular','ovulation','luteal'].map(key => [key, { color: '#f00', emoji: '🩸', labelAz: key }])),
  CATEGORY_INFO: Object.fromEntries(['nutrition','exercise','selfcare','mood'].map(key => [key, { labelAz: key }])) }));
vi.mock('@/components/dashboard/WaterWidget', () => ({ default: () => <div data-testid="water">Water</div> }));
vi.mock('./FlowPeriodCalendar', () => ({ default: () => <div data-testid="calendar">Calendar</div> }));
vi.mock('./FlowDailyLogger', () => ({ default: () => null }));
vi.mock('./FlowMoodChart', () => ({ default: () => null }));
vi.mock('./FlowCycleStats', () => ({ default: () => null }));
vi.mock('./FlowRemindersCard', () => ({ default: () => null }));
vi.mock('./CycleTrendChart', () => ({ default: () => null }));
vi.mock('./CycleAnomalyBanner', () => ({ default: () => null }));
vi.mock('./PeriodDelayBanner', () => ({ default: () => null }));
vi.mock('./PillReminderCard', () => ({ default: () => null }));
vi.mock('./SymptomPatternReport', () => ({ default: () => null }));
vi.mock('./DailyStoryCards', () => ({ default: () => null }));
vi.mock('@/components/premium/PremiumGate', () => ({ default: ({ children }) => children }));
vi.mock('@/components/ui/calendar', () => ({ Calendar: props => <button onClick={() => props.onSelect(
  props.mode === 'multiple' ? [10,11,12,13,14].map(day => new Date(2026, 8, day)) : new Date(2026, 8, 14))}>Select five days</button> }));
vi.mock('@/components/ui/alert-dialog', () => {
  const div = ({ children }) => <div>{children}</div>;
  return { AlertDialog: ({ open, children }) => open ? <div>{children}</div> : null,
    AlertDialogAction: props => <button {...props} />, AlertDialogCancel: props => <button {...props} />,
    AlertDialogContent: div, AlertDialogDescription: div, AlertDialogFooter: div, AlertDialogHeader: div, AlertDialogTitle: div };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const el = tag => ({ initial, animate, exit, transition, whileTap, children, ...props }: any) => createElement(tag, props, children);
  return { motion: { div: el('div'), button: el('button') }, AnimatePresence: ({ children }) => children };
});
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 14, 12)); mocks.record.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it('places the period calendar immediately before water tracking', () => {
  render(<FlowDashboard />);
  const calendarSection = screen.getByTestId('calendar').parentElement!;
  expect(calendarSection.nextElementSibling).toContainElement(screen.getByTestId('water'));
});

it('submits all five chosen days as observations rather than a single start date', async () => {
  render(<FlowDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'Period günlərini qeyd et' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select five days' }));
  fireEvent.click(screen.getByRole('button', { name: 'Qeyd et' }));
  await waitFor(() => expect(mocks.record).toHaveBeenCalledTimes(1));
  expect(mocks.record.mock.calls[0][0]).toMatchObject({ flow: 'unspecified', preserveExisting: true });
  expect(mocks.record.mock.calls[0][0].dates.map(date => date.getDate())).toEqual([10,11,12,13,14]);
});
