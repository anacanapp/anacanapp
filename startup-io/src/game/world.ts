import { fundingSpec, resourceSpec } from './assets';
import { hashString, radiusForMass, seededRandom } from './model';
import type { CityBlock, ChunkState, DistrictKind, Pickup, Vec2, WorldSave } from './model';
import { PickupGrid } from './spatial';

export const BASE_BLOCK = 240;
const CHUNK_BLOCKS = 3;
const DISTRICTS: readonly DistrictKind[] = ['park', 'studios', 'tech', 'downtown', 'waterfront'];
export interface CityChunk { key: string; x: number; y: number; blocks: CityBlock[]; pickups: Pickup[]; state: ChunkState }
const floorDivide = (a: bigint, b: bigint) => a / b - (a < 0n && a % b !== 0n ? 1n : 0n);

/** Unbounded coordinates + a bounded local working set. BigInt origins avoid travel precision loss. */
export class EndlessWorld {
  readonly chunks = new Map<string, CityChunk>();
  readonly grid = new PickupGrid(BASE_BLOCK);
  readonly states = new Map<string, ChunkState>();
  originX = 0n;
  originY = 0n;
  lod = 0;
  revision = 0;
  private food: Pickup[] = [];
  private lots: CityBlock[] = [];
  private lastWindow = '';
  private lastRefresh = -1;

  constructor(readonly seed: number, save?: WorldSave) {
    if (save) {
      this.originX = BigInt(save.originX); this.originY = BigInt(save.originY);
      for (const state of save.states) this.states.set(state.key, { ...state, consumed: state.consumed.map(entry => [...entry]) });
    }
  }
  get blockSize() { return BASE_BLOCK * 2 ** this.lod; }
  get chunkSize() { return this.blockSize * CHUNK_BLOCKS; }
  get pickups() { return this.food; }
  get blocks() { return this.lots; }
  get activeCount() { return this.chunks.size; }

  private origin() {
    const units = BigInt(CHUNK_BLOCKS) * (1n << BigInt(this.lod));
    const qx = floorDivide(this.originX, units); const qy = floorDivide(this.originY, units);
    return { qx, qy, rx: Number(this.originX - qx * units) * BASE_BLOCK, ry: Number(this.originY - qy * units) * BASE_BLOCK };
  }

  update(player: Vec2, mass: number, width: number, height: number, elapsed: number) {
    const lod = Math.max(0, Math.floor(Math.log2(Math.max(1, radiusForMass(mass) / 31))));
    if (lod !== this.lod) { this.lod = lod; this.chunks.clear(); this.grid.reset(this.blockSize); this.lastWindow = ''; }
    const { qx, qy, rx, ry } = this.origin();
    const size = this.chunkSize;
    const cx = Math.floor((player.x + rx) / size); const cy = Math.floor((player.y + ry) / size);
    const halfX = Math.min(3, Math.max(1, Math.ceil(width / 2 / size))) + 1;
    const halfY = Math.min(3, Math.max(1, Math.ceil(height / 2 / size))) + 1;
    const windowKey = `${this.lod}:${qx + BigInt(cx)}:${qy + BigInt(cy)}:${halfX}:${halfY}`;
    if (windowKey !== this.lastWindow) {
      this.lastWindow = windowKey;
      const wanted = new Set<string>();
      for (let dx = -halfX; dx <= halfX; dx++) {
        for (let dy = -halfY; dy <= halfY; dy++) {
          const gx = qx + BigInt(cx + dx); const gy = qy + BigInt(cy + dy);
          const key = `${this.lod}:${gx}:${gy}`; wanted.add(key);
          if (!this.chunks.has(key)) {
            const chunk = this.generate(key, gx, gy, (cx + dx) * size - rx, (cy + dy) * size - ry, mass, elapsed);
            this.chunks.set(key, chunk);
            for (const pickup of chunk.pickups) if (pickup.alive) this.grid.insert(pickup);
          }
        }
      }
      for (const [key, chunk] of this.chunks) {
        if (wanted.has(key)) continue;
        for (const pickup of chunk.pickups) this.grid.remove(pickup);
        this.chunks.delete(key);
      }
      this.food = [...this.chunks.values()].flatMap(chunk => chunk.pickups);
      this.lots = [...this.chunks.values()].flatMap(chunk => chunk.blocks);
      this.revision++;
      this.pruneStates(elapsed);
    }
    if (elapsed - this.lastRefresh >= .4) {
      this.lastRefresh = elapsed;
      for (const pickup of this.food) {
        if (!pickup.alive && elapsed >= pickup.respawnAt) { pickup.alive = true; this.grid.insert(pickup); }
      }
    }
  }

