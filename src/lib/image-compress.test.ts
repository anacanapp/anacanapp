import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImageForUpload } from './image-compress';

const big = (type: string, size = 2_000_000, name = 'photo.heic') => new File([new Uint8Array(size)], name, { type });
let drawn: { w: number; h: number } | null;
let encoded: { type: string; quality: number } | null;
let outputSize = 250_000;

beforeEach(() => {
  drawn = null; encoded = null; outputSize = 250_000;
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4032, height: 3024, close: vi.fn() })));
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return realCreate(tag);
    const canvas = { width: 0, height: 0,
      getContext: () => ({ fillRect: vi.fn(), set fillStyle(_v: string) {}, drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => { drawn = { w, h }; } }),
      toBlob: (cb: (b: Blob) => void, type: string, quality: number) => { encoded = { type, quality }; cb(new Blob([new Uint8Array(outputSize)], { type })); } };
    return canvas as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('compressImageForUpload', () => {
  it('downscales a large photo to 1600 px JPEG and renames it', async () => {
    const out = await compressImageForUpload(big('image/jpeg', 3_000_000, 'IMG_1.jpeg')) as File;
    expect(drawn).toEqual({ w: 1600, h: 1200 });
    expect(encoded).toEqual({ type: 'image/jpeg', quality: 0.82 });
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_1.jpg');
    expect(out.size).toBe(250_000);
  });

  it('keeps transparency for PNG by asking for WebP', async () => {
    const out = await compressImageForUpload(big('image/png', 2_000_000, 'shot.png')) as File;
    expect(encoded?.type).toBe('image/webp');
    expect(out.name).toBe('shot.webp');
  });

  it('returns the original for small files, GIF, video and non-images', async () => {
    for (const file of [big('image/jpeg', 100_000), big('image/gif'), big('video/mp4'), big('application/pdf')]) {
      expect(await compressImageForUpload(file)).toBe(file);
    }
    expect(drawn).toBeNull();
  });

  it('returns the original when decoding fails (e.g. HEIC on Android)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode'); }));
    const file = big('image/heic');
    expect(await compressImageForUpload(file)).toBe(file);
  });

  it('returns the original when the result would not be smaller', async () => {
    outputSize = 3_000_000;
    const file = big('image/jpeg', 2_000_000);
    expect(await compressImageForUpload(file)).toBe(file);
  });
});
