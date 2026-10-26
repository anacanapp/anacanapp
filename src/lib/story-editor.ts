export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_MIN_ZOOM = 0.25;
export const STORY_MAX_ZOOM = 8;
export const STORY_FONTS = {
  sans: 'Arial, sans-serif',
  serif: 'Georgia, serif',
  mono: 'Courier New, monospace',
} as const;

export interface StoryTransform { x: number; y: number; zoom: number; rotation: number; }
export interface StoryTextLayer {
  id: string; text: string; x: number; y: number; size: number; rotation: number;
  color: string; font: keyof typeof STORY_FONTS; align: 'left' | 'center' | 'right';
  background: 'none' | 'dark' | 'light';
}
export interface StoryScene {
  version: 1; sourceWidth: number; sourceHeight: number; background: string;
  media: StoryTransform; texts: StoryTextLayer[];
}
export interface StoryPoint { x: number; y: number; }
export interface StoryTextBox { id: string; x: number; y: number; width: number; height: number; rotation: number; }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const radians = (degrees: number) => degrees * Math.PI / 180;
const normalizeAngle = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
const rotate = (p: StoryPoint, angle: number): StoryPoint => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) });

export function initialStoryScene(width: number, height: number): StoryScene {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('INVALID_STORY_MEDIA');
  return { version: 1, sourceWidth: width, sourceHeight: height, background: '#18181b',
    media: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 }, texts: [] };
}

export function storyMediaBox(scene: StoryScene) {
  const scale = Math.min(STORY_WIDTH / scene.sourceWidth, STORY_HEIGHT / scene.sourceHeight) * scene.media.zoom;
  return { x: scene.media.x * STORY_WIDTH, y: scene.media.y * STORY_HEIGHT,
    width: scene.sourceWidth * scale, height: scene.sourceHeight * scale, rotation: scene.media.rotation };
}

export function fitStoryMedia(scene: StoryScene, mode: 'contain' | 'cover' = 'contain'): StoryScene {
  const angle = radians(scene.media.rotation);
  const width = Math.abs(scene.sourceWidth * Math.cos(angle)) + Math.abs(scene.sourceHeight * Math.sin(angle));
  const height = Math.abs(scene.sourceWidth * Math.sin(angle)) + Math.abs(scene.sourceHeight * Math.cos(angle));
  const scale = (mode === 'contain' ? Math.min : Math.max)(STORY_WIDTH / width, STORY_HEIGHT / height);
  const base = Math.min(STORY_WIDTH / scene.sourceWidth, STORY_HEIGHT / scene.sourceHeight);
  return { ...scene, media: { ...scene.media, x: 0.5, y: 0.5, zoom: clamp(scale / base, STORY_MIN_ZOOM, STORY_MAX_ZOOM) } };
}

/** Pixel coordinates in the 1080×1920 scene; works identically at every preview size. */
export function applyStoryGesture(scene: StoryScene, textId: string | null, start: StoryPoint[], next: StoryPoint[]): StoryScene {
  if (!start.length || start.length !== next.length) return scene;
  const center = (points: StoryPoint[]) => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length });
  const a = center(start), b = center(next);
  const distance = (points: StoryPoint[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const angle = (points: StoryPoint[]) => Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  const factor = start.length >= 2 ? distance(next) / Math.max(1, distance(start)) : 1;
  const turn = start.length >= 2 ? angle(next) - angle(start) : 0;
  const move = (x: number, y: number, ratio: number) => {
    const offset = rotate({ x: (x * STORY_WIDTH - a.x) * ratio, y: (y * STORY_HEIGHT - a.y) * ratio }, turn);
    return { x: (b.x + offset.x) / STORY_WIDTH, y: (b.y + offset.y) / STORY_HEIGHT };
  };
  if (textId) return { ...scene, texts: scene.texts.map(text => {
    if (text.id !== textId) return text;
    const size = clamp(text.size * factor, 28, 120);
    const position = move(text.x, text.y, size / text.size);
    return { ...text, ...position, x: clamp(position.x, 0.05, 0.95), y: clamp(position.y, 0.05, 0.95), size, rotation: normalizeAngle(text.rotation + turn * 180 / Math.PI) };
  }) };
  const zoom = clamp(scene.media.zoom * factor, STORY_MIN_ZOOM, STORY_MAX_ZOOM);
  const position = move(scene.media.x, scene.media.y, zoom / scene.media.zoom);
  const media = { ...scene.media, ...position, zoom, rotation: normalizeAngle(scene.media.rotation + turn * 180 / Math.PI) };
  const box = storyMediaBox({ ...scene, media });
  // Keep a recoverable part of the photo visible while allowing free framing.
  media.x = clamp(media.x, -box.width / STORY_WIDTH / 2 + 0.04, 1 + box.width / STORY_WIDTH / 2 - 0.04);
  media.y = clamp(media.y, -box.height / STORY_HEIGHT / 2 + 0.04, 1 + box.height / STORY_HEIGHT / 2 - 0.04);
  return { ...scene, media };
}

export function hitStoryText(boxes: StoryTextBox[], point: StoryPoint): string | null {
  for (const box of [...boxes].reverse()) {
    const local = rotate({ x: point.x - box.x, y: point.y - box.y }, -radians(box.rotation));
    if (Math.abs(local.x) <= box.width / 2 + 18 && Math.abs(local.y) <= box.height / 2 + 18) return box.id;
  }
  return null;
}

const colorPattern = /^#[\da-f]{6}$/i;
export function parseStoryScene(input: unknown): StoryScene | null {
  if (!input || typeof input !== 'object') return null;
  const scene = input as StoryScene;
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (scene.version !== 1 || !finite(scene.sourceWidth, 1, 50000) || !finite(scene.sourceHeight, 1, 50000)
    || !colorPattern.test(scene.background) || !scene.media || !finite(scene.media.zoom, STORY_MIN_ZOOM, STORY_MAX_ZOOM)
    || !finite(scene.media.x, -100, 100) || !finite(scene.media.y, -100, 100) || !finite(scene.media.rotation, -360, 360)
    || !Array.isArray(scene.texts) || scene.texts.length > 8) return null;
  for (const text of scene.texts) {
    if (!text || typeof text.id !== 'string' || typeof text.text !== 'string' || text.text.length > 500
      || !finite(text.x, 0, 1) || !finite(text.y, 0, 1) || !finite(text.size, 28, 120) || !finite(text.rotation, -360, 360)
      || !colorPattern.test(text.color) || !Object.prototype.hasOwnProperty.call(STORY_FONTS, text.font)
      || !['left','center','right'].includes(text.align) || !['none','dark','light'].includes(text.background)) return null;
  }
  return scene;
}

function wrapStoryText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width <= width) { line += word; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      for (const char of Array.from(word.trimStart())) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius); ctx.closePath();
}

