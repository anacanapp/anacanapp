import { describe, expect, it } from 'vitest';
import { EndlessWorld } from './world';
import { radiusForMass } from './model';

describe('unbounded streamed city', () => {
  it('loads new areas in all four directions while bounding active memory', () => {
    const world = new EndlessWorld(42);
    const seen = new Set<string>();
    for (let index = 0; index < 200; index++) {
      world.update({ x: (index - 100) * 10000, y: (index % 3 - 1) * 23000 }, 10, 1000, 2400, index);
      for (const key of world.chunks.keys()) seen.add(key);
      expect(world.activeCount).toBeLessThanOrEqual(81); expect(world.pickups.length).toBeLessThan(3000); expect(world.states.size).toBeLessThanOrEqual(192);
      expect(world.grid.size).toBe(world.pickups.filter(pickup => pickup.alive).length);
    }
    expect(seen.size).toBeGreaterThan(4000);
  });
  it('revisits the same generated blocks with identical layout', () => {
    const world = new EndlessWorld(73); world.update({ x: 0, y: 0 }, 10, 1000, 1600, 0);
    const first = world.pickups.filter(pickup => pickup.chunk === '0:0:0').map(pickup => [pickup.id, pickup.x, pickup.y, pickup.spec.kind]);
    world.update({ x: 12000, y: -8000 }, 10, 1000, 1600, 5);
    world.update({ x: 0, y: 0 }, 10, 1000, 1600, 10);
    expect(world.pickups.filter(pickup => pickup.chunk === '0:0:0').map(pickup => [pickup.id, pickup.x, pickup.y, pickup.spec.kind])).toEqual(first);
  });
  it('keeps consumption durable across unloading and restores it from a checkpoint', () => {
    const world = new EndlessWorld(42); world.update({ x: 0, y: 0 }, 10, 1000, 1600, 0);
    const pickup = world.pickups.find(pickup => pickup.chunk === '0:0:0')!; world.consume(pickup, 5);
    world.update({ x: 10000, y: 10000 }, 10, 1000, 1600, 6);
    world.update({ x: 0, y: 0 }, 10, 1000, 1600, 7);
    expect(world.pickups.find(food => food.id === pickup.id)?.alive).toBe(false);
    const restored = new EndlessWorld(42, world.save(7)); restored.update({ x: 0, y: 0 }, 10, 1000, 1600, 7);
    expect(restored.pickups.find(food => food.id === pickup.id)?.alive).toBe(false);
    restored.update({ x: 0, y: 0 }, 10, 1000, 1600, 29);
    expect(restored.pickups.find(food => food.id === pickup.id)?.alive).toBe(true);
  });
  it('rebases the same city without seams or changing resource IDs', () => {
    const world = new EndlessWorld(7); const point = { x: 16000, y: -9000 };
    world.update(point, 10, 1500, 2200, 0);
    const key = [...world.chunks.keys()][0]; const before = world.chunks.get(key)!;
    const food = { ...before.pickups[0] }; const shift = world.rebase(point.x, point.y);
    world.update({ x: point.x - shift.x, y: point.y - shift.y }, 10, 1500, 2200, 0);
    const after = world.pickups.find(pickup => pickup.id === food.id)!;
    expect(after.x + shift.x).toBe(food.x); expect(after.y + shift.y).toBe(food.y); expect(world.chunks.has(key)).toBe(true);
  });
  it('uses BigInt origins beyond safe-number travel precision', () => {
    const world = new EndlessWorld(77, { originX: '900719925474099200000', originY: '-900719925474099200001', states: [] });
    world.update({ x: 19, y: -27 }, 10, 1000, 2000, 0);
    expect(world.activeCount).toBeGreaterThan(0);
    expect(world.pickups.every(pickup => Number.isFinite(pickup.x + pickup.y))).toBe(true);
    expect(world.save(0).originX).toBe('900719925474099200000');
  });
  it.each([10, 200, 10000, 1e6, 1e12, 1e24])('streams appropriately scaled content at company mass %s', mass => {
    const world = new EndlessWorld(4); const r = radiusForMass(mass);
    world.update({ x: 0, y: 0 }, mass, r * 24, r * 42, 0);
    expect(world.blockSize / r).toBeGreaterThan(3); expect(world.pickups.length).toBeLessThan(3000);
    expect(world.pickups.some(pickup => pickup.spec.requiredMass <= mass && pickup.spec.value >= Math.max(4, mass * .02))).toBe(true);
    const positions = new Set(world.pickups.map(pickup => `${pickup.x},${pickup.y}`)); expect(positions.size).toBe(world.pickups.length);
    expect(new Set(world.blocks.map(block => block.district)).size).toBe(5);
  });
});
