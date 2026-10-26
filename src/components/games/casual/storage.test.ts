import { beforeEach, describe, expect, it } from 'vitest';
import { casualStorageKey, readCasualProfile, recordCasualWin, writeCasualProfile } from './storage';
import { createParkingRound, validParkingRound } from '../parking/state';
import { PARKING_ID, PARKING_LEVELS, PARKING_REVISION } from '../parking/model';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { CASUAL_MESSAGES, casualText, type CasualMessageKey } from './messages';

beforeEach(() => localStorage.clear());
describe('offline casual game profiles', () => {
  it('preserves aggregate results when a malformed round cannot be replayed', () => {
    let profile = readCasualProfile(PARKING_ID, PARKING_REVISION, PARKING_LEVELS, validParkingRound);
    profile = recordCasualWin(profile, 1, 40, { stars: 3, score: 1000 }); profile.round = createParkingRound(2);
    expect(writeCasualProfile(profile)).toBe(true); expect(readCasualProfile(PARKING_ID, PARKING_REVISION, 40, validParkingRound)).toEqual(profile);
    localStorage.setItem(casualStorageKey(PARKING_ID, PARKING_REVISION), JSON.stringify({ ...profile, round: { ...profile.round, path: [{ car: 90, to: 6 }], moves: 1 } }));
    const recovered = readCasualProfile(PARKING_ID, PARKING_REVISION, 40, validParkingRound);
    expect(recovered.round).toBeNull(); expect(recovered.levels).toEqual(profile.levels);
  });
  it('blocks future saved levels and keeps game/revision namespaces independent', () => {
    const profile = readCasualProfile(PARKING_ID, PARKING_REVISION, 40, validParkingRound);
    writeCasualProfile({ ...profile, round: createParkingRound(40) });
    expect(readCasualProfile(PARKING_ID, PARKING_REVISION, 40, validParkingRound).round).toBeNull();
    expect(casualStorageKey(PARKING_ID, PARKING_REVISION)).not.toBe(casualStorageKey('leaf-flight', 'flight-202610-v1'));
  });
  it('bundles matching complete copy for both games in all 21 UI languages', () => {
    expect(Object.keys(CASUAL_MESSAGES).sort()).toEqual([...APP_LANGUAGE_CODES].sort());
    for (const language of APP_LANGUAGE_CODES) for (const key of Object.keys(CASUAL_MESSAGES.az) as CasualMessageKey[]) {
      const copy = CASUAL_MESSAGES[language][key]; expect(copy.trim()).not.toBe('');
      expect(copy.match(/\{\w+\}/g) || []).toEqual(CASUAL_MESSAGES.az[key].match(/\{\w+\}/g) || []);
      expect(casualText(language, key, { count: 5 })).not.toMatch(/\{\w+\}/);
    }
  });
});
