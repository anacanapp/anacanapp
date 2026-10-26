import { drawLogo } from './logo-art';
import type { PlayerLook } from './cosmetics';
import type { AssetKind, DistrictKind } from './model';
import { ISO_X, ISO_Y } from './isometric';
import { FUND_BY_ID } from './market';
import type { FundId, OpportunityKind } from './market';

export interface PaintedTexture { canvas: HTMLCanvasElement; anchorX: number; anchorY: number; unit: number }
export const TEXTURE_DENSITY = 2;
type Ctx = CanvasRenderingContext2D;
type Point = [number, number];

function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width * TEXTURE_DENSITY; element.height = height * TEXTURE_DENSITY;
  const ctx = element.getContext('2d')!; ctx.scale(TEXTURE_DENSITY, TEXTURE_DENSITY);
  return { canvas: element, ctx };
}
function polygon(ctx: Ctx, points: Point[], fill: string, stroke?: string, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function iso(x: number, y: number, z = 0, ox = 0, oy = 0): Point { return [ox + (x - y) * ISO_X, oy + (x + y) * ISO_Y - z]; }
function line(ctx: Ctx, a: Point, b: Point, color: string, width = 1) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }

/** A shaded isometric box, used for architecture and its roof equipment. */
function box(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, ox: number, oy: number, colors: [string, string, string], stroke = '#b7d2e322') {
  polygon(ctx, [iso(x + w, y, 0, ox, oy), iso(x + w, y + d, 0, ox, oy), iso(x + w, y + d, h, ox, oy), iso(x + w, y, h, ox, oy)], colors[1], stroke, .7);
  polygon(ctx, [iso(x, y + d, 0, ox, oy), iso(x + w, y + d, 0, ox, oy), iso(x + w, y + d, h, ox, oy), iso(x, y + d, h, ox, oy)], colors[2], stroke, .7);
  polygon(ctx, [iso(x, y, h, ox, oy), iso(x + w, y, h, ox, oy), iso(x + w, y + d, h, ox, oy), iso(x, y + d, h, ox, oy)], colors[0], stroke, .7);
}
function shadow(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, ox: number, oy: number) {
  polygon(ctx, [iso(x, y, 0, ox, oy), iso(x + w, y, 0, ox, oy), iso(x + w + h * .42, y + d + h * .16, 0, ox, oy), iso(x + h * .42, y + d + h * .16, 0, ox, oy)], '#060e1844');
}

