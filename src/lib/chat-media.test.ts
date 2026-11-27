import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chatMediaObjectPath,
  clearChatMediaSignedCache,
  signChatMediaUrl,
} from './chat-media';

const mocks = vi.hoisted(() => ({ createSignedUrl: vi.fn(), from: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: mocks.from } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  clearChatMediaSignedCache();
  mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/token' }, error: null });
});

describe('chatMediaObjectPath', () => {
  it('returns a bare storage path unchanged', () => {
    expect(chatMediaObjectPath('user-1/1699999999.jpg')).toBe('user-1/1699999999.jpg');
  });

  it('extracts the path from a legacy public URL', () => {
    expect(
      chatMediaObjectPath('https://api.anacan.az/storage/v1/object/public/chat-media/user-1/clip.m4a'),
    ).toBe('user-1/clip.m4a');
  });

  it('extracts the path from a signed URL (ignores the query)', () => {
    expect(
      chatMediaObjectPath('https://api.anacan.az/storage/v1/object/sign/chat-media/user-1/a.png?token=abc'),
    ).toBe('user-1/a.png');
  });

  it('decodes percent-encoded path segments', () => {
    expect(
      chatMediaObjectPath('https://host/storage/v1/object/public/chat-media/user-1/a%20b.jpg'),
    ).toBe('user-1/a b.jpg');
  });

  it('rejects blob:/data: previews and foreign or malformed values', () => {
    expect(chatMediaObjectPath('blob:https://app/abc')).toBeNull();
    expect(chatMediaObjectPath('data:image/png;base64,AAAA')).toBeNull();
    expect(chatMediaObjectPath('https://host/storage/v1/object/public/other-bucket/x.jpg')).toBeNull();
    expect(chatMediaObjectPath('')).toBeNull();
    expect(chatMediaObjectPath(null)).toBeNull();
    expect(chatMediaObjectPath(undefined)).toBeNull();
  });

  it('rejects traversal in a bare path and strips a leading slash', () => {
    expect(chatMediaObjectPath('../secret.jpg')).toBeNull();
    expect(chatMediaObjectPath('user-1/../../etc/passwd')).toBeNull();
    expect(chatMediaObjectPath('/leading/slash.jpg')).toBe('leading/slash.jpg');
  });

  it('cannot escape the bucket via ".." inside a URL (URL normalization drops the anchor)', () => {
    // The URL parser collapses the "../.." before our /chat-media/ regex runs, so an
    // escape attempt no longer contains /chat-media/ and resolves to null.
    expect(
      chatMediaObjectPath('https://host/storage/v1/object/public/chat-media/../../etc/passwd'),
    ).toBeNull();
  });
});

describe('signChatMediaUrl', () => {
  it('signs the extracted path against the chat-media bucket', async () => {
    const url = await signChatMediaUrl('user-1/clip.m4a', 1800);
    expect(url).toBe('https://signed.example/token');
    expect(mocks.from).toHaveBeenCalledWith('chat-media');
    expect(mocks.createSignedUrl).toHaveBeenCalledExactlyOnceWith('user-1/clip.m4a', 1800);
  });

  it('signs the path extracted from a legacy public URL', async () => {
    const url = await signChatMediaUrl('https://api.anacan.az/storage/v1/object/public/chat-media/user-1/clip.m4a');
    expect(url).toBe('https://signed.example/token');
    expect(mocks.createSignedUrl).toHaveBeenCalledExactlyOnceWith('user-1/clip.m4a', 60 * 60);
  });

  it('caches by path: a second call does not re-sign', async () => {
    await signChatMediaUrl('user-1/clip.m4a');
    await signChatMediaUrl('user-1/clip.m4a');
    expect(mocks.createSignedUrl).toHaveBeenCalledOnce();
  });

  it('returns null without signing for non-chat-media values', async () => {
    expect(await signChatMediaUrl('blob:https://app/abc')).toBeNull();
    expect(await signChatMediaUrl(null)).toBeNull();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns null when signing fails', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } });
    expect(await signChatMediaUrl('user-1/clip.m4a')).toBeNull();
  });
});
