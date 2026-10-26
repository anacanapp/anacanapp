import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { GameEvent } from './game/model';

class GameAudio {
  private context?: AudioContext;
  private sound = false;
  private haptics = true;
  private lastPickup = 0;
  private lastHaptic = 0;

  configure(sound: boolean, haptics: boolean) { this.sound = sound; this.haptics = haptics; }

  unlock() {
    if (!this.sound) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch { /* Sound is optional when a browser blocks audio. */ }
  }

  private tone(frequency: number, duration: number, delay = 0, volume = 0.055, type: OscillatorType = 'sine') {
    if (!this.sound || !this.context || this.context.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(start); oscillator.stop(start + duration);
  }

  event(event: GameEvent) {
    const now = performance.now();
    if (event.type === 'pickup') {
      if (now - this.lastPickup > 65) {
        this.lastPickup = now;
        this.tone(event.kind === 'investment' ? 740 : 980, 0.09, 0, 0.03);
      }
      if (this.haptics && event.kind !== 'investment' && now - this.lastHaptic > 150 && Capacitor.isNativePlatform()) {
        this.lastHaptic = now; void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      }
    } else if (event.type === 'unlock' || event.type === 'acquisition') {
      [523, 659, 784].forEach((note, index) => this.tone(note, 0.18, index * 0.08));
      if (this.haptics && Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    } else if (event.type === 'result') {
      if (event.result.reason === 'quit') return;
      [330, 294, 220].forEach((note, index) => this.tone(note, .25, index * .13));
      if (this.haptics && Capacitor.isNativePlatform()) void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
    } else if (event.type === 'opportunity' || event.type === 'mission') {
      const audit = event.type === 'opportunity' && event.kind === 'audit';
      (audit ? [250, 190] : [523, 784, 1047]).forEach((note, index) => this.tone(note, .18, index * .07));
      if (this.haptics && Capacitor.isNativePlatform()) void Haptics.impact({ style: audit ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => undefined);
    }
  }
}

export const audio = new GameAudio();
