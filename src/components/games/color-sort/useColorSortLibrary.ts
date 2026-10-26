import { useCallback, useEffect, useState } from 'react';
import { INITIAL_LEVEL_COUNT, LEVEL_PACK_SIZE, MAX_LEVEL_COUNT } from './difficulty';

const KEY = 'anacan_colorsort_level_count_v1';
export function readLevelCount(): number {
  try {
    const stored = Number(localStorage.getItem(KEY));
    return Number.isInteger(stored) ? Math.min(MAX_LEVEL_COUNT, Math.max(INITIAL_LEVEL_COUNT, Math.ceil(stored / LEVEL_PACK_SIZE) * LEVEL_PACK_SIZE)) : INITIAL_LEVEL_COUNT;
  } catch { return INITIAL_LEVEL_COUNT; }
}
export function useColorSortLibrary() {
  const [levelCount, setLevelCount] = useState(readLevelCount);
  useEffect(() => { try { localStorage.setItem(KEY, String(levelCount)); } catch { /* memory-only library */ } }, [levelCount]);
  const addLevels = useCallback(() => setLevelCount(count => Math.min(MAX_LEVEL_COUNT, count + LEVEL_PACK_SIZE)), []);
  return { levelCount, addLevels, canAddLevels: levelCount < MAX_LEVEL_COUNT };
}
