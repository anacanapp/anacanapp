import { FURNITURE } from './content';
import type { Placement, Room } from './types';
import type { Location } from './types';

export interface Point { x: number; z: number }
export interface Obstacle { x: number; z: number; w: number; d: number }
export interface WorldObject { id: string; room: Room; x: number; z: number; approach: Point; label: string; icon: string }

export const OBJECTS: WorldObject[] = [
  { id: 'sofa', room: 'living', x: -3.7, z: .25, approach: { x: -3.7, z: 1.2 }, label: 'rest', icon: 'sofa' },
  { id: 'desk', room: 'living', x: -4.1, z: 2.6, approach: { x: -3.3, z: 2.3 }, label: 'journal', icon: 'book' },
  { id: 'counter', room: 'kitchen', x: -3.3, z: -3.4, approach: { x: -2.7, z: -2.35 }, label: 'cook', icon: 'cooking' },
  { id: 'dining', room: 'kitchen', x: -2.0, z: -1.0, approach: { x: -1.0, z: -1.2 }, label: 'cook', icon: 'utensils' },
  { id: 'crib', room: 'nursery', x: 3.9, z: -.45, approach: { x: 2.75, z: -.3 }, label: 'lullaby', icon: 'baby' },
  { id: 'chair', room: 'nursery', x: 1.2, z: -.8, approach: { x: 1.4, z: .3 }, label: 'feed', icon: 'bottle' },
  { id: 'dresser', room: 'nursery', x: 4.0, z: 2.3, approach: { x: 3.25, z: 1.7 }, label: 'pack', icon: 'bag' },
  { id: 'playmat', room: 'nursery', x: 1.4, z: 1.6, approach: { x: 1.35, z: 2.6 }, label: 'play', icon: 'blocks' },
  { id: 'bath', room: 'bathroom', x: 3.55, z: -3.45, approach: { x: 2.75, z: -2.7 }, label: 'bath', icon: 'bath' },
  { id: 'bench', room: 'garden', x: -3.8, z: 5.4, approach: { x: -2.6, z: 5.1 }, label: 'walk', icon: 'leaf' },
  { id: 'planter', room: 'garden', x: 3.9, z: 5.0, approach: { x: 2.8, z: 4.7 }, label: 'plant', icon: 'flower' },
  { id: 'partner', room: 'living', x: -.8, z: 2.4, approach: { x: -1.4, z: 2.45 }, label: 'talk', icon: 'heart' },
];

export const CLINIC_OBJECTS: WorldObject[] = [
  { id: 'scanner', room: 'clinic', x: -2.8, z: -2.5, approach: { x: -1.1, z: -2.5 }, label: 'scan', icon: 'scan' },
  { id: 'doctor', room: 'clinic', x: -3.2, z: 1.5, approach: { x: -2.5, z: 1.5 }, label: 'checkup', icon: 'doctor' },
  { id: 'birthbed', room: 'clinic', x: 3, z: .95, approach: { x: 1.6, z: 1.0 }, label: 'birth', icon: 'heartpulse' },
  { id: 'clinicdresser', room: 'clinic', x: 4.5, z: 3.8, approach: { x: 3.5, z: 3.4 }, label: 'diaper', icon: 'baby' },
  { id: 'reception', room: 'clinic', x: -1.74, z: 3.8, approach: { x: -.6, z: 3.3 }, label: 'carseat', icon: 'car' },
];
export const TOWN_OBJECTS: Record<string, WorldObject[]> = {
  market: [{ id: 'shelves', room: 'market', x: 0, z: 0, approach: { x: 0, z: 1 }, label: 'groceries', icon: 'bag' }],
  cafe: [{ id: 'coffee', room: 'cafe', x: 0, z: 0, approach: { x: 0, z: 1 }, label: 'coffee', icon: 'coffee' }],
  lakeside: [{ id: 'promenade', room: 'lakeside', x: 0, z: 0, approach: { x: 0, z: 1 }, label: 'lakesideWalk', icon: 'waves' }],
};
export const worldObjects = (location: Location) => location === 'clinic' ? CLINIC_OBJECTS : TOWN_OBJECTS[location] ?? OBJECTS;

const CLINIC_OBSTACLES: Obstacle[] = [
  { x: -2.1, z: -2.48, w: 1.05, d: 2.1 }, { x: -3.7, z: -2.5, w: .83, d: .7 },
  { x: -3.72, z: 1.46, w: 1.82, d: .88 }, { x: 3, z: .95, w: 1.95, d: 2.6 },
  { x: 4.5, z: 3.8, w: 1.36, d: .76 }, { x: -1.74, z: 3.8, w: 1.68, d: .65 },
  { x: 1.3, z: 3.3, w: .78, d: 1.14 }, { x: .2, z: -2.6, w: .18, d: 3.8 },
];

export const OBSTACLES: Obstacle[] = [
  { x: -3.65, z: .35, w: 2.0, d: 1.25 },
  { x: -4.15, z: 2.55, w: 1.4, d: .8 },
  { x: -2.73, z: 1.95, w: 1.05, d: .65 },
  { x: -4.77, z: 1.41, w: .60, d: .60 },
  { x: -3.2, z: -3.55, w: 3.5, d: .75 },
  { x: -4.5, z: -2.1, w: .7, d: 1.2 },
  { x: -2, z: -1, w: 1.4, d: 1.0 },
  { x: 3.95, z: -.45, w: 1.3, d: 1.9 },
  { x: 1.2, z: -.8, w: 1, d: 1.1 },
  { x: 4, z: 2.3, w: 1.25, d: .95 },
  { x: 3.55, z: -3.45, w: 1.85, d: .85 },
  { x: 1.6, z: -3.7, w: 1, d: .8 },
  { x: -3.9, z: 5.4, w: 2.1, d: .75 },
  { x: 4.0, z: 5.15, w: 1.6, d: .65 },
  { x: -1.37, z: 4.2, w: .7, d: 1.0 },
  // Cutaway partitions retain wide, walkable doorways.
  { x: .05, z: -2.25, w: .18, d: 3.5 },
  { x: .05, z: 2.6, w: .18, d: 1.35 },
  { x: 3.65, z: -2.15, w: 2.45, d: .16 },
];

