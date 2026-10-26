import { describe, expect, it } from 'vitest';
import { initialParkingState, moveParking, parkingMoves, parkingOccupancy, parkingSolved, replayParking, solveParking } from './engine';
import { parkingLevel } from './levels';
import { PARKING_REVISION, type ParkingLevel } from './model';
const fixture: ParkingLevel = { schema: 'anacan-parking-level-v1', revision: PARKING_REVISION, level: 1, chapter: 1,
  cars: [{ id: 'Q', axis: 'h', lane: 2, length: 2, color: 0 }, { id: 'A', axis: 'v', lane: 3, length: 3, color: 1 }], positions: [0, 0], keyBay: null, par: 2, solution: [{ car: 1, to: 3 }, { car: 0, to: 6 }] };
describe('clear-the-way sliding cars', () => {
  it('rejects passing through blockers and permits only legal axis positions', () => {
    const initial = initialParkingState(fixture);
    expect(moveParking(fixture, initial, { car: 0, to: 4 })).toBeNull();
    expect(moveParking(fixture, initial, { car: 1, to: 4 })).toBeNull();
    const next = moveParking(fixture, initial, { car: 1, to: 3 })!;
    expect(parkingSolved(moveParking(fixture, next, { car: 0, to: 6 })!)).toBe(true);
  });
  it('keeps a locked exit closed until the marked car finishes in its key bay', () => {
    const level = { ...fixture, keyBay: { car: 1, position: 3 } }, initial = initialParkingState(level);
    expect(initial.open).toBe(false); const open = moveParking(level, initial, { car: 1, to: 3 })!;
    expect(open.open).toBe(true); expect(moveParking(level, open, { car: 1, to: 2 })!.open).toBe(true);
    expect(moveParking(level, { ...open, open: false }, { car: 0, to: 6 })).toBeNull();
  });
  it('matches optimized legal move enumeration to collision checks for every catalog state', () => {
    for (let n = 1; n <= 40; n++) {
      const level = parkingLevel(n); let state = initialParkingState(level);
      for (const move of level.solution) {
        expect(parkingMoves(level, state)).toContainEqual(move);
        for (const candidate of parkingMoves(level, state)) expect(moveParking(level, state, candidate)).not.toBeNull();
        state = moveParking(level, state, move)!; expect(() => parkingOccupancy(level, state)).not.toThrow();
      }
      expect(parkingSolved(state)).toBe(true);
    }
  });
  it('verifies every stored solution is shortest, including locked-exit levels', () => {
    for (let n = 1; n <= 40; n++) {
      const level = parkingLevel(n), solved = solveParking(level);
      expect(solved.path?.length, `level ${n}`).toBe(level.par); expect(solved.exhausted).toBe(false);
      expect(parkingSolved(replayParking(level, level.solution))).toBe(true);
    }
  }, 30000);
});
