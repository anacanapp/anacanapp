import './setup';
import { casualStorageKey, readCasualProfile, recordCasualWin, writeCasualProfile, type CasualProfile } from '@/components/games/casual/storage';
import { createParkingRound, validParkingRound } from '@/components/games/parking/state';
import { parkingLevel } from '@/components/games/parking/levels';
import { PARKING_ID, PARKING_LEVELS, PARKING_REVISION } from '@/components/games/parking/model';
import { createFlightState, flightLevel, stepFlight, validFlightState } from '@/components/games/leaf-flight/engine';
import { LEAF_FLIGHT_ID, LEAF_FLIGHT_LEVELS, LEAF_FLIGHT_REVISION, type FlightState } from '@/components/games/leaf-flight/model';
import { CASUAL_MESSAGES, casualText } from '@/components/games/casual/messages';

// Same validator as LeafFlight.tsx `validSavedRound`.
const validSavedRound = (value: unknown): value is FlightState => { try { const level = (value as FlightState)?.level; return validFlightState(value, flightLevel(level)); } catch { return false; } };

export function all() {
  let parking = readCasualProfile(PARKING_ID, PARKING_REVISION, PARKING_LEVELS, validParkingRound);
  parking = recordCasualWin(parking, 1, 40, { stars: 3, score: 1000 });
  parking = recordCasualWin(parking, 2, 40, { stars: 1, score: 400 });
  parking = recordCasualWin(parking, 1, 40, { stars: 2, score: 1200 });
  parking = recordCasualWin(parking, 40, 40, { stars: 2, score: 900 });
  const level3 = parkingLevel(3);
  const parkingRound = { ...createParkingRound(3), path: level3.solution.slice(0, 1), moves: 2, undos: 1 };
  let flight = readCasualProfile(LEAF_FLIGHT_ID, LEAF_FLIGHT_REVISION, LEAF_FLIGHT_LEVELS, validSavedRound);
  flight = recordCasualWin(flight, 1, 30, { stars: 2, score: 1550 });
  let flightRound = createFlightState(2);
  for (let i = 0; i < 200; i++) flightRound = stepFlight(flightLevel(2), flightRound, i % 40 < 15);
  const cases: { name: string; game: 'parking' | 'flight'; raw: string | null }[] = [
    { name: 'parking-empty', game: 'parking', raw: null },
    { name: 'parking-progress-round', game: 'parking', raw: JSON.stringify({ ...parking, round: parkingRound }) },
    { name: 'parking-bad-round', game: 'parking', raw: JSON.stringify({ ...parking, round: { ...parkingRound, path: [{ car: 90, to: 6 }], moves: 1 } }) },
    { name: 'parking-future-round', game: 'parking', raw: JSON.stringify({ ...parking, unlocked: 2, levels: { 1: { stars: 3, score: 10 } }, round: createParkingRound(40) }) },
    { name: 'parking-bad-stars', game: 'parking', raw: JSON.stringify({ ...parking, levels: { 1: { stars: 0, score: 10 } } }) },
    { name: 'parking-level-41', game: 'parking', raw: JSON.stringify({ ...parking, levels: { 41: { stars: 1, score: 10 } } }) },
    { name: 'parking-wrong-game', game: 'parking', raw: JSON.stringify({ ...parking, game: 'leaf-flight' }) },
    { name: 'parking-huge', game: 'parking', raw: JSON.stringify({ ...parking, pad: 'x'.repeat(28001) }) },
    { name: 'flight-progress-round', game: 'flight', raw: JSON.stringify({ ...flight, round: flightRound }) },
    { name: 'flight-tampered-round', game: 'flight', raw: JSON.stringify({ ...flight, round: { ...flightRound, distance: 9999 } }) },
    { name: 'flight-unlocked-float', game: 'flight', raw: JSON.stringify({ ...flight, unlocked: 1.5 }) },
    { name: 'flight-garbage', game: 'flight', raw: 'null' },
  ];
  const storage = cases.map(item => {
    localStorage.clear();
    const [game, revision, count, validator] = item.game === 'parking' ? [PARKING_ID, PARKING_REVISION, PARKING_LEVELS, validParkingRound] as const
      : [LEAF_FLIGHT_ID, LEAF_FLIGHT_REVISION, LEAF_FLIGHT_LEVELS, validSavedRound] as const;
    if (item.raw !== null) localStorage.setItem(casualStorageKey(game, revision), item.raw);
    const profile = readCasualProfile(game, revision, count, validator as (round: unknown) => round is never) as CasualProfile<unknown>;
    writeCasualProfile(profile);
    return { ...item, key: casualStorageKey(game, revision), profile, rewritten: localStorage.getItem(casualStorageKey(game, revision)) };
  });
  const text = ['az', 'en', 'ar', 'xx', 'tr-TR'].flatMap(language => (['flightTitle', 'starCount', 'play', 'level', 'undo'] as const)
    .map(key => ({ language, key, value: casualText(language, key, { count: 5, level: 3 }) })));
  return { parking, flight, flightRound, storage, text, languages: Object.keys(CASUAL_MESSAGES) };
}
