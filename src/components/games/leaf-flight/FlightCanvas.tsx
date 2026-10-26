import { useEffect, useRef, type MutableRefObject } from 'react';
import { flightGateGaps, flightWind } from './engine';
import { FLIGHT_HEIGHT, FLIGHT_PLAYER_X, type FlightLevel, type FlightState } from './model';
import tumurcuq from '@/assets/onboarding/pregnancy-mode.webp';

export default function FlightCanvas({ level, state, lifting, label }: {
  level: FlightLevel; state: MutableRefObject<FlightState | null>; lifting: MutableRefObject<boolean>; label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image(); image.src = tumurcuq;
    const el = canvas.current, ctx = el?.getContext('2d'); if (!ctx || !el) return;
    let frame = 0, previousWidth = 0, previousHeight = 0;
    const draw = () => {
      const box = el.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      if (!box.width || !box.height) { frame = requestAnimationFrame(draw); return; }
      if (box.width !== previousWidth || box.height !== previousHeight) {
        previousWidth = box.width; previousHeight = box.height; el.width = Math.round(box.width * ratio); el.height = Math.round(box.height * ratio);
      }
      const scale = el.height / FLIGHT_HEIGHT, width = el.width / scale, round = state.current;
      const distance = round?.distance || 0, time = round?.time || 0, y = round?.y || 360;
      ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, width, FLIGHT_HEIGHT);
      const sky = ctx.createLinearGradient(0, 0, 0, FLIGHT_HEIGHT); sky.addColorStop(0, '#e9edf5'); sky.addColorStop(.6, '#f6eeda'); sky.addColorStop(1, '#d5e4c2');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, FLIGHT_HEIGHT);
      ctx.fillStyle = '#fff4c3'; ctx.beginPath(); ctx.arc(width - 65, 95, 44, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const x = ((i * 230 - distance * .18) % (width + 230) + width + 230) % (width + 230) - 110;
        const cy = 110 + i % 3 * 60;
        ctx.fillStyle = '#fffdf3a6'; ctx.beginPath(); ctx.ellipse(x, cy, 63, 14, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? '#a1bea27a' : '#c1d1b17a'; ctx.beginPath(); ctx.moveTo(0, FLIGHT_HEIGHT);
        for (let x = 0; x <= width + 20; x += 20) ctx.lineTo(x, 615 + layer * 45 + Math.sin((x + distance * (.1 + layer * .06)) / (110 - layer * 30)) * 38);
        ctx.lineTo(width, FLIGHT_HEIGHT); ctx.closePath(); ctx.fill();
      }
      for (const wind of level.winds) {
        const x = wind.from - distance, span = wind.to - wind.from;
        if (x > width || x + span < 0) continue;
        ctx.fillStyle = '#c7dfd338'; ctx.fillRect(x, 0, span, FLIGHT_HEIGHT);
        ctx.strokeStyle = '#89b1a25c'; ctx.lineWidth = 2;
        for (let j = 0; j < 6; j++) { const py = ((j * 128 + time * (wind.force < 0 ? -35 : 35)) % 760 + 760) % 760;
          ctx.beginPath(); ctx.moveTo(x + 24, py + 6); ctx.quadraticCurveTo(x + span / 2, py - 15, x + span - 20, py); ctx.stroke();
          const ax = x + span / 2; ctx.beginPath(); ctx.moveTo(ax - 6, py + (wind.force < 0 ? 5 : -5)); ctx.lineTo(ax, py + (wind.force < 0 ? -3 : 3)); ctx.lineTo(ax + 6, py + (wind.force < 0 ? 5 : -5)); ctx.stroke();
        }
      }
      const branch = (x: number, from: number, to: number, breadth: number) => {
        if (to <= from) return;
        ctx.fillStyle = '#aa947a'; ctx.fillRect(x + 7, from, breadth - 14, to - from);
        ctx.strokeStyle = '#796b5345'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + breadth / 2, from + 5); ctx.lineTo(x + breadth / 2 - 5, to - 5); ctx.stroke();
        ctx.fillStyle = '#8eae78'; ctx.beginPath(); ctx.roundRect(x, Math.max(from, to - 16), breadth, Math.min(16, to - from), 8); ctx.fill();
        ctx.fillStyle = '#a9c78e'; ctx.beginPath(); ctx.roundRect(x, from, breadth, Math.min(16, to - from), 8); ctx.fill();
        for (let py = from + 30; py < to - 25; py += 54) { ctx.fillStyle = py % 2 ? '#89a872' : '#95b77c'; ctx.beginPath(); ctx.ellipse(x + 3, py, 17, 10, -.5, 0, Math.PI * 2); ctx.fill(); }
      };
      for (const gate of level.gates) {
        const x = gate.x - distance; if (x > width + 20 || x + gate.width < -20) continue;
        const gaps = flightGateGaps(gate, time).sort((a, b) => a.center - b.center);
        let previous = 0;
        for (const gap of gaps) { branch(x, previous, gap.center - gap.height / 2, gate.width); previous = gap.center + gap.height / 2; }
        branch(x, previous, FLIGHT_HEIGHT, gate.width);
        if (gate.secret) {
          ctx.setLineDash([4, 8]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#b6a34e88'; ctx.beginPath(); ctx.ellipse(x + gate.width / 2, gate.secret.center, gate.width / 2 + 12, gate.secret.height / 2 - 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      for (const star of level.stars) {
        const x = star.x - distance; if (x < -20 || x > width + 20 || round?.collected.includes(star.id)) continue;
        ctx.fillStyle = star.secret ? '#ba96e2' : '#e1b957'; ctx.strokeStyle = '#fff7d3'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? 6 : 13; const sx = x + Math.cos(angle) * radius, sy = star.y + Math.sin(angle) * radius;
          if (!i) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      const finishX = level.distance + FLIGHT_PLAYER_X - distance;
      if (finishX < width + 70) { ctx.strokeStyle = '#a79bc0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(finishX, 140); ctx.lineTo(finishX, 600); ctx.stroke();
        ctx.fillStyle = '#e4c3d1'; ctx.beginPath(); ctx.moveTo(finishX, 140); ctx.lineTo(finishX + 70, 165); ctx.lineTo(finishX, 190); ctx.closePath(); ctx.fill(); }
      ctx.save(); ctx.translate(FLIGHT_PLAYER_X, y); ctx.rotate(Math.max(-.15, Math.min(.15, (round?.velocity || 0) / 1300)));
      if (round && round.shield > 0 && round.hearts < 3) ctx.globalAlpha = .65 + Math.sin(time * 20) * .25;
      ctx.strokeStyle = '#8d8773'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-48, -53); ctx.lineTo(-9, 10); ctx.moveTo(48, -53); ctx.lineTo(9, 10); ctx.stroke();
      const leaf = ctx.createLinearGradient(-55, -80, 55, -40); leaf.addColorStop(0, '#badb8d'); leaf.addColorStop(1, '#6da26d'); ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.moveTo(-59, -54); ctx.quadraticCurveTo(-19, -110, 61, -57); ctx.quadraticCurveTo(15, -28, -59, -54); ctx.fill();
      ctx.strokeStyle = '#6b966488'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-54, -56); ctx.quadraticCurveTo(0, -74, 55, -58); ctx.stroke();
      if (image.complete && image.naturalWidth) ctx.drawImage(image, -37, -25, 74, 78);
      else { ctx.fillStyle = '#b77ad7'; ctx.beginPath(); ctx.ellipse(0, 13, 17, 24, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (lifting.current) { ctx.strokeStyle = '#ffffff8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(FLIGHT_PLAYER_X - 10, y + 65); ctx.lineTo(FLIGHT_PLAYER_X - 10, y + 88); ctx.moveTo(FLIGHT_PLAYER_X + 10, y + 58); ctx.lineTo(FLIGHT_PLAYER_X + 10, y + 78); ctx.stroke(); }
      if (flightWind(level, distance + FLIGHT_PLAYER_X)) { ctx.fillStyle = '#6c9b81'; ctx.beginPath(); ctx.ellipse(width - 30, 38, 8, 4, -.5, 0, Math.PI * 2); ctx.fill(); }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [level, state, lifting]);
  return <canvas ref={canvas} className="flight-canvas" role="img" aria-label={label} data-testid="flight-canvas" />;
}
