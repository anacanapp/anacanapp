import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atlasoon.startupio',
  appName: 'startup.io',
  webDir: 'dist',
  backgroundColor: '#080f1c',
  loggingBehavior: 'debug',
  ios: { contentInset: 'never', preferredContentMode: 'mobile', backgroundColor: '#080f1c' },
  android: { backgroundColor: '#080f1c', allowMixedContent: false, webContentsDebuggingEnabled: false },
  plugins: {
    SystemBars: { hidden: true, style: 'DARK', insetsHandling: 'disable' },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 0, backgroundColor: '#080f1c', showSpinner: false },
    StatusBar: { overlaysWebView: true, style: 'DARK', backgroundColor: '#080f1c' },
  },
};

export default config;
