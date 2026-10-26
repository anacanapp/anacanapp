import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';

export async function prepareNative() {
  if (!Capacitor.isNativePlatform()) return;
  await StatusBar.hide().catch(() => undefined);
  await SplashScreen.hide().catch(() => undefined);
}

export function listenForAppState(callback: (active: boolean) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const listeners = [App.addListener('appStateChange', state => callback(state.isActive)), App.addListener('pause', () => callback(false))];
  return () => { for (const listener of listeners) void listener.then(handle => handle.remove()).catch(() => undefined); };
}

export function listenForBack(callback: () => void): () => void {
  if (Capacitor.getPlatform() !== 'android') return () => undefined;
  const listener = App.addListener('backButton', callback);
  return () => { void listener.then(handle => handle.remove()).catch(() => undefined); };
}
