import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioRecorder, getAudioErrorToast, openMicrophone, releaseAudioRecording } from './audioRecording';

vi.mock('@/lib/tr', () => ({ tr: (key: string) => key }));

const getUserMedia = vi.fn();
const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const isTypeSupported = vi.fn();
const Recorder = Object.assign(vi.fn(function (stream: MediaStream, options?: MediaRecorderOptions) {
  return { stream, mimeType: options?.mimeType || 'audio/ogg;codecs=opus' };
}), { isTypeSupported });

beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockResolvedValue(stream);
  isTypeSupported.mockReturnValue(false);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', Recorder);
});

afterEach(() => vi.unstubAllGlobals());

describe('microphone acquisition and MIME selection', () => {
  it('opens exactly one stream and leaves it live for the caller', async () => {
    expect(await openMicrophone()).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
    expect(trackStop).not.toHaveBeenCalled();
  });

  it('reports unsupported capture when mediaDevices is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(openMicrophone).toThrow(expect.objectContaining({ name: 'NotSupportedError' }));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it.each(['audio/webm', 'audio/mp4', 'audio/ogg'])('selects supported %s without reacquiring the microphone', (mimeType) => {
    isTypeSupported.mockImplementation((type) => type === mimeType);
    const recorder = createAudioRecorder(stream);
    expect(Recorder).toHaveBeenCalledExactlyOnceWith(stream, { mimeType });
    expect(recorder.mimeType).toBe(mimeType);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('prefers cross-platform MP4/AAC when multiple formats are supported', () => {
    isTypeSupported.mockReturnValue(true);
    expect(createAudioRecorder(stream).mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('honors an explicit allowed format list and its preference order', () => {
    isTypeSupported.mockReturnValue(true);
    createAudioRecorder(stream, ['audio/mp4', 'audio/webm']);
    expect(Recorder).toHaveBeenCalledExactlyOnceWith(stream, { mimeType: 'audio/mp4' });
  });

  it.each(['audio/mp4', 'audio/ogg', undefined])('rejects unsupported WebM instead of falling back to %s when explicitly restricted', (supported) => {
    isTypeSupported.mockImplementation((type) => type === supported);
    expect(() => createAudioRecorder(stream, ['audio/webm'])).toThrow(expect.objectContaining({ name: 'NotSupportedError' }));
    expect(Recorder).not.toHaveBeenCalled();
  });

  it('lets the recorder choose its real default when no candidate is supported', () => {
    const recorder = createAudioRecorder(stream);
    expect(Recorder).toHaveBeenCalledExactlyOnceWith(stream, undefined);
    expect(recorder.mimeType).toBe('audio/ogg;codecs=opus');
  });

  it('reports a missing MediaRecorder as unsupported', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(() => createAudioRecorder(stream)).toThrow(expect.objectContaining({ name: 'NotSupportedError' }));
  });
});

describe('recording cleanup', () => {
  it('discards recording callbacks before either stop can trigger an upload', () => {
    const upload = vi.fn();
    const recorder = {
      state: 'recording',
      onstop: upload,
      ondataavailable: vi.fn(),
      onerror: vi.fn(),
      stop: vi.fn(() => recorder.onstop?.(new Event('stop')))
    } as unknown as MediaRecorder;
    trackStop.mockImplementationOnce(() => recorder.onstop?.(new Event('stop')));

    releaseAudioRecording(recorder, stream);

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(recorder.onstop).toBeNull();
    expect(recorder.ondataavailable).toBeNull();
    expect(recorder.onerror).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it('releases an acquired stream even when recorder construction never finished', () => {
    releaseAudioRecording(null, stream);
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it('still releases the stream when a failed recorder throws on stop', () => {
    const recorder = {
      state: 'recording',
      stop: vi.fn(() => { throw new DOMException('Failed', 'InvalidStateError'); })
    } as unknown as MediaRecorder;
    expect(() => releaseAudioRecording(recorder, stream)).not.toThrow();
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it('does not stop an already inactive recorder again', () => {
    const recorder = { state: 'inactive', stop: vi.fn() } as unknown as MediaRecorder;
    releaseAudioRecording(recorder, stream);
    expect(recorder.stop).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalledOnce();
  });
});

describe('localized audio errors', () => {
  it.each(['NotAllowedError', 'PermissionDeniedError', 'SecurityError'])('uses permission guidance only for capture denial %s', (name) => {
    expect(getAudioErrorToast(new DOMException('Denied', name))).toEqual({
      title: 'crytranslator_mikrofon_icazesi_lazimdir_711293',
      description: 'crytranslator_parametrlerden_mikrofon_icazesini_aktivl_f7008f',
      variant: 'destructive'
    });
    expect(getAudioErrorToast(new DOMException('Recorder failed', name), 'audio').description).toBe('audio_recording_failed');
  });

  it.each(['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'AbortError', 'OverconstrainedError', 'ConstraintNotSatisfiedError'])('gives device/busy guidance for %s', (name) => {
    expect(getAudioErrorToast({ name }).description).toBe('audio_microphone_unavailable');
    expect(getAudioErrorToast({ name }).title).toBe('crytranslator_mikrofon_xetasi_5f83b3');
  });

  it('distinguishes unsupported audio from permission denial', () => {
    expect(getAudioErrorToast({ name: 'NotSupportedError' }).description).toBe('audio_recording_unsupported');
  });

  it.each([undefined, null, 'permission problem', new Error('permission problem'), { name: 'TypeError' }, { name: 'InvalidStateError' }])('does not infer permission denial from an unknown failure: %s', (error) => {
    expect(getAudioErrorToast(error).description).toBe('audio_recording_failed');
  });
});
