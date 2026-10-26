import { Capacitor } from '@capacitor/core';
import { readCustomerIoConfig } from './customerio-config';
import { createCustomerIoTracking } from './customerio-tracking';
import { currentAnalyticsScreen } from './analytics-screen';

const config = Capacitor.isNativePlatform() ? readCustomerIoConfig({
  VITE_CUSTOMERIO_ENABLED: import.meta.env.VITE_CUSTOMERIO_ENABLED,
  VITE_CUSTOMERIO_ENVIRONMENT: import.meta.env.VITE_CUSTOMERIO_ENVIRONMENT,
  VITE_CUSTOMERIO_REGION: import.meta.env.VITE_CUSTOMERIO_REGION,
}) : null;
export const customerIoEnabled = config !== null;
export const customerIo = createCustomerIoTracking(config, async () => {
  if (!Capacitor.isPluginAvailable('CustomerIoDataIn')) throw new Error('CUSTOMERIO_NATIVE_PLUGIN_REQUIRED');
  return (await import('@anacan/customerio-data-in')).CustomerIoDataIn;
}, currentAnalyticsScreen);

export const CUSTOMER_IO_CONSENT_EVENT = 'anacan:analytics-consent-changed';
