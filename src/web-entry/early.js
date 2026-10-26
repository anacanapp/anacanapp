import { entryDecision } from './policy.mjs';
import { mountAppLauncher } from './launcher.ts';

// Runs before the consumer bundle. It shares the exact policy, localized copy
// and timeout behavior with the ordinary browser bootstrap, without an auth SDK.
const native = window.Capacitor;
const nativeView = native && typeof native.isNativePlatform === 'function' && native.isNativePlatform()
  || window.androidBridge || window.webkit?.messageHandlers?.bridge;
if (!nativeView && entryDecision(window.location.href) === 'launch') {
  window.__anacanLaunchHandled = true;
  document.documentElement.classList.add('anacan-launching');
  const show = () => mountAppLauncher();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
}
