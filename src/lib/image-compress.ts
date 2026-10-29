// Client-side downscale + re-encode before upload. Phone photos (2–5 MB) become ~150–400 KB
// at 1600 px, which is what the feed, chat and albums display. Anything that cannot be decoded
// (HEIC on Android, corrupt files), animated GIF, SVG and small files are uploaded unchanged.

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;
const MIN_BYTES = 300 * 1024;
const PASS_THROUGH = /^image\/(gif|svg\+xml)$/i;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

export interface CompressOptions { maxDimension?: number; quality?: number; minBytes?: number }

function renamed(name: string, type: string): string {
  const ext = EXT[type];
  if (!ext) return name;
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name || 'image'}.${ext}`;
}

/** Returns a smaller image File, or the original when compression would not help. */
export async function compressImageForUpload<T extends Blob>(file: T, options: CompressOptions = {}): Promise<T | File> {
  const { maxDimension = MAX_DIMENSION, quality = QUALITY, minBytes = MIN_BYTES } = options;
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || PASS_THROUGH.test(type) || file.size < minBytes) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // PNG may carry transparency: ask for WebP (keeps alpha). Everything else becomes JPEG.
    const target = type === 'image/png' ? 'image/webp' : 'image/jpeg';
    if (target === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, target, quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file instanceof File ? file.name : 'image';
    return new File([blob], renamed(name, blob.type), { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
