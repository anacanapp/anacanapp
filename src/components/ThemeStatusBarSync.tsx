import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';

// Tətbiqdaxili tema sistem temasından fərqli olanda status bar ikonları fonla eyni
// rəngdə qalıb görünməz olurdu. Status bar stili və theme-color temaya uyğunlaşdırılır.
export default function ThemeStatusBarSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const dark = resolvedTheme === 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161922' : '#faf7f4');
    if (!Capacitor.isNativePlatform()) return;
    void import('@capacitor/status-bar')
      // Style.Dark = açıq ikonlar (qaranlıq fon üçün), Style.Light = tünd ikonlar
      .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
      .catch(() => {});
  }, [resolvedTheme]);
  return null;
}
