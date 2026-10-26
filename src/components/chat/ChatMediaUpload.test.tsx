import { createElement, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMediaUpload from './ChatMediaUpload';
import { useDirectMessages } from '@/hooks/useDirectMessages';

const { user, storage, bucket, onUpload, sendMessage } = vi.hoisted(() => {
  const storage = { upload: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() };
  return {
    user: { id: 'sender' }, storage, bucket: vi.fn((_bucket: string) => storage),
    onUpload: vi.fn(), sendMessage: vi.fn()
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user } }) },
    storage: { from: bucket },
    from: () => ({
      select() { return this; }, or() { return this; }, order() { return this; },
      limit: async () => ({ data: [], error: null })
    }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn()
  }
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useDirectMessages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useDirectMessages')>();
  return {
    ...actual,
    useDirectMessages(otherUserId?: string) {
      return { ...actual.useDirectMessages(otherUserId), sendMessage };
    }
  };
});
vi.mock('@/lib/tr', () => ({ tr: (key: string) => key }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: async () => {}, medium: async () => {}, heavy: async () => {} } }));
vi.mock('@/components/PhotoGalleryViewer', () => ({ default: () => null }));
vi.mock('framer-motion', () => {
  const element = (tag: 'button' | 'div') => ({ children, onClick, disabled, 'aria-label': label }: ComponentProps<'button'>) =>
    createElement(tag, { onClick, disabled, 'aria-label': label }, children);
  return { motion: { button: element('button'), div: element('div') } };
});

class MockMediaRecorder {
  static latest: MockMediaRecorder;
  static isTypeSupported = () => true;
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => Promise<void>) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly stream: MediaStream) { MockMediaRecorder.latest = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; }
}

const uploadedPath = 'sender/server-returned-audio.webm';
const publicUrl = 'https://example.test/chat-media/server-returned-audio.webm';
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
let completeUpload: (result: { data: { path: string }; error: Error | null }) => void;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage.upload.mockReturnValue(new Promise((resolve) => { completeUpload = resolve; }));
  storage.remove.mockResolvedValue({ data: [], error: null });
  storage.getPublicUrl.mockReturnValue({ data: { publicUrl } });
  sendMessage.mockResolvedValue(null);
  const stream = { getTracks: () => [{ stop: vi.fn() }] };
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => stream } });
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

async function startUpload() {
  const view = render(<ChatMediaUpload onUpload={onUpload} />);
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button')[1]);
  });
  let completion: Promise<void>;
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button')[1]);
    const recorder = MockMediaRecorder.latest;
    recorder.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    completion = recorder.onstop!();
  });
  expect(storage.upload).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/^sender\/\d+\.webm$/), expect.any(Blob),
    { contentType: 'audio/webm', upsert: false }
  );
  return { ...view, completion };
}

describe('legacy chat completed audio uploads', () => {
  it('removes only the returned path after unmount, without publishing or sending', async () => {
    const { unmount, completion } = await startUpload();
    unmount();
    await act(async () => {
      completeUpload({ data: { path: uploadedPath }, error: null });
      await completion;
    });

    expect(bucket.mock.calls.every(([name]) => name === 'chat-media')).toBe(true);
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith([uploadedPath]);
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('preserves normal success without deleting the uploaded object', async () => {
    const { completion } = await startUpload();
    await act(async () => {
      completeUpload({ data: { path: uploadedPath }, error: null });
      await completion;
    });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.getPublicUrl).toHaveBeenCalledExactlyOnceWith(uploadedPath);
    expect(onUpload).toHaveBeenCalledExactlyOnceWith('audio', publicUrl);
  });

  it('checks upload failure before considering deletion after cancellation', async () => {
    const { unmount, completion } = await startUpload();
    unmount();
    await act(async () => {
      completeUpload({ data: { path: uploadedPath }, error: new Error('Upload failed') });
      await completion;
    });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it.each(['response', 'rejection'])('logs a removal %s failure without content or paths and still suppresses publication', async (failure) => {
    const error = new Error(`Private removal details: ${uploadedPath}`);
    if (failure === 'response') storage.remove.mockResolvedValue({ error });
    else storage.remove.mockRejectedValue(error);
    const { unmount, completion } = await startUpload();
    unmount();
    await act(async () => {
      completeUpload({ data: { path: uploadedPath }, error: null });
      await completion;
    });

    expect(storage.remove).toHaveBeenCalledExactlyOnceWith([uploadedPath]);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Failed to remove cancelled chat media upload');
    expect(onUpload).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

it('does not start a DM upload when its optional signal is already aborted', async () => {
  const { result } = renderHook(() => useDirectMessages('recipient'));
  const controller = new AbortController();
  controller.abort();
  await act(async () => {
    expect(await result.current.uploadMedia(new Blob(['audio']), 'audio', controller.signal)).toBeNull();
  });
  expect(storage.upload).not.toHaveBeenCalled();
  expect(storage.remove).not.toHaveBeenCalled();
});

it('preserves existing uploadMedia callers that do not pass a signal', async () => {
  const { result } = renderHook(() => useDirectMessages('recipient'));
  await act(async () => {
    const upload = result.current.uploadMedia(new Blob(['audio'], { type: 'audio/webm' }), 'audio');
    completeUpload({ data: { path: uploadedPath }, error: null });
    expect(await upload).toBe(publicUrl);
  });
  expect(storage.upload).toHaveBeenCalledOnce();
  expect(storage.remove).not.toHaveBeenCalled();
});
