import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import AppLockScreen from './AppLockScreen';
import { isLockEnabled, markBackgrounded, shouldRelock, clearBackgroundMark } from '@/lib/appLock';

/**
 * App-səviyyəli kilid qapısı — App.tsx-də mount olunur.
 *  - Soyuq başlanğıcda kilid aktivdirsə → kilid ekranı
 *  - Arxa fonda 30 saniyədən çox qalıb qayıdanda → yenidən kilid
 * (native: @capacitor/app appStateChange; web fallback: visibilitychange)
 */

const AppLockGate = () => {
  const [locked, setLocked] = useState<boolean>(() => isLockEnabled());

  useEffect(() => {
    let removeListener: (() => void) | null = null;

    const handleBackground = () => markBackgrounded();
    const handleForeground = () => {
      if (shouldRelock()) {
        setLocked(true);
      } else {
        clearBackgroundMark();
      }
    };

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { App } = await import('@capacitor/app');
          const sub = await App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) handleForeground();else
            handleBackground();
          });
          removeListener = () => {sub.remove();};
        } catch (e) {
          console.warn('AppLockGate: appStateChange listener failed', e);
        }
      })();
    }

    // Web / webview fallback
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handleBackground();else
      handleForeground();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      removeListener?.();
    };
  }, []);

  if (!locked) return null;

  return <AppLockScreen onUnlock={() => setLocked(false)} />;
};

export default AppLockGate;
