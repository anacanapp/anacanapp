import { createElement, type ComponentProps, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CryTranslator from './CryTranslator';

const { toast, checkAndConsume, invoke, requestMicrophonePermission } = vi.hoisted(() => ({
  toast: vi.fn(), checkAndConsume: vi.fn(), invoke: vi.fn(), requestMicrophonePermission: vi.fn()
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ checkAndConsume }) }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {}, trackEvent: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/lib/permissions', () => ({ requestMicrophonePermission }));
vi.mock('@/lib/tr', () => ({ tr: (key: string) => key, getPersistedLanguage: () => 'en' }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));
vi.mock('@/components/MedicalDisclaimer', () => ({ default: () => null }));
vi.mock('@/components/PremiumModal', () => ({ default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>Premium</div> : null }));
vi.mock('./anacan/ToolKit', () => ({
  ToolPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  ToolHeader: ({ onBack, actions }: { onBack: () => void; actions: ReactNode }) => <header><button onClick={onBack}>Back</button>{actions}</header>
}));
vi.mock('framer-motion', () => {
  const element = (tag: 'button' | 'div') => ({ children, onClick, disabled, className, style }: ComponentProps<'button'>) =>
    createElement(tag, { onClick, disabled, className, style }, children);
  return {
    motion: { button: element('button'), div: element('div') },
    AnimatePresence: ({ children }: { children: ReactNode }) => children
  };
});

const getUserMedia = vi.fn();
const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const constructRecorder = vi.fn();
const startRecorder = vi.fn();
let reportedMimeType: string | undefined;

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn();
  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly stream: MediaStream, options?: MediaRecorderOptions) {
    constructRecorder(stream, options);
    this.mimeType = reportedMimeType ?? options?.mimeType ?? 'audio/ogg;codecs=opus';
    MockMediaRecorder.instances.push(this);
  }

  start = vi.fn(() => { startRecorder(); this.state = 'recording'; });
  stop = vi.fn(() => { this.state = 'inactive'; });
  finish() {
    this.ondataavailable?.({ data: new Blob(['cry'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

class MockFileReader {
  static instances: MockFileReader[] = [];
  static autoRead = true;
  result = '';
  error = null;
  blob: Blob;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { MockFileReader.instances.push(this); }
  readAsDataURL(blob: Blob) {
    this.blob = blob;
    this.result = `data:${blob.type};base64,Y3J5`;
    if (MockFileReader.autoRead) void Promise.resolve().then(() => this.onload?.());
  }
}

const audioContext = {
  close: vi.fn(),
  createMediaStreamSource: vi.fn(),
  createAnalyser: vi.fn()
};
const AudioContextConstructor = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getUserMedia.mockResolvedValue(stream);
  requestMicrophonePermission.mockResolvedValue({ granted: true });
  checkAndConsume.mockResolvedValue({ allowed: true });
  invoke.mockResolvedValue({ data: { success: true, analysis: {
    cryType: 'hungry', confidence: 80, explanation: 'Test result', recommendations: [], urgency: 'low'
  } }, error: null });
  reportedMimeType = undefined;
  MockMediaRecorder.instances = [];
  MockMediaRecorder.isTypeSupported.mockImplementation((type) => type === 'audio/webm');
  MockFileReader.instances = [];
  MockFileReader.autoRead = true;
  audioContext.close.mockResolvedValue(undefined);
  audioContext.createMediaStreamSource.mockReturnValue({ connect: vi.fn() });
  audioContext.createAnalyser.mockReturnValue({ frequencyBinCount: 4, getByteFrequencyData: vi.fn() });
  AudioContextConstructor.mockImplementation(function () { return audioContext; });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('AudioContext', AudioContextConstructor);
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('FileReader', MockFileReader);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function clickMic() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '' })); });
}

async function finishRecording() {
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  await clickMic();
  await act(async () => { MockMediaRecorder.instances[0].finish(); });
}

