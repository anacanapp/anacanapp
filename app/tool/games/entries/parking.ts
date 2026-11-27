import { mulberry32 } from './setup';
import { initialParkingState, moveParking, parkingCells, parkingMoves, parkingOccupancy, parkingStateKey, replayParking, solveParking } from '@/components/games/parking/engine';
import { parkingLevel } from '@/components/games/parking/levels';
import { createParkingRound, parkingResult, validParkingRound } from '@/components/games/parking/state';

export function all() {
  const levels = Array.from({ length: 40 }, (_, index) => {
    const level = parkingLevel(index + 1);
    const half = replayParking(level, level.solution.slice(0, Math.floor(level.solution.length / 2)));
    const random = mulberry32(1000 + index);
    let state = initialParkingState(level);
    const walk = Array.from({ length: 25 }, () => {
      const moves = parkingMoves(level, state);
      const legal = moves.filter(move => !(move.car === 0 && move.to === 6));
      const move = legal[Math.floor(random() * legal.length)];
      const next = move ? moveParking(level, state, move) : null;
      if (next) state = next;
      return { moves, move: move ?? null, state, key: parkingStateKey(state) };
    });
    const bogus = [{ car: 0, to: 6 }, { car: 99, to: 1 }, { car: 1, to: 1.5 }, { car: 1, to: -1 }, { car: 2, to: 5 }].map(move => ({ move, value: moveParking(level, initialParkingState(level), move) }));
    return { n: index + 1, solve: solveParking(level), half, solveHalf: solveParking(level, half), solveWalk: solveParking(level, state), tight: solveParking(level, undefined, 40),
      occupancy: parkingOccupancy(level, initialParkingState(level)), walk, bogus };
  });
  const cells = [[{ id: 'Q', axis: 'h', lane: 2, length: 2, color: 0 }, 3], [{ id: 'A', axis: 'v', lane: 4, length: 3, color: 1 }, 2]].map(([car, position]) => ({ car, position, value: parkingCells(car as never, position as number) }));
  const results = [[1, 2, 0], [1, 3, 0], [12, 12, 1], [30, 40, 2], [40, 15, 3]].map(([n, moves, hints]) => ({ n, moves, hints, value: parkingResult(parkingLevel(n), { ...createParkingRound(n), moves, hints }) }));
  const level5 = parkingLevel(5);
  const rounds = [createParkingRound(5), { ...createParkingRound(5), path: level5.solution.slice(0, 2), moves: 4 }, { ...createParkingRound(5), path: [{ car: 90, to: 6 }], moves: 1 },
    { ...createParkingRound(5), hints: 4 }, { ...createParkingRound(5), moves: 0, path: level5.solution.slice(0, 1) }, { ...createParkingRound(41) }, { ...createParkingRound(5), schema: 'x' },
    { ...createParkingRound(5), path: [{ car: 1.5, to: 2 }], moves: 3 }, null, 7].map(round => ({ round, valid: validParkingRound(round) }));
  return { levels, cells, results, rounds };
}
