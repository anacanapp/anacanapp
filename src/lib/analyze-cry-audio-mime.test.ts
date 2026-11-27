import { describe, expect, it } from 'vitest';
import { normalizeAudioMimeType } from '../../supabase/functions/analyze-cry/audio-mime';

describe('analyze-cry audio format', () => {
  it('keeps WebM for older apps that send no type', () => {
    expect(normalizeAudioMimeType(undefined)).toBe('audio/webm');
    expect(normalizeAudioMimeType(null)).toBe('audio/webm');
    expect(normalizeAudioMimeType('')).toBe('audio/webm');
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('accepts the native m4a and ogg recordings', () => {
    expect(normalizeAudioMimeType('audio/mp4')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/m4a')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/x-m4a')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('AUDIO/MP4; codecs=mp4a.40.2')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/ogg;codecs=opus')).toBe('audio/ogg');
    expect(normalizeAudioMimeType('audio/aac')).toBe('audio/aac');
    expect(normalizeAudioMimeType('audio/wav')).toBe('audio/wav');
  });

  it('refuses anything else', () => {
    expect(normalizeAudioMimeType('video/mp4')).toBeNull();
    expect(normalizeAudioMimeType('application/octet-stream')).toBeNull();
    expect(normalizeAudioMimeType(42)).toBeNull();
  });
});
