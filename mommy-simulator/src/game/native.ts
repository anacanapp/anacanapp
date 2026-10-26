import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { GameState } from './types';

export function haptic(success = false) {
  if (!Capacitor.isNativePlatform()) return;
  void (success ? Haptics.notification({ type: NotificationType.Success }) : Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
}

export async function sharePhoto(data: string) {
  if (Capacitor.isNativePlatform()) {
    const name = `mommy-memory-${Date.now()}.jpg`;
    const file = await Filesystem.writeFile({ path: name, data: data.split(',')[1], directory: Directory.Cache });
    await Share.share({ title: 'Mommy Simulator · Anacan', files: [file.uri], dialogTitle: 'Mommy Simulator' });
  } else {
    const blob = await (await fetch(data)).blob(), file = new File([blob], 'mommy-memory.jpg', { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mommy Simulator · Anacan' });
    else { const a = document.createElement('a'); a.href = data; a.download = 'mommy-memory.jpg'; a.click(); }
  }
}

export async function exportNativeSave(state: GameState) {
  const file = await Filesystem.writeFile({ path: `mommy-save-day-${state.day}.json`, data: JSON.stringify(state, null, 2),
    directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Mommy Simulator save', files: [file.uri] });
}
