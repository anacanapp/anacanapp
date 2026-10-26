import { PARKING_SIZE, type ParkingCar, type ParkingLevel, type ParkingMove, type ParkingState } from './model';

export const parkingCells = (car: ParkingCar, position: number) => Array.from({ length: car.length }, (_, index) => car.axis === 'h'
  ? car.lane * PARKING_SIZE + position + index : (position + index) * PARKING_SIZE + car.lane);
export const initialParkingState = (level: ParkingLevel): ParkingState => ({ positions: [...level.positions], open: !level.keyBay || level.positions[level.keyBay.car] === level.keyBay.position });
export const parkingSolved = (state: ParkingState) => state.positions[0] === PARKING_SIZE;
export function parkingOccupancy(level: ParkingLevel, state: ParkingState): number[] {
  const board = Array<number>(36).fill(-1);
  level.cars.forEach((car, index) => { if (index === 0 && state.positions[index] === 6) return;
    for (const cell of parkingCells(car, state.positions[index])) { if (cell < 0 || cell >= 36 || board[cell] !== -1) throw new Error('PARKING_OVERLAPPING_CARS'); board[cell] = index; }
  });
  return board;
}
export function moveParking(level: ParkingLevel, state: ParkingState, move: ParkingMove): ParkingState | null {
  const car = level.cars[move.car], from = state.positions[move.car];
  if (!car || !Number.isInteger(move.to) || move.to === from || parkingSolved(state)) return null;
  const exit = move.car === 0 && move.to === 6;
  if (move.to < 0 || move.to > 6 - car.length && !exit || exit && !state.open) return null;
  const board = parkingOccupancy(level, state), sign = move.to > from ? 1 : -1;
  for (let position = from + sign; sign > 0 ? position <= move.to : position >= move.to; position += sign) {
    for (const cell of parkingCells(car, position)) {
      if (exit && car.axis === 'h' && cell >= car.lane * 6 + 6) continue;
      if (board[cell] !== -1 && board[cell] !== move.car) return null;
    }
  }
  const positions = [...state.positions]; positions[move.car] = move.to;
  return { positions, open: state.open || !!level.keyBay && move.car === level.keyBay.car && move.to === level.keyBay.position };
}
export function parkingMoves(level: ParkingLevel, state: ParkingState): ParkingMove[] {
  if (parkingSolved(state)) return [];
  const moves: ParkingMove[] = [];
  const board = parkingOccupancy(level, state);
  for (const [index, car] of level.cars.entries()) {
    const from = state.positions[index];
    const cell = (position: number) => car.axis === 'h' ? car.lane * 6 + position : position * 6 + car.lane;
    for (let to = from - 1; to >= 0 && board[cell(to)] === -1; to--) moves.push({ car: index, to });
    for (let to = from + 1; to <= 6 - car.length && board[cell(to + car.length - 1)] === -1; to++) moves.push({ car: index, to });
  }
  if (state.open && Array.from({ length: 6 - state.positions[0] - level.cars[0].length }, (_, i) =>
    level.cars[0].lane * 6 + state.positions[0] + level.cars[0].length + i).every(cell => board[cell] === -1)) moves.unshift({ car: 0, to: 6 });
  return moves;
}
export const parkingStateKey = (state: ParkingState) => `${state.positions.join('')}:${Number(state.open)}`;
export function replayParking(level: ParkingLevel, path: readonly ParkingMove[]): ParkingState {
  let state = initialParkingState(level);
  for (const move of path) { const next = moveParking(level, state, move); if (!next) throw new Error('PARKING_SAVED_MOVE_INVALID'); state = next; }
  return state;
}
export function solveParking(level: ParkingLevel, start = initialParkingState(level), budget = 65000): { path: ParkingMove[] | null; visited: number; exhausted: boolean } {
  if (parkingSolved(start)) return { path: [], visited: 1, exhausted: false };
  const queue = [start], seen = new Map<string, { previous: string | null; move: ParkingMove | null }>([[parkingStateKey(start), { previous: null, move: null }]]);
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index], key = parkingStateKey(state);
    for (const move of parkingMoves(level, state)) {
      const positions = [...state.positions]; positions[move.car] = move.to;
      const next = { positions, open: state.open || !!level.keyBay && move.car === level.keyBay.car && move.to === level.keyBay.position }, nextKey = parkingStateKey(next);
      if (seen.has(nextKey)) continue;
      seen.set(nextKey, { previous: key, move });
      if (parkingSolved(next)) {
        const path: ParkingMove[] = []; let current = nextKey;
        while (seen.get(current)!.previous !== null) { const record = seen.get(current)!; path.push(record.move!); current = record.previous!; }
        return { path: path.reverse(), visited: seen.size, exhausted: false };
      }
      if (seen.size >= budget) return { path: null, visited: seen.size, exhausted: true };
      queue.push(next);
    }
  }
  return { path: null, visited: seen.size, exhausted: false };
}
