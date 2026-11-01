import { useHomeWidgetSync } from '@/hooks/useHomeWidgetSync';

/** Renders nothing; keeps the native home-screen widgets in sync while the app runs. */
export default function HomeWidgetSync() {
  useHomeWidgetSync();
  return null;
}
