import type { AssetKind } from './model';

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, width, height, radius); return; }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle = -Math.PI / 4, color = '#b9ff6b', flame = false, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(size / 100, size / 100);
  if (flame) {
    ctx.fillStyle = '#ffd480';
    ctx.beginPath(); ctx.moveTo(-12, 27); ctx.quadraticCurveTo(-12, 60 + Math.sin(time * 22) * 9, 0, 72); ctx.quadraticCurveTo(12, 50, 12, 27); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-5, 27); ctx.lineTo(0, 53); ctx.lineTo(5, 27); ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -45); ctx.bezierCurveTo(31, -30, 33, 4, 22, 29); ctx.lineTo(-22, 29); ctx.bezierCurveTo(-33, 4, -31, -30, 0, -45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-24, -1); ctx.lineTo(-41, 22); ctx.lineTo(-41, 40); ctx.lineTo(-20, 28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(24, -1); ctx.lineTo(41, 22); ctx.lineTo(41, 40); ctx.lineTo(20, 28); ctx.fill();
  ctx.fillStyle = '#101c2b';
  ctx.beginPath(); ctx.arc(0, -11, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff66';
  ctx.beginPath(); ctx.arc(-3, -14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawAsset(ctx: CanvasRenderingContext2D, kind: AssetKind, x: number, y: number, radius: number, color: string, edible = true, time = 0, phase = 0, showLock = true) {
  ctx.save();
  ctx.translate(x, y);
  const size = Math.max(4, radius);
  ctx.scale(size / 30, size / 30);
  const bob = kind === 'investment' ? Math.sin(time * 1.5 + phase) * .8 : 0;
  ctx.translate(0, bob);
  if (!edible) ctx.globalAlpha = .38;
  if (kind === 'investment') {
    ctx.fillStyle = '#aecf8908';
    ctx.beginPath(); ctx.arc(0, 0, 33, 0, Math.PI * 2); ctx.fill();
    const note = ctx.createLinearGradient(-20, -18, 22, 18); note.addColorStop(0, '#c4e69f'); note.addColorStop(1, '#87b575'); ctx.fillStyle = note;
    roundedRect(ctx, -25, -18, 50, 36, 9); ctx.fill();
    ctx.strokeStyle = '#172b1c'; ctx.lineWidth = 2.5;
    roundedRect(ctx, -18, -12, 36, 24, 5); ctx.stroke();
    ctx.fillStyle = '#172b1c'; ctx.font = 'bold 25px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
  } else if (kind === 'gpu') {
    ctx.fillStyle = '#00000038'; roundedRect(ctx, -29, -16, 60, 42, 9); ctx.fill();
    const shell = ctx.createLinearGradient(-30, -22, 20, 18); shell.addColorStop(0, '#426c81'); shell.addColorStop(1, '#1d384b'); ctx.fillStyle = shell; roundedRect(ctx, -30, -22, 60, 40, 6); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    for (const cx of [-13, 13]) {
      ctx.fillStyle = '#102631'; ctx.beginPath(); ctx.arc(cx, -2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, -2, 7, time + phase, time + phase + Math.PI * 1.65); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd480'; for (let px = -19; px < 22; px += 8) ctx.fillRect(px, 19, 5, 5);
  } else if (kind === 'server') {
    ctx.fillStyle = '#142d37'; roundedRect(ctx, -21, -35, 42, 65, 5); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    for (let row = 0; row < 4; row++) {
      ctx.fillStyle = '#23545d'; roundedRect(ctx, -16, -28 + row * 14, 32, 10, 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-10, -23 + row * 14, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#86b6bd'; ctx.fillRect(-2, -25 + row * 14, 12, 3);
    }
    ctx.fillStyle = '#091821'; ctx.fillRect(-16, 31, 8, 5); ctx.fillRect(8, 31, 8, 5);
  } else {
    const tall = kind === 'tower' || kind === 'hq';
    const height = tall ? 69 : kind === 'data-center' ? 38 : 46;
    const width = kind === 'campus' || kind === 'data-center' ? 63 : 42;
    ctx.fillStyle = '#00000035';
    roundedRect(ctx, -width / 2 - 5, -height / 2 + 12, width + 18, height + 9, 5); ctx.fill();
    const facade = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2); facade.addColorStop(0, kind === 'office' ? '#666080' : kind === 'campus' ? '#7c5870' : '#4f6695'); facade.addColorStop(1, kind === 'office' ? '#393551' : kind === 'campus' ? '#463248' : '#293b60'); ctx.fillStyle = facade;
    ctx.beginPath(); ctx.moveTo(-width / 2, -height / 2); ctx.lineTo(width / 2, -height / 2); ctx.lineTo(width / 2, height / 2); ctx.lineTo(-width / 2, height / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = kind === 'campus' ? '#a17e98' : '#7685a7';
    ctx.beginPath(); ctx.moveTo(-width / 2, -height / 2); ctx.lineTo(-width / 2 + 12, -height / 2 - 12); ctx.lineTo(width / 2 + 12, -height / 2 - 12); ctx.lineTo(width / 2, -height / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1e2944';
    ctx.beginPath(); ctx.moveTo(width / 2, -height / 2); ctx.lineTo(width / 2 + 12, -height / 2 - 12); ctx.lineTo(width / 2 + 12, height / 2 - 12); ctx.lineTo(width / 2, height / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color + '99'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = color;
    for (let wy = -height / 2 + 8; wy < height / 2 - 7; wy += 12) {
      for (let wx = -width / 2 + 7; wx < width / 2 - 5; wx += 11) {
        ctx.globalAlpha = edible ? (((wx + wy) % 3 === 0) ? 0.9 : 0.42) : 0.3;
        ctx.fillRect(wx, wy, 5, 5);
      }
    }
    ctx.globalAlpha = edible ? 1 : 0.62;
    if (tall) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -height / 2 - 9); ctx.lineTo(6, -height / 2 - 24); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(6, -height / 2 - 25, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (kind === 'campus') {
      ctx.fillStyle = '#2c4a3e'; roundedRect(ctx, -40, 26, 80, 11, 4); ctx.fill();
      ctx.fillStyle = '#62ecc0'; ctx.beginPath(); ctx.arc(-30, 27, 7, 0, Math.PI * 2); ctx.arc(31, 27, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (showLock && !edible && kind !== 'investment') {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#080f1cd9'; roundedRect(ctx, 12, 11, 23, 23, 7); ctx.fill();
    ctx.strokeStyle = '#8a99ae'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(23, 20, 4, Math.PI, 0); ctx.stroke();
    roundedRect(ctx, 17, 20, 12, 9, 2); ctx.stroke();
  }
  ctx.restore();
}
