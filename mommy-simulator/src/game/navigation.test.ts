import { describe, it, expect } from 'vitest';
import { canPlace, findPath, OBJECTS, CLINIC_OBJECTS, walkable } from './navigation';

describe('walkable, furnished home', () => {
  it('finds collision-free routes to every interactive object', () => {
    for (const object of OBJECTS) {
      const path = findPath({ x: -1.15, z: 1.3 }, object.approach);
      expect(path.length, object.id).toBeGreaterThan(0);
      for (const p of path) expect(walkable(p.x, p.z), `${object.id}: ${p.x},${p.z}`).toBe(true);
      const last = path[path.length - 1];
      expect(Math.hypot(last.x - object.approach.x, last.z - object.approach.z), object.id).toBeLessThan(.7);
    }
  });
  it('routes around the sofa instead of walking through it', () => {
    const path = findPath({ x: -4.8, z: 3.3 }, { x: -2.3, z: -.1 });
    expect(path.length).toBeGreaterThan(5);
    expect(path.every(p => walkable(p.x, p.z))).toBe(true);
    expect(findPath({ x: 0, z: 0 }, { x: 100, z: 100 })).toEqual([]);
  });
  it('finds walkable routes to the scanner, doctor, birth suite and changing station', () => {
    for (const object of CLINIC_OBJECTS) {
      const path = findPath({ x: -.7, z: 1 }, object.approach, [], 'clinic');
      expect(path.length, object.id).toBeGreaterThan(0);
      for (const p of path) expect(walkable(p.x, p.z, [], .16, 'clinic'), object.id).toBe(true);
      expect(Math.hypot(path.at(-1)!.x - object.approach.x, path.at(-1)!.z - object.approach.z), object.id).toBeLessThan(.7);
    }
  });
  it('keeps doorways and interaction approach points free of decor', () => {
    expect(canPlace(3.95, -.45, 'moon-lamp', [])).toBe(false);
    expect(canPlace(-3.7, 1.2, 'moon-lamp', [])).toBe(false);
    expect(canPlace(4.5, 3.25, 'moon-lamp', [])).toBe(true);
    expect(canPlace(4.5, 3.25, 'moon-lamp', [{ id: 'x', itemId: 'olive-plant', x: 4.4, z: 3.25, rotation: 0 }])).toBe(false);
  });
});