export function paintGround(district: DistrictKind, variant: number, details: boolean): PaintedTexture {
  const { canvas: element, ctx } = canvas(512, 336); const ox = 256; const oy = 22; const unit = 240;
  polygon(ctx, [iso(0, 0, 0, ox, oy), iso(240, 0, 0, ox, oy), iso(240, 240, 0, ox, oy), iso(0, 240, 0, ox, oy)], '#182a35');
  // Continuous two-lane avenues. The curb is a real vertical face instead of a flat outline.
  const colors: Record<DistrictKind, [string, string, string]> = {
     park: ['#294439', '#1c302d', '#243a32'], studios: ['#30434d', '#22323b', '#2a3a43'],
     tech: ['#314652', '#243440', '#2b3c47'], downtown: ['#394850', '#28343e', '#303e46'], waterfront: ['#2d4147', '#203238', '#293b40'],
  };
  box(ctx, 30, 30, 180, 180, 5, ox, oy, colors[district]);
  for (let step = 35; step < 235; step += 38) {
    line(ctx, iso(step, 12, 0, ox, oy), iso(step + 12, 12, 0, ox, oy), '#627c892e', 1);
    line(ctx, iso(12, step, 0, ox, oy), iso(12, step + 12, 0, ox, oy), '#627c892e', 1);
  }
  line(ctx, iso(25, 30, 0, ox, oy), iso(25, 210, 0, ox, oy), '#bdcdd21b', .7);
  line(ctx, iso(30, 25, 0, ox, oy), iso(210, 25, 0, ox, oy), '#bdcdd21b', .7);
  if (district === 'park') {
    polygon(ctx, [iso(60, 48, 5, ox, oy), iso(189, 48, 5, ox, oy), iso(189, 65, 5, ox, oy), iso(60, 65, 5, ox, oy)], '#56725865');
    polygon(ctx, [iso(104, 48, 5, ox, oy), iso(120, 48, 5, ox, oy), iso(120, 191, 5, ox, oy), iso(104, 191, 5, ox, oy)], '#526d5360');
    if (variant % 2 === 0) {
      const p = iso(145, 139, 5, ox, oy); ctx.fillStyle = '#2f565a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 27, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7c9f984b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#74b9b273'; ctx.beginPath(); ctx.ellipse(p[0], p[1] - 3, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
      box(ctx, 140, 134, 9, 9, 13, ox, oy, ['#85a6a4', '#45686b', '#597e7c']);
    } else {
      polygon(ctx, [iso(135, 88, 6, ox, oy), iso(190, 88, 6, ox, oy), iso(190, 177, 6, ox, oy), iso(135, 177, 6, ox, oy)], '#2b5646', '#abc4a53d');
      line(ctx, iso(135, 130, 6, ox, oy), iso(190, 130, 6, ox, oy), '#accaa34d');
      const p = iso(162, 130, 6, ox, oy); ctx.strokeStyle = '#accaa34d'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 8, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (district === 'waterfront') {
     polygon(ctx, [iso(49, 44, 5, ox, oy), iso(194, 44, 5, ox, oy), iso(194, 174, 5, ox, oy), iso(49, 174, 5, ox, oy)], '#2c5159', '#769daa40');
    for (let step = 0; step < 7; step++) line(ctx, iso(59 + step * 15, 51, 5, ox, oy), iso(69 + step * 15, 165, 5, ox, oy), '#79aebb14', 1);
    box(ctx, 124, 164, 55, 15, 8, ox, oy, ['#8a8270', '#514d47', '#68614f']);
    for (let i = 0; i < 4; i++) line(ctx, iso(133 + i * 12, 164, 8, ox, oy), iso(133 + i * 12, 178, 8, ox, oy), '#c7b99440', .7);
  } else {
    for (let i = 48; i < 206; i += 25) {
      line(ctx, iso(i, 33, 5, ox, oy), iso(i, 207, 5, ox, oy), '#bbd2dc08');
      line(ctx, iso(33, i, 5, ox, oy), iso(207, i, 5, ox, oy), '#bbd2dc08');
    }
    if (details) {
      polygon(ctx, [iso(48, 174, 6, ox, oy), iso(188, 174, 6, ox, oy), iso(188, 181, 6, ox, oy), iso(48, 181, 6, ox, oy)], '#4a675259');
      for (let i = 150; i < 199; i += 15) line(ctx, iso(i, 190, 6, ox, oy), iso(i, 205, 6, ox, oy), '#beced329');
      if (district === 'tech') {
        box(ctx, 55, 43, 35, 18, 3, ox, oy, ['#416675', '#273f4c', '#2d4652']);
        for (let i = 0; i < 4; i++) line(ctx, iso(60 + i * 7, 43, 4, ox, oy), iso(60 + i * 7, 61, 4, ox, oy), '#abd2e037', .7);
      }
    }
  }
  if (details && variant % 2 === 0) {
    for (let i = 0; i < 4; i++) polygon(ctx, [iso(5, 47 + i * 9, 0, ox, oy), iso(24, 47 + i * 9, 0, ox, oy), iso(24, 51 + i * 9, 0, ox, oy), iso(5, 51 + i * 9, 0, ox, oy)], '#bacbd24b');
  }
  return { canvas: element, anchorX: .5, anchorY: oy * TEXTURE_DENSITY / element.height, unit: unit * TEXTURE_DENSITY };
}

function windows(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, ox: number, oy: number, accent: string, variant: number) {
  const columns = Math.max(2, Math.floor(w / 12)); const rows = Math.max(2, Math.floor(h / 14));
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const z = 11 + row * 13; const xx = x + 5 + col * w / columns;
      const color = (col + row + variant) % 4 === 0 ? '#dfe6b39c' : accent;
      polygon(ctx, [iso(xx, y + d + .3, z, ox, oy), iso(xx + 6, y + d + .3, z, ox, oy), iso(xx + 6, y + d + .3, z + 7, ox, oy), iso(xx, y + d + .3, z + 7, ox, oy)], color);
    }
  }
  for (let col = 0; col < Math.max(2, Math.floor(d / 13)); col++) {
    for (let row = 0; row < rows; row++) {
      const yy = y + 6 + col * 13; const z = 11 + row * 13;
      polygon(ctx, [iso(x + w + .3, yy, z, ox, oy), iso(x + w + .3, yy + 6, z, ox, oy), iso(x + w + .3, yy + 6, z + 7, ox, oy), iso(x + w + .3, yy, z + 7, ox, oy)], (col + row + variant) % 5 ? '#54748980' : '#d7deb073');
    }
  }
}

export function paintResource(kind: AssetKind, variant = 0): PaintedTexture {
  const { canvas: element, ctx } = canvas(256, 286); const ox = 128; const oy = 203; const unit = 100;
  if (kind === 'investment') {
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(ox + 5, oy + 7, 36, 12, 0, 0, Math.PI * 2); ctx.fill();
    box(ctx, -29, -14, 58, 28, 5, ox, oy - 7, ['#c6e1a8', '#689263', '#88b27b']);
    const p = iso(0, 0, 7, ox, oy - 7);
    ctx.save(); ctx.translate(...p); ctx.transform(1, -.28, .4, .63, 0, 0); ctx.fillStyle = '#355d38'; ctx.font = '700 31px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, -1); ctx.restore();
  } else if (kind === 'gpu') {
    shadow(ctx, -41, -24, 82, 48, 30, ox, oy);
    box(ctx, -41, -24, 82, 48, 10, ox, oy - 9, ['#578494', '#24434f', '#365965']);
    for (const xx of [-19, 19]) {
      const p = iso(xx, 0, 12, ox, oy - 9);
      ctx.fillStyle = '#192e3d'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 15, 9, -.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#84cddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p[0], p[1], 10, 6, -.32, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#a9e1e5'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 7; i++) box(ctx, -33 + i * 9, 25, 4, 7, 2, ox, oy - 9, ['#d8c989', '#8d7947', '#b3a368']);
  } else if (kind === 'server') {
    shadow(ctx, -24, -24, 48, 48, 95, ox, oy); box(ctx, -24, -24, 48, 48, 100, ox, oy, ['#577585', '#223744', '#36535f']);
    for (let i = 0; i < 6; i++) {
      const z = 13 + i * 14;
      polygon(ctx, [iso(-19, 25, z, ox, oy), iso(19, 25, z, ox, oy), iso(19, 25, z + 8, ox, oy), iso(-19, 25, z + 8, ox, oy)], '#122c38');
      const p = iso(-12, 25, z + 4, ox, oy); ctx.fillStyle = '#91dbbd'; ctx.beginPath(); ctx.arc(...p, 1.4, 0, Math.PI * 2); ctx.fill();
      line(ctx, iso(-3, 25, z + 4, ox, oy), iso(14, 25, z + 4, ox, oy), '#759cab', 1.2);
    }
  } else {
    const tower = kind === 'tower' || kind === 'hq'; const campus = kind === 'campus'; const data = kind === 'data-center';
    const w = campus || data ? 92 : 64; const d = campus ? 70 : data ? 58 : 56;
    const h = tower ? 133 : campus ? 57 : data ? 51 : 74;
    shadow(ctx, -w / 2, -d / 2, w, d, h, ox, oy);
    box(ctx, -w / 2, -d / 2, w, d, h, ox, oy, tower ? ['#889cb1', '#364658', '#4c6074'] : data ? ['#71949f', '#304d5b', '#426a78'] : campus ? ['#8ba38a', '#3e6254', '#557b67'] : ['#a3adc1', '#465269', '#62718c']);
    windows(ctx, -w / 2, -d / 2, w, d, h - 12, ox, oy, tower ? '#9ac2d29c' : '#b4d0dc80', variant);
    // Parapets, AC units, skylights, solar arrays and antenna complete the roof silhouette.
    box(ctx, -w / 2 + 3, -d / 2 + 3, w - 6, d - 6, 3, ox, oy - h, ['#526b7e', '#3d505f', '#425767']);
    if (tower) {
      box(ctx, -17, -10, 29, 27, 12, ox, oy - h - 3, ['#a0b1bf', '#576a7d', '#6f8398']);
      const p = iso(7, 3, h + 18, ox, oy); line(ctx, p, [p[0], p[1] - 25], '#adc4d0', 1.3); ctx.fillStyle = '#b8ea9a'; ctx.beginPath(); ctx.arc(p[0], p[1] - 26, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      box(ctx, -22, -16, 19, 15, 8, ox, oy - h - 3, ['#a1b9c3', '#55717d', '#75939c']);
      box(ctx, 3, 0, 24, 17, 3, ox, oy - h - 4, ['#538296', '#315065', '#376375']);
      for (let i = 0; i < 3; i++) line(ctx, iso(6 + i * 7, 0, h + 8, ox, oy), iso(6 + i * 7, 17, h + 8, ox, oy), '#b2daea65', .7);
    }
    if (campus) {
      box(ctx, -43, 42, 86, 7, 5, ox, oy, ['#82a36b', '#456747', '#507453']);
      box(ctx, -43, 33, 20, 10, 23, ox, oy, ['#a1b994', '#57735a', '#7f9b75']);
    }
  }
  return { canvas: element, anchorX: .5, anchorY: oy * TEXTURE_DENSITY / element.height, unit: unit * TEXTURE_DENSITY };
}

export type PropKind = 'tree' | 'lamp' | 'bench' | 'car';
export function paintProp(kind: PropKind, variant = 0): PaintedTexture {
  const { canvas: element, ctx } = canvas(100, 132); const ox = 50; const oy = 103; const unit = 45;
  if (kind === 'tree') {
    ctx.fillStyle = '#06132145'; ctx.beginPath(); ctx.ellipse(ox + 9, oy + 5, 23, 10, -.35, 0, Math.PI * 2); ctx.fill();
    box(ctx, -3, -3, 6, 6, 33, ox, oy, ['#91836b', '#4d4d3b', '#6e6752']);
    const gradient = ctx.createRadialGradient(40, 57, 3, 51, 63, 31); gradient.addColorStop(0, variant % 2 ? '#88a974' : '#71997e'); gradient.addColorStop(1, '#355c4b');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(50, 66, 22, 0, Math.PI * 2); ctx.arc(35, 65, 17, 0, Math.PI * 2); ctx.arc(49, 48, 18, 0, Math.PI * 2); ctx.arc(66, 64, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a0b99444'; ctx.beginPath(); ctx.arc(41, 49, 8, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'lamp') {
    box(ctx, -4, -4, 8, 8, 3, ox, oy, ['#6c8592', '#36474e', '#506373']);
    line(ctx, [ox, oy - 2], [ox, 34], '#90a7ae', 2); line(ctx, [ox, 34], [ox + 12, 28], '#b6c4c6', 2);
    ctx.fillStyle = '#ffe9a6c7'; ctx.beginPath(); ctx.ellipse(ox + 12, 28, 4, 2, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2d69410'; ctx.beginPath(); ctx.ellipse(ox + 10, oy, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'bench') {
    box(ctx, -22, -4, 44, 9, 7, ox, oy, ['#b5a17d', '#6f624e', '#8d7d61']);
    box(ctx, -22, -10, 44, 4, 20, ox, oy, ['#c2ac88', '#6f624e', '#a18c6e']);
    line(ctx, iso(-20, -7, 14, ox, oy), iso(20, -7, 14, ox, oy), '#d3bd9366');
  } else {
    shadow(ctx, -22, -12, 44, 24, 18, ox, oy);
    const body = ['#83aba3', '#b9afa0', '#879cb4'][variant % 3];
    box(ctx, -22, -12, 44, 24, 12, ox, oy - 4, [body, '#304c54', '#59737f']);
    box(ctx, -10, -9, 23, 18, 10, ox, oy - 16, ['#adc6d6', '#355569', '#4c7186']);
    ctx.fillStyle = '#f2e5b1b8'; const p = iso(22, 8, 10, ox, oy); ctx.beginPath(); ctx.arc(...p, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  return { canvas: element, anchorX: .5, anchorY: oy * TEXTURE_DENSITY / element.height, unit: unit * TEXTURE_DENSITY };
}

/** 2D medallion with a raised bevel, lower face and environment shadow. */
export function paintActor(logo: string, color: string, look?: PlayerLook): PaintedTexture {
  const { canvas: element, ctx } = canvas(220, 224); const x = 110; const y = 142; const r = 74;
  ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.ellipse(x + 9, y + 8, 78, 34, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b1827'; ctx.beginPath(); ctx.ellipse(x, y - 18, r, r * .8, 0, 0, Math.PI * 2); ctx.fill();
  const faceY = y - 33;
  const gradient = ctx.createRadialGradient(x - 26, faceY - 33, 0, x, faceY, r);
  gradient.addColorStop(0, '#466170'); gradient.addColorStop(.4, '#253b4e'); gradient.addColorStop(1, '#18283a');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(x, faceY, r, r * .83, 0, 0, Math.PI * 2); ctx.fill();
   ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#eff8ff47'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, faceY, r - 7, (r - 7) * .83, 0, Math.PI * 1.05, Math.PI * 1.82); ctx.stroke();
   ctx.save(); ctx.translate(x, faceY - 3); ctx.scale(1, .88); drawLogo(ctx, logo, 0, 0, 72, color, look); ctx.restore();
  if (look?.frame === 'hex') {
    const points: Point[] = Array.from({ length: 6 }, (_, index) => { const a = index / 6 * Math.PI * 2; return [x + Math.cos(a) * 85, faceY + Math.sin(a) * 70]; });
    polygon(ctx, points, '#00000000', color + '88', 2);
  }
  if (look?.frame === 'crown') {
    polygon(ctx, [[87, faceY - 67], [82, faceY - 91], [100, faceY - 80], [110, faceY - 104], [121, faceY - 80], [139, faceY - 91], [133, faceY - 67]], '#e4cb8b', '#f6e6b750');
  }
  return { canvas: element, anchorX: .5, anchorY: y * TEXTURE_DENSITY / element.height, unit: 148 * TEXTURE_DENSITY };
}

export function paintSpark(): PaintedTexture {
  const { canvas: element, ctx } = canvas(48, 48);
  const glow = ctx.createRadialGradient(24, 24, 0, 24, 24, 23); glow.addColorStop(0, '#ffffff'); glow.addColorStop(.22, '#c7ffc5bb'); glow.addColorStop(1, '#96ec9c00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 48, 48);
  return { canvas: element, anchorX: .5, anchorY: .5, unit: 48 * TEXTURE_DENSITY };
}

export function paintOpportunity(kind: OpportunityKind, fund: FundId = 'angel'): PaintedTexture {
  const { canvas: element, ctx } = canvas(190, 205); const ox = 95; const oy = 159; const color = kind === 'fund' ? FUND_BY_ID(fund).color : kind === 'audit' ? '#df8f9b' : kind === 'talent' ? '#bce095' : kind === 'cloud-credit' ? '#86cfe8' : '#bca6e9';
  ctx.fillStyle = color + '12'; ctx.beginPath(); ctx.ellipse(ox, oy + 5, 61, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color + '88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ox, oy, 46, 23, 0, 0, Math.PI * 2); ctx.stroke();
  if (kind === 'fund') {
    shadow(ctx, -34, -22, 68, 44, 53, ox, oy);
    box(ctx, -34, -22, 68, 44, 7, ox, oy, ['#91a2a0', '#344e57', '#537078']);
    for (const x of [-24, -7, 10, 27]) box(ctx, x - 3, 17, 5, 5, 39, ox, oy - 8, [color, '#516458', '#8eaa82']);
    box(ctx, -35, -23, 70, 45, 8, ox, oy - 51, [color, '#617c6e', '#84957f']);
    polygon(ctx, [iso(-38, -22, 60, ox, oy), iso(0, -22, 88, ox, oy), iso(37, -22, 60, ox, oy), iso(37, 22, 60, ox, oy), iso(0, 22, 88, ox, oy), iso(-38, 22, 60, ox, oy)], color, '#f5ecc76b');
    const p = iso(0, 23, 34, ox, oy); ctx.save(); ctx.translate(...p); ctx.transform(.85, .5, 0, 1, 0, 0); ctx.fillStyle = '#f2e9c4'; ctx.font = '700 25px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 0); ctx.restore();
  } else {
    box(ctx, -25, -20, 50, 40, 11, ox, oy, [color + 'bb', '#375769', '#567c84']);
    const center = oy - 47; const gradient = ctx.createRadialGradient(ox - 7, center - 10, 2, ox, center, 35); gradient.addColorStop(0, color); gradient.addColorStop(1, '#183147');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(ox, center, 32, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#eaf3e6'; ctx.strokeStyle = '#eef3e1'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'cloud-credit') polygon(ctx, [[ox + 2, center - 22], [ox - 15, center + 3], [ox - 2, center + 3], [ox - 6, center + 22], [ox + 16, center - 6], [ox + 3, center - 6]], '#ebf4df');
    else if (kind === 'talent') { ctx.beginPath(); ctx.arc(ox, center - 8, 7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(ox, center + 12, 13, Math.PI, 0); ctx.stroke(); }
    else if (kind === 'patent') { ctx.strokeRect(ox - 12, center - 17, 24, 33); ctx.beginPath(); ctx.moveTo(ox - 5, center - 8); ctx.lineTo(ox + 6, center - 8); ctx.moveTo(ox - 5, center); ctx.lineTo(ox + 6, center); ctx.stroke(); }
    else { ctx.font = '700 38px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', ox, center + 1); }
  }
  return { canvas: element, anchorX: .5, anchorY: oy * TEXTURE_DENSITY / element.height, unit: 90 * TEXTURE_DENSITY };
}
