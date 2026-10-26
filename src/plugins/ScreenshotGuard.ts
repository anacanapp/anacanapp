import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export interface ScreenshotGuardPlugin {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled?: boolean; secureSurface?: boolean }>;
  addListener(eventName: 'screenshotTaken', listener: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'captureChanged', listener: (event: { captured: boolean; protected?: boolean }) => void): Promise<PluginListenerHandle>;
}
export default registerPlugin<ScreenshotGuardPlugin>('ScreenshotGuard');
