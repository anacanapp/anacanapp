import { useDailySummary } from '@/hooks/useDailySummary';

/**
 * Headless component that keeps the daily summary auto-synced with the partner
 * via the realtime subscriptions inside useDailySummary. No UI is rendered.
 */
const DailySummaryAutoSync = () => {
  useDailySummary();
  return null;
};

export default DailySummaryAutoSync;
