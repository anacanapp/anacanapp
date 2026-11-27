import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ value: 'ios' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.value, isNativePlatform: () => platform.value !== 'web' } }));

import { effectiveGain, isIOSAudioPlatform, resumeIfNeeded, setAudioSessionType, setMediaSession } from './white-noise-audio';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';

class FakeGain { gain = { value: 1, setValueAtTime: vi.fn((v: number) => { this.gain.value = v; }) }; context = { currentTime: 0 }; connect = vi.fn(); }
class FakeContext {
  static instances: FakeContext[] = [];
  state = 'running'; destination = {}; sampleRate = 8000;
  gains: FakeGain[] = []; mediaSources: unknown[] = [];
  constructor() { FakeContext.instances.push(this); }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createMediaElementSource(el: unknown) { this.mediaSources.push(el); return { connect: vi.fn() }; }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), loop: false, buffer: null }; }
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => { this.state = 'closed'; return Promise.resolve(); });
  addEventListener = vi.fn();
}
class FakeAudio {
  static instances: FakeAudio[] = [];
  loop = false; volume = 1; paused = true; crossOrigin: string | null = null; private attrs: Record<string, string> = {};
  listeners: Record<string, () => void> = {};
  constructor(src?: string) { if (src) this.attrs.src = src; FakeAudio.instances.push(this); }
  set src(v: string) { this.attrs.src = v; } get src() { return this.attrs.src ?? ''; }
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  getAttribute(n: string) { return this.attrs[n] ?? null; }
  removeAttribute(n: string) { delete this.attrs[n]; }
  addEventListener(type: string, cb: () => void) { this.listeners[type] = cb; }
}

const sound = { id: 'rain', name: 'Rain', emoji: 'r', color: '#000', noiseType: 'white', audioUrl: 'https://cdn.example/rain.mp3' };

beforeEach(() => {
  FakeContext.instances = []; FakeAudio.instances = [];
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('Audio', FakeAudio);
  platform.value = 'ios';
});
afterEach(() => { useWhiteNoiseStore.getState().stop(); vi.unstubAllGlobals(); });

describe('white noise audio helpers', () => {
  it('detects iOS (native, iPhone UA, iPadOS desktop UA) and not Android/desktop', () => {
    expect(isIOSAudioPlatform('ios')).toBe(true);
    expect(isIOSAudioPlatform('android', { userAgent: 'iPhone', maxTouchPoints: 5 })).toBe(false);
    expect(isIOSAudioPlatform('web', { userAgent: 'Mozilla (iPhone; CPU iPhone OS 17_0)', maxTouchPoints: 5 })).toBe(true);
    expect(isIOSAudioPlatform('web', { userAgent: 'Mozilla (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isIOSAudioPlatform('web', { userAgent: 'Mozilla (Macintosh; Intel Mac OS X)', maxTouchPoints: 0 })).toBe(false);
  });

  it('maps volume and mute to a clamped gain', () => {
    expect(effectiveGain(70, false)).toBeCloseTo(0.7);
    expect(effectiveGain(70, true)).toBe(0);
    expect(effectiveGain(150, false)).toBe(1);
    expect(effectiveGain(Number.NaN, false)).toBe(0);
  });

  it('sets audioSession type where supported and ignores it elsewhere', () => {
    const nav = { audioSession: { type: 'auto' } };
    setAudioSessionType('playback', nav);
    expect(nav.audioSession.type).toBe('playback');
    expect(() => setAudioSessionType('playback', {})).not.toThrow();
  });

  it('resumes an interrupted context and a paused element', () => {
    const ctx = { state: 'interrupted', resume: vi.fn(() => Promise.resolve()) } as unknown as AudioContext;
    const audio = new FakeAudio('x');
    resumeIfNeeded(ctx, audio as unknown as HTMLAudioElement);
    expect((ctx as unknown as { resume: ReturnType<typeof vi.fn> }).resume).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalled();
    const closed = { state: 'closed', resume: vi.fn() } as unknown as AudioContext;
    resumeIfNeeded(closed, null);
    expect((closed as unknown as { resume: ReturnType<typeof vi.fn> }).resume).not.toHaveBeenCalled();
  });

  it('wires lock screen pause/stop to the stop callback', () => {
    const handlers: Record<string, (() => void) | null> = {};
    const nav = { mediaSession: { metadata: null as unknown, playbackState: 'none', setActionHandler: (a: string, h: (() => void) | null) => { handlers[a] = h; } } };
    const onStop = vi.fn();
    setMediaSession({ title: 'Rain', artist: 'Anacan' }, onStop, nav);
    expect(nav.mediaSession.playbackState).toBe('playing');
    handlers.pause?.();
    expect(onStop).toHaveBeenCalledOnce();
    setMediaSession(null, onStop, nav);
    expect(handlers.pause).toBeNull();
  });
});

describe('white noise store volume routing', () => {
  it('on iOS routes a streamed sound through a GainNode and the slider changes the gain', () => {
    useWhiteNoiseStore.getState().setVolume(50);
    useWhiteNoiseStore.getState().play(sound);
    const ctx = FakeContext.instances[0];
    expect(ctx).toBeDefined();
    expect(ctx.mediaSources).toHaveLength(1);
    expect(FakeAudio.instances[0].crossOrigin).toBe('anonymous');
    const gain = ctx.gains[0];
    expect(gain.gain.value).toBeCloseTo(0.5);
    useWhiteNoiseStore.getState().setVolume(20);
    expect(gain.gain.value).toBeCloseTo(0.2);
    useWhiteNoiseStore.getState().setMuted(true);
    expect(gain.gain.value).toBe(0);
    useWhiteNoiseStore.getState().setMuted(false);
    useWhiteNoiseStore.getState().stop();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('falls back to plain playback when the file cannot be loaded cross-origin', () => {
    useWhiteNoiseStore.getState().play(sound);
    const routed = FakeAudio.instances[0];
    routed.listeners.error?.();
    const plain = FakeAudio.instances[1];
    expect(plain).toBeDefined();
    expect(plain.play).toHaveBeenCalled();
    expect(useWhiteNoiseStore.getState()._audioElement).toBe(plain);
    expect(useWhiteNoiseStore.getState()._audioContext).toBeNull();
  });

  it('keeps plain element playback on Android (no Web Audio for streamed sounds)', () => {
    platform.value = 'android';
    useWhiteNoiseStore.getState().setVolume(40);
    useWhiteNoiseStore.getState().play(sound);
    expect(FakeContext.instances).toHaveLength(0);
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.4);
  });
});
