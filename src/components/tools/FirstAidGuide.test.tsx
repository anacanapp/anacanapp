import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const state: { data: any; isLoading: boolean; isFetching: boolean; refetch: ReturnType<typeof vi.fn> } = {
  data: undefined, isLoading: false, isFetching: false, refetch: vi.fn(),
};

vi.mock('@/hooks/useFirstAid', () => ({ useFirstAidContent: () => state }));
vi.mock('@/hooks/useEmergencyNumber', () => ({ useEmergencyNumber: () => '103' }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/components/MedicalDisclaimer', () => ({ default: () => null }));

import FirstAidGuide from './FirstAidGuide';

beforeEach(() => {
  state.data = undefined;
  state.isLoading = false;
  state.isFetching = false;
  state.refetch = vi.fn();
});

describe('FirstAidGuide', () => {
  it('shows a call pill and retry instead of a blank screen when nothing is available', () => {
    render(<FirstAidGuide onBack={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const call = screen.getAllByRole('link').find((a) => a.getAttribute('href') === 'tel:103' && a.closest('[role="alert"]'));
    expect(call).toBeTruthy();
    fireEvent.click(screen.getByText('Yenidən cəhd et'));
    expect(state.refetch).toHaveBeenCalled();
  });

  it('opens any scenario from the cached bundle without a per-scenario fetch', async () => {
    state.data = {
      v: 1, language: 'az', savedAt: 1,
      scenarios: [{ id: 's1', title: 'Boğulma', description: 'd', icon: '🫁', color: null, emergency_level: 'critical' }],
      stepsByScenario: { s1: [{ id: 'a1', scenario_id: 's1', step_number: 1, title: 'Addım bir', instruction: 'Təlimat bir', duration_seconds: null, is_critical: false }] },
    };
    render(<FirstAidGuide onBack={() => {}} />);
    fireEvent.click(screen.getByText('Boğulma'));
    expect(await screen.findByText('Təlimat bir', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
