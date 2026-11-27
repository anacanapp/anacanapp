import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetIllustrationImageCache,
  hasImageFailed,
  isImageReady,
  preloadImage,
  resolvePublicStorageUrl,
} from './illustration-image';

const AZURE = 'https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io';
const PATH = '/storage/v1/object/public/assets/fetus-illustrations/fetus-month-1-1788720972175.png';

describe('resolvePublicStorageUrl', () => {
  it('rewrites public objects on the stopped Azure gateway to Google storage', () => {
    expect(resolvePublicStorageUrl(`${AZURE}${PATH}`)).toBe(`https://api.anacan.az${PATH}`);
    expect(resolvePublicStorageUrl(`  ${AZURE}${PATH}?v=2 `)).toBe(`https://api.anacan.az${PATH}?v=2`);
  });

  it('drops non-public paths on the stopped gateway', () => {
    expect(resolvePublicStorageUrl(`${AZURE}/storage/v1/object/sign/assets/x.png?token=t`)).toBeNull();
    expect(resolvePublicStorageUrl(`${AZURE}/functions/v1/x`)).toBeNull();
  });

  it('keeps Google, third-party and bundled URLs, upgrading http on Google hosts', () => {
    expect(resolvePublicStorageUrl(`https://gcp.anacan.az${PATH}`)).toBe(`https://gcp.anacan.az${PATH}`);
    expect(resolvePublicStorageUrl(`http://api.anacan.az${PATH}`)).toBe(`https://api.anacan.az${PATH}`);
    expect(resolvePublicStorageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolvePublicStorageUrl('/assets/month-1-abc.svg')).toBe('/assets/month-1-abc.svg');
    expect(resolvePublicStorageUrl('data:image/svg+xml;base64,AA==')).toBe('data:image/svg+xml;base64,AA==');
  });

  it('returns null for empty or malformed values', () => {
    expect(resolvePublicStorageUrl(null)).toBeNull();
    expect(resolvePublicStorageUrl(undefined)).toBeNull();
    expect(resolvePublicStorageUrl('   ')).toBeNull();
    expect(resolvePublicStorageUrl('https://')).toBeNull();
    expect(resolvePublicStorageUrl('https://user:pw@api.anacan.az/x.png')).toBeNull();
  });
});

describe('preloadImage', () => {
  let outcomes: boolean[];
  let requested: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    __resetIllustrationImageCache();
    outcomes = [];
    requested = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decoding = '';
      decode = () => Promise.resolve();
      set src(value: string) {
        requested.push(value);
        const ok = outcomes.shift() ?? false;
        queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
      }
    }
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('retries a failed load and caches success', async () => {
    outcomes = [false, true];
    const result = preloadImage('https://api.anacan.az/a.png');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(true);
    expect(requested).toHaveLength(2);
    expect(isImageReady('https://api.anacan.az/a.png')).toBe(true);
    await expect(preloadImage('https://api.anacan.az/a.png')).resolves.toBe(true);
    expect(requested).toHaveLength(2);
  });

  it('gives up after bounded retries and remembers the failure', async () => {
    outcomes = [false, false, false];
    const result = preloadImage('https://api.anacan.az/b.png');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(false);
    expect(requested).toHaveLength(3);
    expect(hasImageFailed('https://api.anacan.az/b.png')).toBe(true);
    await expect(preloadImage('https://api.anacan.az/b.png')).resolves.toBe(false);
    expect(requested).toHaveLength(3);
  });

  it('dedupes concurrent loads and ignores empty URLs', async () => {
    outcomes = [true];
    const a = preloadImage('https://api.anacan.az/c.png');
    const b = preloadImage('https://api.anacan.az/c.png');
    await vi.runAllTimersAsync();
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(requested).toHaveLength(1);
    await expect(preloadImage(null)).resolves.toBe(false);
  });
});
