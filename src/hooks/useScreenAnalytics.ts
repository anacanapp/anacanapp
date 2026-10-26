import { useEffect } from 'react';
import type { AnalyticsEvent, AnalyticsParams } from '@/lib/analytics';
import { registerAnalyticsScreen } from '@/lib/analytics-screen';

/**
 * Auto-track screen view on mount. Use in every screen/tool component.
 */
export const useScreenAnalytics = (screenName: string, screenClass?: string) => {
  useEffect(() => {
    const release = registerAnalyticsScreen(screenName, screenClass || screenName);
    import('@/lib/analytics').then(m => 
      m.analytics.logScreenView(screenName, screenClass || screenName)
    ).catch(() => {});
    // Mixpanel page view
    import('@/lib/mixpanel').then(({ trackPageView }) => {
      trackPageView(screenName, { screen_class: screenClass || screenName });
    }).catch(() => {});
    return release;
  }, [screenName, screenClass]);
};

/**
 * Fire-and-forget analytics event (non-blocking, safe to call anywhere).
 */
export const trackEvent = (eventName: string, params?: Record<string, string | number | boolean | undefined>) => {
  import('@/lib/analytics').then(m => m.logEvent(eventName as any, params)).catch(() => {});
};
