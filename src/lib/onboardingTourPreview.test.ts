import { describe, expect, it, vi } from 'vitest';
import { requestTourPreview, takePendingTourPreview, TOUR_PREVIEW_EVENT } from './onboardingTour';

describe('admin tour preview handoff', () => {
  it('keeps the request for a host that mounts later and hands it out once', () => {
    const seen = vi.fn();
    window.addEventListener(TOUR_PREVIEW_EVENT, seen);
    requestTourPreview(true);
    window.removeEventListener(TOUR_PREVIEW_EVENT, seen);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(takePendingTourPreview()).toEqual({ premium: true });
    expect(takePendingTourPreview()).toBeNull();
  });
});
