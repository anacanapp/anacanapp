import { tr } from '@/lib/tr';

let microphoneOpening = false;

export function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Microphone capture is unavailable', 'NotSupportedError');
  }
  if (microphoneOpening) return Promise.reject(new DOMException('A microphone permission request is already pending', 'NotReadableError'));
  microphoneOpening = true;
  try {
    return navigator.mediaDevices.getUserMedia({ audio: true }).finally(() => { microphoneOpening = false; });
  } catch (error) { microphoneOpening = false; throw error; }
}

export function createAudioRecorder(stream: MediaStream, allowedMimeTypes?: readonly string[]): MediaRecorder {
  if (typeof MediaRecorder === 'undefined') {
    throw new DOMException('Audio recording is unavailable', 'NotSupportedError');
  }
  // Chromium can choose Opus inside plain MP4. Prefer explicit AAC so older
  // iOS/WebKit recipients can decode recordings made on Android as well.
  const mimeType = (allowedMimeTypes ?? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg']).find(
    (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
  );
  if (allowedMimeTypes && !mimeType) {
    throw new DOMException('No allowed audio recording format is supported', 'NotSupportedError');
  }
  return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
}

export function releaseAudioRecording(recorder: MediaRecorder | null, stream: MediaStream | null) {
  if (recorder) {
    // Discard callbacks before stopping; stopping tracks can also queue a stop event.
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      // A failed recorder must not prevent releasing the microphone.
    }
  }
  stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* Release every remaining track. */ } });
}

export function getAudioErrorToast(error: unknown, source: 'microphone' | 'audio' = 'microphone') {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (source === 'microphone' && ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(String(name))) {
    return {
      title: tr('crytranslator_mikrofon_icazesi_lazimdir_711293', 'Mikrofon icaz\u0259si laz\u0131md\u0131r'),
      description: tr('crytranslator_parametrlerden_mikrofon_icazesini_aktivl_f7008f', 'Parametrl\u0259rd\u0259n mikrofon icaz\u0259sini aktivl\u0259\u015Fdirin'),
      variant: 'destructive' as const
    };
  }

  let description: string;
  if (name === 'NotSupportedError') {
    description = tr('audio_recording_unsupported', 'Bu cihazda mikrofonla i\u015Fl\u0259m\u0259k d\u0259st\u0259kl\u0259nmir. T\u0259tbiqi v\u0259 ya brauzeri yenil\u0259yin.');
  } else if (['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'AbortError', 'OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(String(name))) {
    description = tr('audio_microphone_unavailable', 'Mikrofonu yoxlay\u0131n, ondan istifad\u0259 ed\u0259n dig\u0259r t\u0259tbiql\u0259ri ba\u011Flay\u0131n v\u0259 yenid\u0259n c\u0259hd edin.');
  } else {
    description = tr('audio_recording_failed', 'S\u0259si emal etm\u0259k m\u00FCmk\u00FCn olmad\u0131. Yenid\u0259n c\u0259hd edin.');
  }
  return {
    title: tr('crytranslator_mikrofon_xetasi_5f83b3', 'Mikrofon x\u0259tas\u0131'),
    description,
    variant: 'destructive' as const
  };
}
