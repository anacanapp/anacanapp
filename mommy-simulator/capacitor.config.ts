import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atlasoon.mommysimulator',
  appName: 'Mommy Simulator',
  webDir: 'dist',
  backgroundColor: '#edf0e4',
  ios: { contentInset: 'never', preferredContentMode: 'mobile', backgroundColor: '#edf0e4' },
  android: { backgroundColor: '#edf0e4', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#edf0e4', showSpinner: false },
    StatusBar: { overlaysWebView: true, style: 'LIGHT', backgroundColor: '#edf0e4' },
    Keyboard: { resize: 'none' },
  },
};

export default config;
