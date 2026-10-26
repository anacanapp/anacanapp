import { describe, expect, it } from 'vitest';
import { depthAt, project, screenInputToWorld, unproject } from './isometric';

describe('isometric camera and touch coordinates', () => {
  it.each([{ x: 0, y: 0 }, { x: 742, y: -18 }, { x: -281, y: -433 }])('round-trips world position $x,$y', point => {
    const restored = unproject(project(point)); expect(restored.x).toBeCloseTo(point.x); expect(restored.y).toBeCloseTo(point.y);
  });
  it.each([{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -.3, y: .6 }, { x: 1, y: 1 }])('moves in the thumb direction $x,$y without a diagonal acceleration', direction => {
    const world = screenInputToWorld({ ...direction, boost: true });
    const screen = project(world);
    expect(Math.atan2(screen.y, screen.x)).toBeCloseTo(Math.atan2(direction.y, direction.x));
    expect(Math.hypot(world.x, world.y)).toBeCloseTo(Math.min(1, Math.hypot(direction.x, direction.y)));
    expect(world.boost).toBe(true);
  });
  it('sorts objects by their ground depth and keeps idle input stationary', () => {
    expect(depthAt({ x: 240, y: 180 })).toBeGreaterThan(depthAt({ x: 180, y: 150 }));
    expect(screenInputToWorld({ x: 0, y: 0, boost: false })).toEqual({ x: 0, y: 0, boost: false });
  });
});
