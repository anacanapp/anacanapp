/**
 * Shareable "Körpəmdən mesajlar" media: a 1080×1920 photo of the chat, or a video where the
 * messages arrive one by one (hook → typing → bubbles with a soft pop → Anacan end card).
 * Drawn on a canvas; the video is recorded with MediaRecorder (mp4 where supported, else webm).
 */
import { Capacitor } from '@capacitor/core';
import type { BabyChatMessage, BabyChatText } from '@/lib/baby-chat';

export interface ShareChatInput {
  messages: BabyChatMessage[];
  text: BabyChatText;
  subtitle: string;
  chip: string | null;
  dayLabel: string;
  rtl: boolean;
}

const W = 1080;
const H = 1920;
const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const C = { bg1: '#FFF1EC', bg2: '#FDDDD6', ink: '#2B2326', soft: '#8A7A7E', coral: '#FF5A5F', white: '#FFFFFF', lav: '#E9DDFB', chip: '#FFE3DF' };

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (ctx.measureText(next).width <= max || !line.trim()) line = next;
      else { lines.push(line.trim()); line = word.trimStart(); }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines.length ? lines : [''];
}

const BUBBLE = { font: `500 46px ${FONT}`, line: 60, padX: 38, padY: 26, max: 740, gap: 20 };

