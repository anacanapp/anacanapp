import type { Activity, ActivityId, GameState, Room } from './types';

export const ROOM_ACTIVITIES: Record<Room, readonly ActivityId[]> = {
  living: ['talk', 'rest', 'read', 'clean', 'journal', 'help', 'appointment', 'name', 'kick', 'birthplan', 'contractions', 'call', 'routine'],
  kitchen: ['cook', 'water', 'sterilise'],
  nursery: ['feed', 'diaper', 'play', 'lullaby', 'soothe', 'assemble', 'read', 'pack', 'tidy'],
  bedroom: ['rest', 'laundry', 'routine', 'journal', 'read'],
  bathroom: ['bath', 'test', 'laundry'],
  garden: ['walk', 'plant', 'breathe', 'stretch', 'talk', 'help'],
  clinic: ['scan', 'checkup', 'skin', 'feed', 'diaper', 'birth', 'carseat', 'rest', 'help', 'talk', 'water', 'journal'],
  market: ['groceries'],
  cafe: ['coffee', 'talk', 'read', 'breathe', 'water', 'help'],
  lakeside: ['lakesideWalk', 'breathe', 'talk', 'help', 'read', 'water'],
};

export function roomForActivity(activity: Activity, state: GameState, current: Room): Room {
  if (state.location !== 'home') return state.location;
  return ROOM_ACTIVITIES[current].includes(activity.id) ? current : activity.room;
}

export const childStage = (state: GameState) => state.chapter >= 13 ? 'toddler' : state.chapter >= 12 ? 'sitting' : 'newborn';
export type ChildStage = ReturnType<typeof childStage>;

export function interiorFamily(state: GameState, room: Room) {
  const stage = childStage(state);
  const active = state.activity && ROOM_ACTIVITIES[room].includes(state.activity.id) ? state.activity.id : null;
  const ambient: ActivityId | null = ['living', 'bedroom', 'nursery'].includes(room) ? 'rest' : room === 'clinic' ? state.pregnancy.born ? 'skin' : 'rest' : room === 'cafe' ? 'read' : null;
  const motherActivity = active ?? (state.pregnancy.born && stage === 'newborn' && ['living', 'nursery'].includes(room) ? 'feed' : ambient);
  const holding = state.pregnancy.born && ['feed', 'skin', 'soothe', 'read', 'lullaby'].includes(motherActivity ?? '');
  return {
    stage, motherActivity, holding,
    fatherVisible: room !== 'bathroom',
    childVisible: state.pregnancy.born && !holding && ['living', 'nursery', 'garden', 'clinic', 'lakeside'].includes(room),
    cribReady: state.pregnancy.born || state.chapter >= 7 || state.missions.completed.includes('build-crib'),
  };
}

export function householdVisuals(state: GameState) {
  return {
    dust: Math.min(6, Math.round((100 - state.household.cleanliness) / 16)),
    dirty: Math.min(6, state.household.laundry.dirty),
    folded: Math.min(6, state.household.laundry.folded),
    pantry: Object.fromEntries(Object.entries(state.household.groceries).map(([id, count]) => [id, Math.min(6, count)])),
  };
}

export function interiorLight(state: GameState) {
  const sun = Math.max(0, Math.sin((state.time - 6 * 60) / (14 * 60) * Math.PI));
  const weather = state.household.weather === 'rain' ? .48 : state.household.weather === 'cloudy' ? .72 : 1;
  return { daylight: sun * weather, lamps: 1 - sun, warm: state.time < 10 * 60 || state.time >= 16 * 60 };
}

export function layoutInteriorPins(points: { id: ActivityId; x: number; y: number }[], width: number, height: number) {
  const placed: { id: ActivityId; x: number; y: number }[] = [], gap = 57;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  for (const point of points) {
    const x = clamp(point.x, 30, width - (width < 700 ? 86 : 60)), y = clamp(point.y, 35, height - 44);
    let chosen: { id: ActivityId; x: number; y: number } | undefined;
    for (const [dx, dy] of [[0, 0], [0, -gap], [-gap, 0], [gap, 0], [0, gap], [-gap, -gap], [gap, -gap], [-gap, gap], [gap, gap], [0, -gap * 2], [-gap * 2, 0], [0, gap * 2]]) {
      const candidate = { id: point.id, x: clamp(x + dx, 30, width - (width < 700 ? 86 : 60)), y: clamp(y + dy, 35, height - 44) };
      if (placed.every(previous => Math.hypot(previous.x - candidate.x, previous.y - candidate.y) >= gap - 1)) { chosen = candidate; break; }
    }
    if (chosen) placed.push(chosen);
  }
  return placed;
}
