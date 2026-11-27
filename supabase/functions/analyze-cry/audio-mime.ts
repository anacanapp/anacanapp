/**
 * The audio MIME type sent to the model. Older apps send no type (the web/Capacitor MediaRecorder WebM). Native
 * apps (Flutter 60.0+) record m4a (AAC) or Ogg/Opus; anything else is refused so a wrong container never reaches
 * the model.
 */
const AUDIO_MIME_TYPES: Record<string, string> = {
  'audio/webm': 'audio/webm',
  'audio/ogg': 'audio/ogg',
  'audio/opus': 'audio/ogg',
  'audio/mp4': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
};

/** Missing / empty → 'audio/webm'; a supported type (parameters such as `;codecs=opus` ignored) → its model type; else null. */
export function normalizeAudioMimeType(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return 'audio/webm';
  if (typeof value !== 'string') return null;
  const base = value.split(';')[0].trim().toLowerCase();
  return AUDIO_MIME_TYPES[base] ?? null;
}
