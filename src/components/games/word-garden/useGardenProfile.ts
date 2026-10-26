import { useCallback, useRef, useState } from 'react';
import { readGardenProfile, writeGardenProfile } from './storage';
import type { GardenProfile, WordGardenMode } from './model';

// The owner component is keyed by language/revision/mode. Transactions write
// synchronously from a ref; React StrictMode cannot award a completed round twice.
export function useGardenProfile(language: string, revision: string, mode: WordGardenMode) {
  const [profile, setProfile] = useState(() => readGardenProfile(language, revision, mode));
  const current = useRef(profile), [storageReady, setStorageReady] = useState(true);
  const transact = useCallback((update: (value: GardenProfile) => GardenProfile) => {
    const next = update(current.current);
    if (next === current.current) return next;
    current.current = next;
    setStorageReady(writeGardenProfile(next));
    setProfile(next);
    return next;
  }, []);
  return { profile, current, transact, storageReady };
}