export const PLACEMENT_SPOTS: Point[] = [
  { x: 4.5, z: 3.25 }, { x: 2.6, z: 3.0 }, { x: .8, z: 2.8 }, { x: -2.0, z: 3.1 },
  { x: -.8, z: -2.6 }, { x: -2.5, z: 4.1 }, { x: 1.5, z: 4.6 }, { x: 3.2, z: 5.9 },
];

const CELL = .32, MIN_X = -4.85, MAX_X = 4.85, MIN_Z = -4, MAX_Z = 6;
const NX = Math.round((MAX_X - MIN_X) / CELL), NZ = Math.round((MAX_Z - MIN_Z) / CELL);

export function roomAt(x: number, z: number): Room {
  if (z > 3.4) return 'garden';
  if (x > .15 && z < -2.1) return 'bathroom';
  if (x > .15) return 'nursery';
  return z < -.6 ? 'kitchen' : 'living';
}

export function withinWorld(x: number, z: number): boolean {
  return x >= MIN_X && x <= MAX_X && z >= MIN_Z && z <= MAX_Z;
}

function contains(o: Obstacle, x: number, z: number, padding: number) {
  return Math.abs(o.x - x) < o.w / 2 + padding && Math.abs(o.z - z) < o.d / 2 + padding;
}

export function walkable(x: number, z: number, placements: Placement[] = [], padding = .16, location: Location = 'home'): boolean {
  if (!withinWorld(x, z)) return false;
  if ((location === 'clinic' ? CLINIC_OBSTACLES : OBSTACLES).some(o => contains(o, x, z, padding))) return false;
  if (location === 'clinic') return true;
  return !placements.some(p => {
    const item = FURNITURE.find(i => i.id === p.itemId);
    return item && item.kind !== 'rug' && Math.hypot(p.x - x, p.z - z) < .38 + padding;
  });
}

export function canPlace(x: number, z: number, itemId: string, placements: Placement[]): boolean {
  const item = FURNITURE.find(i => i.id === itemId);
  if (!item || !withinWorld(x, z) || x < -4.6 || x > 4.6 || z < -3.85 || z > 5.9) return false;
  const margin = item.kind === 'rug' ? .45 : .38;
  if (OBSTACLES.some(o => contains(o, x, z, margin))) return false;
  if (OBJECTS.some(o => Math.hypot(o.approach.x - x, o.approach.z - z) < .5 && item.kind !== 'rug')) return false;
  return !placements.some(p => Math.hypot(p.x - x, p.z - z) < (item.kind === 'rug' ? .8 : .7));
}

const toCell = (p: Point) => ({ x: Math.max(0, Math.min(NX, Math.round((p.x - MIN_X) / CELL))), z: Math.max(0, Math.min(NZ, Math.round((p.z - MIN_Z) / CELL))) });
const fromCell = (x: number, z: number): Point => ({ x: MIN_X + x * CELL, z: MIN_Z + z * CELL });
const key = (x: number, z: number) => z * (NX + 1) + x;

export function findPath(start: Point, goal: Point, placements: Placement[] = [], location: Location = 'home'): Point[] {
  if (!withinWorld(goal.x, goal.z)) return [];
  const s = toCell(start), g = toCell(goal), endKey = key(g.x, g.z), startKey = key(s.x, s.z);
  const open = [{ ...s, cost: 0, f: Math.hypot(s.x - g.x, s.z - g.z) }];
  const costs = new Map<number, number>([[startKey, 0]]), previous = new Map<number, number>();
  const closed = new Set<number>();
  let nearest = startKey, nearestDistance = Infinity;
  for (let loops = 0; open.length && loops < 3000; loops++) {
    open.sort((a, b) => a.f - b.f);
    const c = open.shift()!, ck = key(c.x, c.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    const distance = Math.hypot(c.x - g.x, c.z - g.z);
    if (distance < nearestDistance) { nearestDistance = distance; nearest = ck; }
    if (ck === endKey) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = c.x + dx, nz = c.z + dz, nk = key(nx, nz), p = fromCell(nx, nz);
      if (nx < 0 || nz < 0 || nx > NX || nz > NZ || closed.has(nk) || !walkable(p.x, p.z, placements, .16, location)) continue;
      if (dx && dz) {
        const a = fromCell(c.x + dx, c.z), b = fromCell(c.x, c.z + dz);
        if (!walkable(a.x, a.z, placements, .16, location) || !walkable(b.x, b.z, placements, .16, location)) continue;
      }
      const nc = c.cost + (dx && dz ? Math.SQRT2 : 1);
      if (nc >= (costs.get(nk) ?? Infinity)) continue;
      costs.set(nk, nc); previous.set(nk, ck);
      open.push({ x: nx, z: nz, cost: nc, f: nc + Math.hypot(nx - g.x, nz - g.z) });
    }
  }
  if (nearestDistance > 2.1) return [];
  const path: Point[] = [];
  let current: number | undefined = nearest;
  while (current !== undefined && current !== startKey) {
    path.unshift(fromCell(current % (NX + 1), Math.floor(current / (NX + 1))));
    current = previous.get(current);
  }
  if (nearest === endKey && walkable(goal.x, goal.z, placements, .16, location)) path.push(goal);
  return path;
}
