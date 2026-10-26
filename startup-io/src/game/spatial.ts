import type { Pickup, Vec2 } from './model';

/** Static food grid: collection queries only inspect neighboring city blocks. */
export class PickupGrid {
  private buckets = new Map<string, Set<Pickup>>();
  private locations = new Map<string, string>();

  constructor(private cellSize: number) {}

  reset(cellSize = this.cellSize) { this.cellSize = cellSize; this.buckets.clear(); this.locations.clear(); }

  get size() { return this.locations.size; }

  private key(point: Vec2) { return `${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)}`; }

  insert(pickup: Pickup) {
    this.remove(pickup);
    const key = this.key(pickup);
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = new Set(); this.buckets.set(key, bucket); }
    bucket.add(pickup);
    this.locations.set(pickup.id, key);
  }

  remove(pickup: Pickup) {
    const key = this.locations.get(pickup.id);
    if (key === undefined) return;
    const bucket = this.buckets.get(key);
    bucket?.delete(pickup);
    if (!bucket?.size) this.buckets.delete(key);
    this.locations.delete(pickup.id);
  }

  nearby(point: Vec2, radius: number): Pickup[] {
    const result: Pickup[] = [];
    const minX = Math.floor((point.x - radius) / this.cellSize);
    const maxX = Math.floor((point.x + radius) / this.cellSize);
    const minY = Math.floor((point.y - radius) / this.cellSize);
    const maxY = Math.floor((point.y + radius) / this.cellSize);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const bucket = this.buckets.get(`${x},${y}`);
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }
}
