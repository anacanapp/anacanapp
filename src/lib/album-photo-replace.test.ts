import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceRecordPhoto, replaceStoragePhoto, storagePathFromUrl, type AlbumDbClient } from './album-photo-replace';

function makeClient(opts: { uploadError?: unknown; dbError?: unknown; removeError?: unknown } = {}) {
  const calls: string[] = [];
  const upload = vi.fn(async (path: string) => { calls.push(`upload:${path}`); return { error: opts.uploadError ?? null }; });
  const remove = vi.fn(async (paths: string[]) => { calls.push(`remove:${paths.join(',')}`); return { error: opts.removeError ?? null }; });
  const eq = vi.fn(async (_c: string, id: string) => { calls.push(`db:update:${id}`); return { error: opts.dbError ?? null }; });
  const update = vi.fn(() => ({ eq }));
  const client = {
    storage: { from: vi.fn(() => ({ upload, remove })) },
    from: vi.fn(() => ({ update })),
  } as unknown as AlbumDbClient;
  return { client, calls, upload, remove, update };
}

const file = new Blob(['x']);
const recordInput = {
  bucket: 'pregnancy-album', table: 'pregnancy_album_photos', recordId: 'row1',
  oldPath: 'u/3-1.jpg', newPath: 'u/3-2.jpg', newUrl: 'https://x/pregnancy-album/u/3-2.jpg', file,
};

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('replaceRecordPhoto (pregnancy album)', () => {
  it('uploads new, updates the row, then deletes the old object', async () => {
    const { client, calls, update } = makeClient();
    await replaceRecordPhoto(client, recordInput);
    expect(calls).toEqual(['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-1.jpg']);
    expect(update).toHaveBeenCalledWith({ photo_url: recordInput.newUrl });
  });

  it('keeps the old photo when the upload fails', async () => {
    const { client, calls } = makeClient({ uploadError: { message: 'net' } });
    await expect(replaceRecordPhoto(client, recordInput)).rejects.toEqual({ message: 'net' });
    expect(calls).toEqual(['upload:u/3-2.jpg']);
  });

  it('keeps the old photo and cleans up the new object when the DB update fails', async () => {
    const { client, calls } = makeClient({ dbError: { message: 'rls' } });
    await expect(replaceRecordPhoto(client, recordInput)).rejects.toEqual({ message: 'rls' });
    expect(calls).toEqual(['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-2.jpg']);
    expect(calls).not.toContain('remove:u/3-1.jpg');
  });

  it('still succeeds when deleting the old object fails', async () => {
    const { client, calls } = makeClient({ removeError: { message: 'gone' } });
    await expect(replaceRecordPhoto(client, recordInput)).resolves.toBeUndefined();
    expect(calls).toEqual(['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-1.jpg']);
  });
});

describe('replaceStoragePhoto (baby album)', () => {
  const input = { bucket: 'baby-album', oldPath: 'u/month-2-1.jpg', newPath: 'u/month-2-2.jpg', file };

  it('uploads new before deleting old', async () => {
    const { client, calls } = makeClient();
    await replaceStoragePhoto(client, input);
    expect(calls).toEqual(['upload:u/month-2-2.jpg', 'remove:u/month-2-1.jpg']);
  });

  it('never deletes the old object when the upload fails', async () => {
    const { client, calls } = makeClient({ uploadError: { message: 'offline' } });
    await expect(replaceStoragePhoto(client, input)).rejects.toEqual({ message: 'offline' });
    expect(calls).toEqual(['upload:u/month-2-2.jpg']);
  });
});

describe('storagePathFromUrl', () => {
  it('handles public URLs, signed URLs and bare paths', () => {
    expect(storagePathFromUrl('https://h/storage/v1/object/public/pregnancy-album/u/3-1.jpg', 'pregnancy-album')).toBe('u/3-1.jpg');
    expect(storagePathFromUrl('https://h/storage/v1/object/sign/pregnancy-album/u/a%20b.jpg?token=abc', 'pregnancy-album')).toBe('u/a b.jpg');
    expect(storagePathFromUrl('u/3-1.jpg', 'pregnancy-album')).toBe('u/3-1.jpg');
  });
});
