import { BRAND_PATHS } from './fictional-brands';
import { itemById } from './cosmetics';
import type { PlayerLook } from './cosmetics';
import { drawRocket } from './art';

export { BRAND_PATHS } from './fictional-brands';
const paths = new Map<string, Path2D>();
const images = new Map<string, HTMLImageElement>();

export async function prepareLogoImage(look: PlayerLook): Promise<void> {
  if (!look.customImage) return;
  let image = images.get(look.customImage);
  if (!image) { image = new Image(); image.src = look.customImage; images.set(look.customImage, image); }
  await image.decode().catch(() => undefined);
}

export function drawLogo(ctx: CanvasRenderingContext2D, logo: string, x: number, y: number, size: number, color: string, look?: PlayerLook) {
  if (logo === 'rocket') { drawRocket(ctx, x, y, size * 1.13, -Math.PI / 4, color); return; }
  ctx.save(); ctx.translate(x, y);
  if (logo === 'custom') {
    if (look?.customImage) {
      let image = images.get(look.customImage);
      if (!image) { image = new Image(); image.src = look.customImage; images.set(look.customImage, image); if (images.size > 6) images.delete(images.keys().next().value!); }
      if (image.complete && image.naturalWidth > 0) {
        ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(image, -size / 2, -size / 2, size, size); ctx.restore(); return;
      }
    }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${size * (look?.monogram.length === 3 ? .38 : .53)}px "Space Grotesk", sans-serif`; ctx.fillText(look?.monogram || 'S', 0, size * .025); ctx.restore(); return;
  }
  const brand = BRAND_PATHS[logo];
  const path = brand || itemById(logo)?.path;
  if (path) {
    let vector = paths.get(logo);
    if (!vector) { vector = new Path2D(path); paths.set(logo, vector); }
    ctx.scale(size / 24, size / 24); ctx.translate(-12, -12);
    if (brand) { ctx.fillStyle = color; ctx.fill(vector, 'evenodd'); }
    else { ctx.strokeStyle = color; ctx.lineWidth = logo === 'infinity' ? 2.4 : 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(vector); }
  }
  ctx.restore();
}
