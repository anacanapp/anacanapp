import type { Input, Vec2 } from './model';

export const ISO_X = Math.sqrt(3) / 2;
export const ISO_Y = .52;

export function project(point: Vec2): Vec2 {
  return { x: (point.x - point.y) * ISO_X, y: (point.x + point.y) * ISO_Y };
}
export function unproject(point: Vec2): Vec2 {
  return { x: point.x / (2 * ISO_X) + point.y / (2 * ISO_Y), y: -point.x / (2 * ISO_X) + point.y / (2 * ISO_Y) };
}
/** Keep touch direction screen-relative after the world is tilted into an isometric plane. */
export function screenInputToWorld(input: Input): Input {
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  if (!magnitude) return { x: 0, y: 0, boost: input.boost, ...(input.pivot !== undefined ? { pivot: input.pivot } : {}) };
  const direction = unproject(input);
  const length = Math.hypot(direction.x, direction.y);
  return { x: direction.x / length * magnitude, y: direction.y / length * magnitude, boost: input.boost, ...(input.pivot !== undefined ? { pivot: input.pivot } : {}) };
}
export const depthAt = (point: Vec2) => project(point).y;
