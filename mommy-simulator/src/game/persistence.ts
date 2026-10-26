import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createState, validateState } from './engine';
import type { GameState } from './types';
import { upgradeLegacyState } from './progression';
import { newHousehold } from './luzern';

const KEY = 'mommy-simulator-save-v1';
const BACKUP = `${KEY}-backup`;
const native = () => Capacitor.isNativePlatform();
let writeQueue = Promise.resolve();

async function get(key: string): Promise<string | null> {
  return native() ? (await Preferences.get({ key })).value : localStorage.getItem(key);
}
async function set(key: string, value: string): Promise<void> {
  if (native()) await Preferences.set({ key, value });
  else localStorage.setItem(key, value);
}

export function parseSave(value: string | null): GameState | null {
  if (!value || value.length > 12 * 1024 * 1024) return null;
  try {
    const raw = JSON.parse(value);
    if (raw?.schema === 2 && raw.pregnancy && typeof raw.pregnancy === 'object') {
      raw.pregnancy.supportPerson ??= 'partner'; raw.pregnancy.comfort ??= 'music';
    }
    const data = upgradeLegacyState(raw) as Record<string, unknown>;
    if (data?.schema === 2) { data.schema = 3; data.household = newHousehold(); }
    if (!validateState(data)) return null;
    return { ...data, activity: null, settings: { ...data.settings, speed: data.settings.speed || 1 } };
  } catch { return null; }
}

export async function loadSave(): Promise<{ state: GameState; recovered: boolean }> {
  try {
    const main = parseSave(await get(KEY));
    if (main) return { state: main, recovered: false };
    const backup = parseSave(await get(BACKUP));
    return { state: backup ?? createState(), recovered: Boolean(backup) };
  } catch { return { state: createState(), recovered: false }; }
}

export function saveGame(state: GameState): Promise<void> {
  // Serialize writes: an older native bridge promise cannot replace a newer save.
  const snapshot = { ...state, lastSaved: new Date().toISOString() };
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const previous = await get(KEY);
    if (parseSave(previous)) await set(BACKUP, previous!);
    await set(KEY, JSON.stringify(snapshot));
  });
  return writeQueue;
}

export async function resetSave(): Promise<void> {
  await writeQueue.catch(() => {});
  if (native()) { await Preferences.remove({ key: KEY }); await Preferences.remove({ key: BACKUP }); }
  else { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); }
}

export function downloadSave(state: GameState) {
  const blob = new Blob([JSON.stringify({ ...state, lastSaved: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `mommy-simulator-day-${state.day}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
