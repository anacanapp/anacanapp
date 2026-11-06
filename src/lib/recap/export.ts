/**
 * Anacan Recap — browser side: assets, fonts, recording the MP4/WebM, the summary PNG and sharing.
 * The frames come from renderRecapFrame (the same function the demo pipeline renders offline).
 *
 * Recording: canvas.captureStream(30) + the music through WebAudio (MediaStreamAudioDestinationNode) into
 * MediaRecorder (video/mp4 first — Safari / iOS WKWebView — then WebM). The frame drawn is chosen by the
 * audio clock, so picture and music stay in sync however fast the device is; the recording takes as long as
 * the video (~52 s).
 */
import { Capacitor } from '@capacitor/core';
import { renderRecapFrame, summaryStillTime, RECAP_FPS, RECAP_H, RECAP_W, type RecapAssets } from './render';
import type { RecapModel } from './types';

export const RECAP_MUSIC_URL = '/recap/recap-2026.mp3';

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function grainTile(): HTMLCanvasElement {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = c.getContext('2d');
  if (!g) return c;
  const img = g.createImageData(256, 256);
  let a = 1234567;
  for (let i = 0; i < img.data.length; i += 4) {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    const v = a >>> 24;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Fonts first (Nunito from the app's stylesheet), then the real Anacan marks. Never throws. */
export async function loadRecapAssets(rtl = false): Promise<RecapAssets> {
  try {
    const fonts = document.fonts;
    if (fonts?.load) {
      const family = rtl ? 'Noto Sans Arabic' : 'Nunito';
      await Promise.race([
        Promise.all(['700', '800', '900'].map((w) => fonts.load(`${w} 64px ${family}`, 'Aə2026'))).then(() => fonts.ready),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    }
  } catch { /* system font fallback */ }
  const [logoWhite, logoCoral] = await Promise.all([loadImage('/brand-mark-white.png'), loadImage('/brand-mark-coral.png')]);
  return { logoWhite, logoCoral, grain: grainTile() };
}

export const recordingSupported = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

// Safari rejects a video-only codec string for a stream with audio, so each type is tried for real.
const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export class RecapExportError extends Error {
  constructor(readonly code: string, cause?: unknown) {
    super(code);
    this.name = 'RecapExportError';
    if (cause) console.error(`[recap-export] ${code}`, cause);
  }
}

/**
 * Records the whole video. Call it straight from a tap (the AudioContext is created synchronously,
 * before the first await, so iOS lets it play).
 */
export async function recordRecapVideo(model: RecapModel, assets: RecapAssets, opts: { musicUrl?: string; onProgress?: (p: number) => void; signal?: AbortSignal } = {}): Promise<Blob> {
  if (!recordingSupported()) throw new RecapExportError('UNSUPPORTED');
  let audio: AudioContext | null = null;
  try { audio = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); void audio.resume().catch(() => undefined); } catch { audio = null; }

  const canvas = Object.assign(document.createElement('canvas'), { width: RECAP_W, height: RECAP_H });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RecapExportError('CANVAS');
  renderRecapFrame(ctx, 0, model, assets);
  const stream = canvas.captureStream(RECAP_FPS);

  let music: AudioBufferSourceNode | null = null;
  if (audio) {
    try {
      const dest = audio.createMediaStreamDestination();
      // A silent source from the first frame: some muxers drop the opening video while audio has no samples.
      const silence = audio.createConstantSource();
      silence.offset.value = 0;
      silence.connect(dest);
      silence.start();
      const res = await fetch(opts.musicUrl ?? RECAP_MUSIC_URL);
      const buffer = await audio.decodeAudioData(await res.arrayBuffer());
      music = audio.createBufferSource();
      music.buffer = buffer;
      const gain = audio.createGain();
      music.connect(gain).connect(dest);
      (music as AudioBufferSourceNode & { _gain?: GainNode })._gain = gain;
      dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch (error) { console.warn('[recap-export] music unavailable, recording without sound', error); music = null; }
  }

  const chunks: Blob[] = [];
  let recorder: MediaRecorder | null = null;
  let mimeType = '';
  const types = [...VIDEO_TYPES.filter((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }), ''];
  for (const withAudio of [true, false]) {
    const source = withAudio ? stream : new MediaStream(stream.getVideoTracks());
    for (const type of types) {
      try {
        const candidate = new MediaRecorder(source, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
        candidate.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        candidate.start(500);
        recorder = candidate;
        mimeType = type;
        break;
      } catch { /* next format */ }
    }
    if (recorder) break;
  }
  const cleanup = () => { stream.getTracks().forEach((t) => t.stop()); try { music?.stop(); } catch { /* not started */ } void audio?.close().catch(() => undefined); };
  if (!recorder) { cleanup(); throw new RecapExportError('RECORDER'); }
  const active = recorder;
  const done = new Promise<Blob>((resolve) => {
    active.onstop = () => resolve(new Blob(chunks, { type: (active.mimeType || mimeType || 'video/webm').split(';')[0] }));
  });

  // Let the recorder settle on the first frame, then start the music and the clock together.
  await new Promise((r) => setTimeout(r, 400));
  const lead = 0.08;
  const t0 = audio ? audio.currentTime + lead : 0;
  const p0 = performance.now() + lead * 1000;
  if (music && audio) {
    const gain = (music as AudioBufferSourceNode & { _gain?: GainNode })._gain!;
    gain.gain.setValueAtTime(1, t0 + model.fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + model.duration);
    music.start(t0);
  }
  const clock = () => (audio && audio.state === 'running' ? audio.currentTime - t0 : (performance.now() - p0) / 1000);
  let aborted = false;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (opts.signal?.aborted) { aborted = true; resolve(); return; }
      const t = clock();
      if (t >= model.duration) { renderRecapFrame(ctx, model.duration, model, assets); resolve(); return; }
      renderRecapFrame(ctx, Math.max(0, t), model, assets);
      opts.onProgress?.(Math.max(0, Math.min(1, t / model.duration)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((r) => setTimeout(r, 250));
  active.stop();
  const blob = await done;
  cleanup();
  if (aborted) throw new RecapExportError('ABORTED');
  if (!blob.size) throw new RecapExportError('EMPTY');
  return blob;
}

/** The summary card as a PNG (the "share as image" fallback). */
export async function renderRecapImage(model: RecapModel, assets: RecapAssets): Promise<Blob> {
  const canvas = Object.assign(document.createElement('canvas'), { width: RECAP_W, height: RECAP_H });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RecapExportError('CANVAS');
  renderRecapFrame(ctx, summaryStillTime(model), model, assets);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new RecapExportError('PNG'))), 'image/png'));
}

const extOf = (blob: Blob) => (blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : blob.type.includes('png') ? 'png' : 'jpg');
const isCancelled = (error: unknown) => {
  const value = error as { name?: string; message?: string };
  return value?.name === 'AbortError' || /cancel/i.test(value?.message || '');
};

export function downloadRecap(blob: Blob, baseName: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${baseName}.${extOf(blob)}` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Native (iOS/Android): write to the cache and open the share sheet (Instagram, TikTok, WhatsApp, Save Video).
 * Web: Web Share with files where available, otherwise a download.
 */
export async function shareRecap(blob: Blob, baseName: string, text: string, mode: 'share' | 'download' = 'share'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = `${baseName}.${extOf(blob)}`;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    let uri: string;
    try { uri = (await Filesystem.writeFile({ path: `recap/${name}`, directory: Directory.Cache, data, recursive: true })).uri; } catch (error) { throw new RecapExportError('SAVE_FILE', error); }
    try { await Share.share({ title: name, text, files: [uri] }); return 'shared'; } catch (error) {
      if (isCancelled(error)) return 'cancelled';
      throw new RecapExportError('SHARE_SHEET', error);
    }
  }
  if (mode === 'share') {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return 'shared'; } catch (error) { if (isCancelled(error)) return 'cancelled'; }
    }
  }
  downloadRecap(blob, baseName);
  return 'downloaded';
}
