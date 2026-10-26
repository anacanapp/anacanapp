import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConversationScreen from './ConversationScreen';
import { useChatChromeHidden } from '@/hooks/useChatChrome';

const mocks = vi.hoisted(() => ({ send: vi.fn(), react: vi.fn(), upload: vi.fn(), remove: vi.fn(), sign: vi.fn(), toast: vi.fn(), restricted: false }));
const message = { id: 'message-one', sender_id: 'peer', receiver_id: 'sender', content: 'Original message', message_type: 'text', created_at: '2026-09-21T10:00:00Z' };
vi.mock('@/hooks/useChatMessages', () => ({ useChatMessages: () => ({
  messages: [message], allMessages: new Map([[message.id, message]]), authors: { peer: { name: 'Peer' } }, media: {}, reactions: [],
  actor: 'sender', loading: false, error: null, hasOlder: false, loadingOlder: false, sending: false, reacting: false,
  send: mocks.send, react: mocks.react, refetch: vi.fn(), loadOlder: vi.fn(),
}) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'sender' } }) }));
vi.mock('@/hooks/useModerator', () => ({ useMyModerationStatus: () => ({ data: { message: mocks.restricted, restrictions: [] } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ useAdSafetyBlock: vi.fn() }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));
vi.mock('@/components/PhotoGalleryViewer', () => ({ default: () => null }));
vi.mock('@/components/community/UserProfileScreen', () => ({ default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>Back to conversation</button> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.sign }) } } }));

class Recorder {
  static latest: Recorder;
  static isTypeSupported = () => true;
  state = 'inactive'; mimeType = 'audio/mp4';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { Recorder.latest = this; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['fixture-audio'], { type: 'audio/mp4' }) }); this.onstop?.(); });
  }
}
const Footer = () => useChatChromeHidden() ? null : <nav>Global footer</nav>;
const mount = (onBack = vi.fn()) => render(<><Footer /><ConversationScreen kind="direct" target="peer" title="Peer" onBack={onBack} /></>);
beforeEach(() => {
  vi.clearAllMocks(); mocks.restricted = false; mocks.send.mockResolvedValue({ ...message, sender_id: 'sender' }); mocks.react.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue({ error: null }); mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://media.example.invalid/voice.mp4' }, error: null });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('hides the footer, keeps the top back action, and opens the peer profile', async () => {
  const back = vi.fn(); mount(back);
  expect(screen.queryByText('Global footer')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Profilə bax' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Back to conversation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
  expect(back).toHaveBeenCalledOnce();
});

it('sends the selected reply and toggles a WhatsApp-style reaction', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Mesaj seçimləri' }));
  fireEvent.click(screen.getByRole('button', { name: '❤️' }));
  await waitFor(() => expect(mocks.react).toHaveBeenCalledWith({ message: 'message-one', emoji: '❤️' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mesaj seçimləri' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cavab ver' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Reply text ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Göndər' }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Reply text', replyTo: 'message-one' })));
});

it('retains a failed message and reuses its id on retry', async () => {
  mocks.send.mockRejectedValueOnce(new Error('Network failed'));
  mount();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep my draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Göndər' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(screen.getByRole('textbox')).toHaveValue('Keep my draft');
  fireEvent.click(screen.getByRole('button', { name: 'Göndər' }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[0][0].id).toBe(mocks.send.mock.calls[1][0].id);
});

it('removes an upload cancelled by Back before sending any message or signed URL', async () => {
  let finish!: (value: object) => void;
  mocks.upload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  mount();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🎤 Səs mesajı' })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Səs yazısını bitir' })); });
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  const path = mocks.upload.mock.calls[0][0];
  fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
  await act(async () => { finish({ data: { path }, error: null }); });
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith([path]));
  expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.sign).not.toHaveBeenCalled();
});

it('previews completed audio, then sends the real MIME/path only on Send', async () => {
  mocks.upload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
  mount();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🎤 Səs mesajı' })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Səs yazısını bitir' })); });
  await screen.findByRole('button', { name: 'Səsi dinlə' });
  expect(mocks.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Göndər' }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ attachment: expect.objectContaining({ mime: 'audio/mp4', type: 'audio', path: mocks.upload.mock.calls[0][0] }) })));
});
it('keeps message history available but removes text/audio composition when restricted', () => {
  mocks.restricted = true;
  mount();
  expect(screen.getByText('Original message')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '🎤 Səs mesajı' })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