/** One painter for preview, image export and video text overlays. */
export function drawStoryScene(ctx: CanvasRenderingContext2D, media: CanvasImageSource | null, scene: StoryScene, options: { textOnly?: boolean; selectedId?: string | null; placeholder?: string } = {}): StoryTextBox[] {
  const boxes: StoryTextBox[] = [];
  ctx.save();
  ctx.setTransform(ctx.canvas.width / STORY_WIDTH, 0, 0, ctx.canvas.height / STORY_HEIGHT, 0, 0);
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  if (!options.textOnly) {
    ctx.fillStyle = scene.background; ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    if (media) {
      const box = storyMediaBox(scene);
      ctx.save(); ctx.translate(box.x, box.y); ctx.rotate(radians(box.rotation));
      ctx.drawImage(media, -box.width / 2, -box.height / 2, box.width, box.height); ctx.restore();
    }
  }
  for (const text of scene.texts) {
    const value = text.text || (options.selectedId === text.id ? options.placeholder || '' : '');
    if (!value) continue;
    let size = text.size, lines: string[] = [];
    do {
      ctx.font = `700 ${size}px ${STORY_FONTS[text.font]}`;
      lines = wrapStoryText(ctx, value, STORY_WIDTH - 144);
      if (lines.length * size * 1.25 <= STORY_HEIGHT - 200 || size <= 28) break;
      size -= 2;
    } while (true);
    const width = Math.min(STORY_WIDTH - 80, Math.max(...lines.map(line => ctx.measureText(line).width), 32) + 48);
    const height = lines.length * size * 1.25 + 32;
    const x = clamp(text.x * STORY_WIDTH, width / 2 + 24, STORY_WIDTH - width / 2 - 24);
    const y = clamp(text.y * STORY_HEIGHT, height / 2 + 24, STORY_HEIGHT - height / 2 - 24);
    boxes.push({ id: text.id, x, y, width, height, rotation: text.rotation });
    ctx.save(); ctx.translate(x, y); ctx.rotate(radians(text.rotation));
    if (text.background !== 'none') {
      ctx.fillStyle = text.background === 'dark' ? '#18181be8' : '#fffffff2';
      roundedRect(ctx, -width / 2, -height / 2, width, height, 20); ctx.fill();
    } else { ctx.shadowColor = '#000000aa'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
    ctx.fillStyle = text.color; ctx.textAlign = text.align; ctx.textBaseline = 'top';
    ctx.direction = /^[^\p{L}]*[\u0590-\u08ff]/u.test(value) ? 'rtl' : 'ltr';
    const textX = text.align === 'center' ? 0 : text.align === 'left' ? -width / 2 + 24 : width / 2 - 24;
    lines.forEach((line, index) => ctx.fillText(line, textX, -height / 2 + 16 + index * size * 1.25));
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (options.selectedId === text.id) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
      roundedRect(ctx, -width / 2 - 7, -height / 2 - 7, width + 14, height + 14, 22); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return boxes;
}

export async function exportStoryImage(media: CanvasImageSource, scene: StoryScene): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('STORY_CANVAS_UNAVAILABLE');
  drawStoryScene(ctx, media, scene);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('STORY_EXPORT_FAILED')), 'image/jpeg', 0.94));
}
