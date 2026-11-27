import { describe, expect, it } from 'vitest';
import { STICKERS, stickerFromImageUrl, stickerFromMessage, stickerMessage } from './stickers';

describe('stickers', () => {
  it('has 60 numbered stickers', () => { expect(STICKERS).toHaveLength(60); expect(STICKERS[59].id).toBe('60'); });
  it('round-trips a message token and rejects lookalikes', () => {
    expect(stickerFromMessage(stickerMessage('07'))).toBe('07');
    expect(stickerFromMessage('🧸 Stiker 61')).toBeNull();
    expect(stickerFromMessage('hello 🧸 Stiker 3')).toBeNull();
  });
  it('recognises only first-party sticker comment images', () => {
    expect(stickerFromImageUrl('https://api.anacan.az/storage/v1/object/public/community-media/stickers/v1/12.webp')).toBe('12');
    expect(stickerFromImageUrl('https://api.anacan.az/storage/v1/object/public/community-media/u1/12.webp')).toBeNull();
  });
});
