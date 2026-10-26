export interface WheelPoint { x: number; y: number }

export function selectWheelLetter(selected: number[], index: number): number[] {
  if (selected.at(-1) === index) return selected;
  if (selected.length > 1 && selected.at(-2) === index) return selected.slice(0, -1);
  return selected.includes(index) ? selected : [...selected, index];
}
export const wheelPoints = (count: number): WheelPoint[] => Array.from({ length: count }, (_, index) => ({
  x: 150 + Math.sin(index * 2 * Math.PI / count) * 105, y: 150 - Math.cos(index * 2 * Math.PI / count) * 105,
}));
export function crossedLetters(from: WheelPoint, to: WheelPoint, points: WheelPoint[]): number[] {
  const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  return points.map((point, index) => {
    const position = length ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length)) : 0;
    return { index, position, distance: Math.hypot(from.x + dx * position - point.x, from.y + dy * position - point.y) };
  }).filter(hit => hit.distance <= 24).sort((a, b) => a.position - b.position).map(hit => hit.index);
}
