import { parkingLevel } from './levels';
import { replayParking } from './engine';
import type { ParkingRound, ParkingLevel } from './model';

export const createParkingRound = (level: number): ParkingRound => ({ schema: 'anacan-parking-round-v1', level, path: [], moves: 0, hints: 0, undos: 0 });
export function validParkingRound(value: unknown): value is ParkingRound {
  if (!value || typeof value !== 'object') return false;
  const round = value as ParkingRound;
  try {
    if (round.schema !== 'anacan-parking-round-v1' || ![round.moves, round.hints, round.undos].every(n => Number.isSafeInteger(n) && n >= 0)
      || round.hints > 3 || !Array.isArray(round.path) || round.path.length > 240 || round.moves < round.path.length
      || !round.path.every(move => move && Number.isInteger(move.car) && Number.isInteger(move.to))) return false;
    replayParking(parkingLevel(round.level), round.path); return true;
  } catch { return false; }
}
export function parkingResult(level: ParkingLevel, round: ParkingRound) {
  const stars: 1 | 2 | 3 = round.moves <= level.par && round.hints === 0 ? 3 : round.moves <= level.par + 5 && round.hints <= 1 ? 2 : 1;
  return { stars, score: Math.max(100, 600 + level.chapter * 100 + stars * 150 - Math.max(0, round.moves - level.par) * 20 - round.hints * 30) };
}