describe('CryTranslator microphone lifecycle', () => {
  it('acquires once, reuses that live stream, and ignores taps while acquisition is pending', async () => {
    let grant: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve; }));
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await clickMic();
    await act(async () => { grant(stream); });

    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
    expect(requestMicrophonePermission).not.toHaveBeenCalled();
    expect(audioContext.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(constructRecorder).toHaveBeenCalledExactlyOnceWith(stream, { mimeType: 'audio/webm' });
    expect(MockMediaRecorder.instances[0].state).toBe('recording');
    expect(trackStop).not.toHaveBeenCalled();
    expect(audioContext.close).not.toHaveBeenCalled();
  });

  it.each(['back', 'unmount'])('releases a late microphone grant after %s without starting a recorder', async (action) => {
    let grant: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve; }));
    const { unmount } = render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    if (action === 'back') fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    else unmount();
    await act(async () => { grant(stream); });

    expect(trackStop).toHaveBeenCalledOnce();
    expect(AudioContextConstructor).not.toHaveBeenCalled();
    expect(constructRecorder).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('discards active recording on unmount and releases its timer, stream and AudioContext', async () => {
    const { unmount } = render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    const recorder = MockMediaRecorder.instances[0];
    unmount();
    recorder.finish();

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(recorder.ondataavailable).toBeNull();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(checkAndConsume).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('discards a recording shorter than three seconds instead of analyzing it', async () => {
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await clickMic();
    MockMediaRecorder.instances[0].finish();

    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(checkAndConsume).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'crytranslator_cox_qisa_12bf93' }));
  });

  it.each(['context', 'analyser', 'recorder', 'start'])('releases acquired resources when %s setup fails without calling it a permission denial', async (phase) => {
    const fail = () => { throw new DOMException('permission-related recorder failure', 'SecurityError'); };
    if (phase === 'context') AudioContextConstructor.mockImplementationOnce(fail);
    if (phase === 'analyser') audioContext.createMediaStreamSource.mockImplementationOnce(fail);
    if (phase === 'recorder') constructRecorder.mockImplementationOnce(fail);
    if (phase === 'start') startRecorder.mockImplementationOnce(fail);
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();

    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledTimes(phase === 'context' ? 0 : 1);
    expect(vi.getTimerCount()).toBe(0);
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'audio_recording_failed' }));
  });

  it.each([
    ['NotAllowedError', 'crytranslator_parametrlerden_mikrofon_icazesini_aktivl_f7008f'],
    ['NotReadableError', 'audio_microphone_unavailable'],
    ['NotSupportedError', 'audio_recording_unsupported']
  ])('reports capture %s accurately', async (name, description) => {
    getUserMedia.mockRejectedValue(new DOMException('Capture failed', name));
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description }));
    expect(AudioContextConstructor).not.toHaveBeenCalled();
  });

  it.each(['audio/mp4', 'audio/ogg', undefined])('rejects unavailable WebM instead of falling back to %s, with cleanup and no permission-denied toast', async (supported) => {
    MockMediaRecorder.isTypeSupported.mockImplementation((type) => type === supported);
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(constructRecorder).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(checkAndConsume).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledExactlyOnceWith({
      title: 'crytranslator_mikrofon_xetasi_5f83b3',
      description: 'audio_recording_unsupported',
      variant: 'destructive'
    });
  });

  it('releases resources and discards data after a MediaRecorder error event', async () => {
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    const recorder = MockMediaRecorder.instances[0];
    await act(async () => { recorder.onerror?.(new Event('error')); recorder.finish(); });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'audio_recording_failed' }));
  });
});

describe('CryTranslator recording completion', () => {
  it.each(['audio/webm', 'audio/webm;codecs=opus'])('records %s and uses the deployed analyze-cry payload without a MIME field', async (actual) => {
    reportedMimeType = actual;
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await finishRecording();

    expect(constructRecorder).toHaveBeenCalledWith(stream, { mimeType: 'audio/webm' });
    expect(MockFileReader.instances[0].blob.type).toBe(actual);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('analyze-cry', expect.objectContaining({
      body: { audioBase64: 'Y3J5', audioDuration: 3, userContext: {}, language: 'en' }
    }));
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(screen.getByText('crytranslator_analiz_tamamlandi_7dd77f')).toBeInTheDocument();
  });

  it('auto-stops at ten seconds using current recorder state and duration', async () => {
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    const recorder = MockMediaRecorder.instances[0];
    expect(recorder.stop).toHaveBeenCalledOnce();
    await act(async () => { recorder.finish(); });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][1].body.audioDuration).toBe(10);
    expect(vi.getTimerCount()).toBe(0);
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
  });

  it('ignores a stop callback already queued when the user leaves', async () => {
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await clickMic();
    const queuedStop = MockMediaRecorder.instances[0].onstop;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => { queuedStop?.(); });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(checkAndConsume).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not upload after unmount while the usage check is pending', async () => {
    let allow: (result: { allowed: boolean }) => void;
    checkAndConsume.mockReturnValue(new Promise((resolve) => { allow = resolve; }));
    const { unmount } = render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await finishRecording();
    unmount();
    await act(async () => { allow({ allowed: true }); });
    expect(MockFileReader.instances).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not upload after unmount while FileReader is pending', async () => {
    MockFileReader.autoRead = false;
    const { unmount } = render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await finishRecording();
    unmount();
    await act(async () => { MockFileReader.instances[0].onload?.(); });
    expect(invoke).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('aborts an in-flight analysis and ignores its late response after unmount', async () => {
    let respond: (result: unknown) => void;
    invoke.mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const { unmount } = render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await finishRecording();
    const signal = invoke.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { respond({ error: new Error('Aborted request') }); });
    expect(toast).not.toHaveBeenCalled();
  });

  it('handles asynchronous analysis failures instead of leaking a FileReader callback rejection', async () => {
    invoke.mockRejectedValue(new Error('Analysis unavailable'));
    render(<CryTranslator onBack={vi.fn()} />);
    await clickMic();
    await finishRecording();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'crytranslator_analiz_xetasi_daba4a' }));
    expect(trackStop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
  });
});