  private generate(key: string, gx: bigint, gy: bigint, x: number, y: number, mass: number, elapsed: number): CityChunk {
    const random = seededRandom(hashString(key, this.seed));
    let state = this.states.get(key);
    if (!state) { state = { key, referenceMass: mass, consumed: [] }; this.states.set(key, state); }
    // Touch state in the LRU; only recent consumed blocks need durable memory.
    this.states.delete(key); this.states.set(key, state);
    const consumed = new Map(state.consumed);
    const chunk: CityChunk = { key, x, y, blocks: [], pickups: [], state };
    let slot = 0;
    for (let bx = 0; bx < CHUNK_BLOCKS; bx++) {
      for (let by = 0; by < CHUNK_BLOCKS; by++) {
        const blockKey = `${this.lod}:${gx * 3n + BigInt(bx)}:${gy * 3n + BigInt(by)}`;
        const variation = hashString(blockKey, this.seed);
        const district = DISTRICTS[Math.floor((variation % 100) / 20)];
        const block: CityBlock = { key: blockKey, x: x + bx * this.blockSize, y: y + by * this.blockSize, size: this.blockSize, district, variation };
        chunk.blocks.push(block);
        const funding = fundingSpec(state.referenceMass, block.size);
        const positions = [[.32, .1], [.68, .1], [.1, .32], [.1, .68]];
        for (const [px, py] of positions) {
          const point = { x: block.x + block.size * px, y: block.y + block.size * py };
          const respawnAt = consumed.get(slot) ?? 0;
          chunk.pickups.push({ id: `${key}/${slot}`, chunk: key, slot: slot++, ...point, spec: funding, alive: elapsed >= respawnAt, respawnAt, phase: random() * Math.PI * 2 });
        }
        if (district !== 'park' && district !== 'waterfront' && random() < .67) {
          const spec = resourceSpec(state.referenceMass, block.size, random(), district);
          const respawnAt = consumed.get(slot) ?? 0;
          chunk.pickups.push({ id: `${key}/${slot}`, chunk: key, slot: slot++, x: block.x + block.size * .52, y: block.y + block.size * .53, spec, alive: elapsed >= respawnAt, respawnAt, phase: random() * Math.PI * 2 });
        }
      }
    }
    return chunk;
  }

  consume(pickup: Pickup, elapsed: number) {
    if (!pickup.alive) return;
    pickup.alive = false;
    pickup.respawnAt = elapsed + (pickup.spec.kind === 'investment' ? 22 : 38);
    this.grid.remove(pickup);
    const state = this.states.get(pickup.chunk);
    if (state) {
      const index = state.consumed.findIndex(entry => entry[0] === pickup.slot);
      if (index >= 0) state.consumed[index] = [pickup.slot, pickup.respawnAt];
      else state.consumed.push([pickup.slot, pickup.respawnAt]);
    }
  }

  private pruneStates(elapsed: number) {
    for (const [key, state] of this.states) {
      state.consumed = state.consumed.filter(entry => entry[1] > elapsed);
      if (!this.chunks.has(key) && !state.consumed.length) this.states.delete(key);
    }
    while (this.states.size > 192) {
      const key = [...this.states.keys()].find(value => !this.chunks.has(value));
      if (!key) break;
      this.states.delete(key);
    }
  }

  rebase(x: number, y: number) {
    const dx = Math.trunc(x / this.chunkSize); const dy = Math.trunc(y / this.chunkSize);
    const shift = { x: dx * this.chunkSize, y: dy * this.chunkSize };
    const units = BigInt(CHUNK_BLOCKS) * (1n << BigInt(this.lod));
    this.originX += BigInt(dx) * units; this.originY += BigInt(dy) * units;
    for (const chunk of this.chunks.values()) { chunk.x -= shift.x; chunk.y -= shift.y; }
    for (const block of this.lots) { block.x -= shift.x; block.y -= shift.y; }
    this.grid.reset(this.blockSize);
    for (const pickup of this.food) { pickup.x -= shift.x; pickup.y -= shift.y; if (pickup.alive) this.grid.insert(pickup); }
    this.lastWindow = ''; this.revision++;
    return shift;
  }

  districtAt(point: Vec2): DistrictKind {
    const block = this.lots.find(lot => point.x >= lot.x && point.x < lot.x + lot.size && point.y >= lot.y && point.y < lot.y + lot.size);
    return block?.district ?? 'studios';
  }

  save(elapsed: number): WorldSave {
    this.pruneStates(elapsed);
    return { originX: this.originX.toString(), originY: this.originY.toString(), states: [...this.states.values()].map(state => ({ ...state, consumed: state.consumed.map(entry => [...entry]) })) };
  }
}
