import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export interface ScreenshotGuardPlugin {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled?: boolean; secureSurface?: boolean }>;
  /** Keeps the native privacy cover off while a system Face ID / passcode sheet is up (iOS). */
  setCurtainSuspended(options: { suspended: boolean }): Promise<{ suspended?: boolean }>;
  addListener(eventName: 'screenshotTaken', listener: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'captureChanged', listener: (event: { captured: boolean; protected?: boolean }) => void): Promise<PluginListenerHandle>;
}
export default registerPlugin<ScreenshotGuardPlugin>('ScreenshotGuard');
