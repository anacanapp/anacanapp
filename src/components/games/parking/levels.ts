import catalog from './catalog.json';
import { PARKING_LEVELS, PARKING_REVISION, type ParkingLevel } from './model';

export function parkingLevel(level: number): ParkingLevel {
  if (!Number.isSafeInteger(level) || level < 1 || level > PARKING_LEVELS || catalog.revision !== PARKING_REVISION) throw new Error('PARKING_LEVEL_INVALID');
  return catalog.levels[level - 1] as ParkingLevel;
}