function bubbleSize(ctx: CanvasRenderingContext2D, msg: BabyChatMessage) {
  ctx.font = BUBBLE.font;
  const lines = wrap(ctx, msg.text, BUBBLE.max - BUBBLE.padX * 2);
  const width = Math.min(BUBBLE.max, Math.max(...lines.map((l) => ctx.measureText(l).width)) + BUBBLE.padX * 2);
  return { lines, width, height: lines.length * BUBBLE.line + BUBBLE.padY * 2 };
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D, input: ShareChatInput, typing: boolean) {
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(0, 0, W, 230);
  ctx.fillStyle = C.lav;
  ctx.beginPath(); ctx.arc(130, 140, 62, 0, Math.PI * 2); ctx.fill();
  ctx.font = `64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('👶', 130, 144);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.font = `800 52px ${FONT}`;
  ctx.fillText(`${input.text.ui.title} 💛`, 220, 128);
  ctx.fillStyle = typing ? C.coral : C.soft; ctx.font = `500 36px ${FONT}`;
  ctx.fillText(typing ? input.text.ui.typing : input.subtitle, 220, 182);
  if (input.chip) {
    ctx.font = `700 36px ${FONT}`;
    const w = ctx.measureText(input.chip).width + 92;
    roundRect(ctx, W - 60 - w, 104, w, 72, 36); ctx.fillStyle = C.chip; ctx.fill();
    ctx.fillStyle = '#3BB273'; ctx.beginPath(); ctx.arc(W - 60 - w + 40, 140, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.coral; ctx.fillText(input.chip, W - 60 - w + 66, 153);
  }
}

function drawInput(ctx: CanvasRenderingContext2D, input: ShareChatInput, draft = '') {
  roundRect(ctx, 50, H - 230, W - 210, 104, 52); ctx.fillStyle = C.white; ctx.fill();
  ctx.font = `500 40px ${FONT}`; ctx.fillStyle = draft ? C.ink : '#B9AAAD';
  ctx.fillText(draft ? `${draft}|` : input.text.ui.placeholder, 96, H - 164);
  ctx.fillStyle = draft ? C.coral : C.chip; ctx.beginPath(); ctx.arc(W - 100, H - 178, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = draft ? C.white : C.coral; ctx.font = `700 46px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('➤', W - 96, H - 162); ctx.textAlign = 'left';
  ctx.fillStyle = C.soft; ctx.font = `600 30px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`Anacan · ${input.text.ui.end_line1} ${input.text.ui.end_line2}`, W / 2, H - 62); ctx.textAlign = 'left';
}

/** Chat body: shown bubbles (the last one may be scaling in) and an optional typing bubble. */
function drawChat(ctx: CanvasRenderingContext2D, input: ShareChatInput, shown: BabyChatMessage[], opts: { pop?: number; typing?: number | null; draft?: string } = {}) {
  drawBackground(ctx);
  drawHeader(ctx, input, opts.typing != null);
  const sizes = shown.map((m) => bubbleSize(ctx, m));
  const typingH = opts.typing != null ? 104 : 0;
  const bottom = H - 270;
  let y = bottom - typingH - sizes.reduce((s, b) => s + b.height + BUBBLE.gap, 0);
  // Day chip above the first bubble (kept below the header).
  ctx.font = `600 32px ${FONT}`;
  const chipW = ctx.measureText(input.dayLabel).width + 56;
  const chipY = Math.max(270, y - 100);
  roundRect(ctx, (W - chipW) / 2, chipY, chipW, 60, 30); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  ctx.fillStyle = C.soft; ctx.textAlign = 'center'; ctx.fillText(input.dayLabel, W / 2, chipY + 41); ctx.textAlign = 'left';
  y = Math.max(y, chipY + 90);
  shown.forEach((msg, i) => {
    const b = sizes[i];
    const mine = msg.from === 'mom';
    const leftSide = mine === input.rtl;
    const x = leftSide ? 50 : W - 50 - b.width;
    const scale = i === shown.length - 1 && opts.pop != null ? 0.85 + 0.15 * Math.min(1, opts.pop) : 1;
    ctx.save();
    ctx.globalAlpha = i === shown.length - 1 && opts.pop != null ? Math.min(1, opts.pop * 1.6) : 1;
    ctx.translate(x + (leftSide ? 0 : b.width), y + b.height);
    ctx.scale(scale, scale);
    ctx.translate(-(leftSide ? 0 : b.width), -b.height);
    roundRect(ctx, 0, 0, b.width, b.height, 44);
    ctx.fillStyle = mine ? C.coral : C.white; ctx.shadowColor = 'rgba(160,80,80,0.12)'; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = mine ? C.white : C.ink; ctx.font = BUBBLE.font;
    ctx.textAlign = input.rtl ? 'right' : 'left';
    b.lines.forEach((line, li) => ctx.fillText(line, input.rtl ? b.width - BUBBLE.padX : BUBBLE.padX, BUBBLE.padY + 45 + li * BUBBLE.line));
    ctx.textAlign = 'left';
    ctx.restore();
    y += b.height + BUBBLE.gap;
  });
  if (opts.typing != null) {
    const x = input.rtl ? W - 50 - 170 : 50;
    roundRect(ctx, x, y, 170, 84, 42); ctx.fillStyle = C.white; ctx.fill();
    for (let d = 0; d < 3; d++) {
      const phase = Math.sin(opts.typing * 7 - d * 0.9);
      ctx.fillStyle = `rgba(138,122,126,${0.45 + 0.35 * (phase + 1) / 2})`;
      ctx.beginPath(); ctx.arc(x + 50 + d * 35, y + 42 - 6 * Math.max(0, phase), 11, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawInput(ctx, input, opts.draft);
}

function drawHook(ctx: CanvasRenderingContext2D, input: ShareChatInput, t: number) {
  drawBackground(ctx);
  const notif = input.messages.find((m) => m.from === 'baby');
  const a = Math.min(1, t * 2.5);
  ctx.globalAlpha = a;
  roundRect(ctx, 60, 300, W - 120, 170, 44); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  ctx.fillStyle = C.ink; ctx.font = `700 40px ${FONT}`; ctx.fillText(input.text.ui.notif_title, 110, 370);
  ctx.fillStyle = C.soft; ctx.font = `500 38px ${FONT}`; ctx.fillText((notif?.text || '').slice(0, 34), 110, 428);
  ctx.globalAlpha = Math.min(1, Math.max(0, t * 2 - 0.4));
  ctx.fillStyle = C.ink; ctx.font = `900 88px ${FONT}`; ctx.textAlign = 'center';
  wrap(ctx, input.text.ui.hook, W - 160).forEach((line, i) => ctx.fillText(line, W / 2, 900 + i * 104));
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

function drawEnd(ctx: CanvasRenderingContext2D, input: ShareChatInput, t: number, logo: HTMLImageElement | null) {
  drawBackground(ctx);
  ctx.globalAlpha = Math.min(1, t * 3);
  roundRect(ctx, W / 2 - 110, 560, 220, 220, 56); ctx.fillStyle = C.white; ctx.fill();
  if (logo) ctx.drawImage(logo, W / 2 - 80, 590, 160, 160);
  ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = `900 92px ${FONT}`;
  ctx.fillText(input.text.ui.end_line1, W / 2, 940);
  ctx.fillStyle = C.coral; ctx.fillText(input.text.ui.end_line2, W / 2, 1046);
  ctx.font = `900 120px ${FONT}`; ctx.fillText('Anacan', W / 2, 1230);
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

const loadLogo = () => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = '/brand-mark.png';
});

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('CANVAS_EMPTY'))), type, quality));

export async function renderChatPhoto(input: ShareChatInput): Promise<Blob> {
  await document.fonts?.ready;
  try {
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    drawChat(canvas.getContext('2d')!, input, input.messages.slice(-8));
    return await canvasBlob(canvas, 'image/jpeg', 0.92);
  } catch (error) { throw new ShareError('PHOTO', error); }
}

export const videoRecordingSupported = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

// Audio+video first. Safari rejects a video-only codec string for a stream that has audio,
// so each type is tried for real (constructor and start), then without the audio track.
const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

/** A stage-tagged failure, shown with the error message so a device problem can be traced. */
export class ShareError extends Error {
  constructor(readonly code: string, cause?: unknown) {
    super(code);
    this.name = 'ShareError';
    if (cause) console.error(`[baby-chat-share] ${code}`, cause);
  }
}

/** Plays the chat into a canvas in real time and records it. */
export async function renderChatVideo(input: ShareChatInput, onProgress?: (p: number) => void): Promise<Blob> {
  await document.fonts?.ready;
  const logo = await loadLogo();
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d')!;
  const messages = input.messages.slice(-8);

  // Timeline (seconds)
  type Step = { start: number; end: number; draw: (t: number) => void; sound?: boolean };
  const steps: Step[] = [];
  let time = 0;
  const add = (duration: number, draw: (t: number) => void, sound = false) => { steps.push({ start: time, end: time + duration, draw, sound }); time += duration; };
  add(2.2, (t) => drawHook(ctx, input, t));
  messages.forEach((msg, i) => {
    const before = messages.slice(0, i);
    if (msg.from === 'baby') add(1.1, (t) => drawChat(ctx, input, before, { typing: t * 1.1 }));
    else add(1.0, (t) => drawChat(ctx, input, before, { draft: msg.text.slice(0, Math.ceil(msg.text.length * Math.min(1, t * 1.2))) }));
    add(Math.min(2.6, 1.0 + msg.text.length * 0.035), (t) => drawChat(ctx, input, messages.slice(0, i + 1), { pop: t * 4 }), true);
  });
  add(2.6, (t) => drawEnd(ctx, input, t, logo));
  const total = time;

  const stream = canvas.captureStream(30);
  let audio: AudioContext | null = null;
  try {
    audio = new AudioContext();
    void audio.resume().catch(() => undefined);
    const dest = audio.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    // A silent source from the first frame: an audio track without samples makes some muxers drop the opening video.
    const silence = audio.createConstantSource();
    silence.offset.value = 0;
    silence.connect(dest);
    silence.start();
    (stream as MediaStream & { _dest?: AudioNode })._dest = dest;
  } catch { audio = null; }
  const pop = () => {
    if (!audio) return;
    const dest = (stream as MediaStream & { _dest?: AudioNode })._dest!;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audio.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
    osc.connect(gain).connect(dest);
    osc.start(); osc.stop(audio.currentTime + 0.2);
  };

  const chunks: Blob[] = [];
  let recorder: MediaRecorder | null = null;
  let mimeType = '';
  steps[0].draw(0);
  const types = [...VIDEO_TYPES.filter((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }), ''];
  for (const withAudio of [true, false]) {
    const source = withAudio ? stream : new MediaStream(stream.getVideoTracks());
    for (const type of types) {
      try {
        const candidate = new MediaRecorder(source, type ? { mimeType: type } : undefined);
        candidate.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        candidate.start(250);
        recorder = candidate;
        mimeType = type;
        break;
      } catch { /* try the next format */ }
    }
    if (recorder) break;
  }
  if (!recorder) { stream.getTracks().forEach((t) => t.stop()); void audio?.close(); throw new ShareError('VIDEO_RECORDER'); }
  const active = recorder;
  const done = new Promise<Blob>((resolve) => {
    active.onstop = () => resolve(new Blob(chunks, { type: (active.mimeType || mimeType || 'video/webm').split(';')[0] }));
  });

  // Start the clock only once the recorder really runs, so the hook is not cut off.
  steps[0].draw(0);
  const keepAlive = window.setInterval(() => steps[0].draw(0), 50);
  await new Promise((r) => setTimeout(r, 500));
  window.clearInterval(keepAlive);
  const started = performance.now();
  const sounded = new Set<number>();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const now = (performance.now() - started) / 1000;
      const index = steps.findIndex((s) => now < s.end);
      if (index === -1) { resolve(); return; }
      const step = steps[index];
      if (step.sound && !sounded.has(index)) { sounded.add(index); pop(); }
      step.draw((now - step.start) / (step.end - step.start));
      onProgress?.(Math.min(1, now / total));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  active.stop();
  const blob = await done;
  stream.getTracks().forEach((t) => t.stop());
  void audio?.close();
  if (!blob.size) throw new ShareError('VIDEO_EMPTY');
  return blob;
}

const isCancelled = (error: unknown) => {
  const value = error as { name?: string; message?: string };
  return value?.name === 'AbortError' || /cancel/i.test(value?.message || '');
};

/** Shares a rendered file: native share sheet, Web Share with files, or a download. */
export async function shareMedia(blob: Blob, baseName: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : 'jpg';
  const name = `${baseName}.${ext}`;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    let uri: string;
    try {
      uri = (await Filesystem.writeFile({ path: `baby-chat/${Date.now()}-${name}`, directory: Directory.Cache, data, recursive: true })).uri;
    } catch (error) { throw new ShareError('SAVE_FILE', error); }
    try {
      await Share.share({ title: name, files: [uri] });
      return 'shared';
    } catch (error) {
      if (isCancelled(error)) return 'cancelled';
      throw new ShareError('SHARE_SHEET', error);
    }
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (error) { if (isCancelled(error)) return 'cancelled'; }
  }
  downloadMedia(blob, baseName);
  return 'downloaded';
}

const extensionOf = (blob: Blob) => (blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : 'jpg');

/** Saves the file through the browser (web). On the native app the share sheet offers saving. */
export function downloadMedia(blob: Blob, baseName: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${baseName}.${extensionOf(blob)}` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const isNativeShare = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share');
