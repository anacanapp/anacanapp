import { Capacitor } from '@capacitor/core';

/**
 * iOS helpers for the white-noise player.
 *
 * - iOS ignores HTMLAudioElement.volume (always 1.0), so on iOS a streamed sound
 *   is routed element → MediaElementSource → GainNode and volume is set on the gain.
 * - WebKit puts pure Web Audio in the "ambient" session (muted by the silent
 *   switch, stops on lock). `navigator.audioSession.type = 'playback'` (iOS 16.4+)
 *   asks for the playback category while noise plays; AppDelegate also sets the
 *   app-level AVAudioSession category to .playback and Info.plist declares the
 *   `audio` background mode.
 * - A phone call / Siri / lock can suspend or "interrupt" the AudioContext;
 *   `resumeIfNeeded` brings it back when the page is visible again.
 */

export function isIOSAudioPlatform(
  platform: string = safePlatform(),
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): boolean {
  if (platform === 'ios') return true;
  if (platform === 'android' || !nav) return false;
  const ua = nav.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS reports a desktop Mac user agent.
  return /Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1;
}

function safePlatform(): string {
  try { return Capacitor.getPlatform(); } catch { return 'web'; }
}

type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
interface AudioSessionNavigator { audioSession?: { type: AudioSessionType } }

/** Ask WebKit for the playback category (silent switch / lock screen). No-op where unsupported. */
export function setAudioSessionType(type: AudioSessionType, nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): void {
  const session = (nav as AudioSessionNavigator | undefined)?.audioSession;
  if (!session) return;
  try { session.type = type; } catch { /* unsupported value */ }
}

/** Clamp a 0..100 UI volume (respecting mute) to a 0..1 gain. */
export function effectiveGain(volume: number, muted: boolean): number {
  if (muted || !Number.isFinite(volume)) return 0;
  return Math.min(1, Math.max(0, volume / 100));
}

export function setGain(gain: GainNode, value: number): void {
  try {
    gain.gain.setValueAtTime(value, gain.context.currentTime);
  } catch {
    gain.gain.value = value;
  }
}

/** Resume a suspended/interrupted context (and a paused element) while playback is wanted. */
export function resumeIfNeeded(ctx: AudioContext | null, audio: HTMLAudioElement | null): void {
  if (ctx && (ctx.state as string) !== 'running' && ctx.state !== 'closed') {
    ctx.resume().catch(() => {});
  }
  if (audio && audio.paused && audio.getAttribute?.('src')) {
    audio.play().catch(() => {});
  }
}

export interface MediaSessionInfo { title: string; artist: string }

/** Lock-screen / notification controls. Pause and stop both stop the noise. */
export function setMediaSession(info: MediaSessionInfo | null, onStop: () => void, nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): void {
  const session = (nav as { mediaSession?: MediaSession } | undefined)?.mediaSession;
  if (!session) return;
  try {
    if (!info) {
      session.metadata = null;
      session.playbackState = 'none';
      for (const action of ['pause', 'stop'] as MediaSessionAction[]) {
        try { session.setActionHandler(action, null); } catch { /* unsupported */ }
      }
      return;
    }
    const Metadata = (globalThis as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
    if (Metadata) session.metadata = new Metadata({ title: info.title, artist: info.artist });
    session.playbackState = 'playing';
    for (const action of ['pause', 'stop'] as MediaSessionAction[]) {
      try { session.setActionHandler(action, () => onStop()); } catch { /* unsupported */ }
    }
  } catch { /* media session is best-effort */ }
}
