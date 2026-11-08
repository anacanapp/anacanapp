import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DailyLog } from '@/hooks/useDailyLogs';

const state = vi.hoisted(() => ({
  todayLog: null as DailyLog | null,
  addLog: vi.fn(async () => ({ data: {}, error: null })),
  listeners: new Set<() => void>(),
}));

vi.mock('@/hooks/useDailyLogs', async () => {
  const React = await import('react');
  return {
    useDailyLogs: () => {
      const [, force] = React.useReducer((n: number) => n + 1, 0);
      React.useEffect(() => { state.listeners.add(force); return () => { state.listeners.delete(force); }; }, []);
      return { logs: state.todayLog ? [state.todayLog] : [], todayLog: state.todayLog, loading: false, addLog: state.addLog };
    },
  };
});
vi.mock('@/hooks/useDynamicConfig', () => ({
  useMoodOptions: () => ({ data: [], isLoading: false }),
  useSymptoms: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/store/userStore', () => ({ useUserStore: (sel: (s: unknown) => unknown) => sel({ lifeStage: 'bump', language: 'az' }) }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {} } }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/components/MedicalDisclaimer', () => ({ default: () => null }));

import MoodDiary from './MoodDiary';
import { todayKey } from '@/lib/local-date';

const saved = (): DailyLog => ({
  id: 'l1', user_id: 'u', log_date: todayKey(), mood: 2, symptoms: ['nausea'], water_intake: 750, temperature: null,
  bleeding: 'spotting', notes: 'Səhər ürəkbulanma', created_at: '2026-11-08T00:00:00Z', sleep_hours: 7, sleep_quality: 3,
});
const publish = (log: DailyLog | null) => act(() => { state.todayLog = log; state.listeners.forEach((f) => f()); });

beforeEach(() => { localStorage.setItem('anacan-language', 'az'); state.todayLog = null; state.addLog.mockClear(); });
afterEach(cleanup);

describe('MoodDiary', () => {
  it('fills the form when today\'s entry loads after the first render, and saves a merge patch', async () => {
    render(<MoodDiary onBack={() => {}} />);
    const notes = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(notes.value).toBe('');

    publish(saved());
    await waitFor(() => expect(notes.value).toBe('Səhər ürəkbulanma'));

    fireEvent.click(screen.getByText('Yadda saxla'));
    await waitFor(() => expect(state.addLog).toHaveBeenCalledTimes(1));
    const patch = (state.addLog.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(patch).toEqual({ log_date: todayKey(), mood: 2, symptoms: ['nausea'], notes: 'Səhər ürəkbulanma', bleeding: 'spotting' });
    expect(patch).not.toHaveProperty('water_intake');
    expect(patch).not.toHaveProperty('sleep_hours');
  });

  it('does not overwrite what the user is typing when the entry arrives later', async () => {
    render(<MoodDiary onBack={() => {}} />);
    const notes = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: 'yeni qeyd' } });
    publish(saved());
    await act(async () => {});
    expect(notes.value).toBe('yeni qeyd');
  });
});
