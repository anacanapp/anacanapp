// Lock-screen live timer for the pregnancy tools (contraction timer, kick counter).
//
// Reuses the existing "LiveActivity" native plugin that feeding/sleep timers use
// (iOS: ActivityKit Live Activity, Android: TimerForegroundService chronometer
// notification). No native change is needed: the native side counts up from
// `startTime` by itself, so the label only carries the text ("Sancı",
// "Hərəkət · 4") and the clock keeps running while the screen is locked.
//
// One live timer per tool "slot". Changing what is shown:
//  - Android: startActivity with the same id updates the notification in place.
//  - iOS: Live Activity attributes cannot change, so a new activity is started
//    under a new id and the old one is ended right after (no gap on screen).
// A new phase always starts before the old one stops, so the Android foreground
// service never stops and restarts in between.
//
// The shown id is kept in localStorage so a leftover activity from before an app
// restart is still ended. Web: everything is a no-op. When the person has turned
// Live Activities off (iOS Settings) the native call rejects and nothing is shown;
// there is no notification fallback for these tools.
import { Capacitor } from '@capacitor/core';
import { tr } from '@/lib/tr';
import { isNative } from '@/lib/native';
import LiveActivity from '@/plugins/LiveActivityPlugin';

export type ToolLiveTimerSlot = 'contraction' | 'kick';

export interface ToolLiveTimerView {
  /** Native timer kind (unknown kinds get a generic icon on iOS). */
  type: 'contraction' | 'kick';
  label: string;
  subLabel: string;
  /** Epoch ms the native clock counts up from. */
  startTime: number;
}

interface ShownTimer {
  id: string;
  sig: string;
}

const STORAGE_KEY = 'anacan_tool_live_timer_v1';

function readShown(): Partial<Record<ToolLiveTimerSlot, ShownTimer>> {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writeShown(slot: ToolLiveTimerSlot, shown: ShownTimer | null) {
  try {
    const all = readShown();
    if (shown) all[slot] = shown;
    else delete all[slot];
    if (Object.keys(all).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage blocked */ }
}

const signature = (v: ToolLiveTimerView) => JSON.stringify([v.type, v.label, v.subLabel, v.startTime]);

let idSeq = 0;
function nextId(slot: ToolLiveTimerSlot, view: ToolLiveTimerView) {
  const base = `${slot}-${view.startTime}`;
  if (Capacitor.getPlatform() === 'android') return base;
  idSeq += 1;
  return `${base}-${Date.now().toString(36)}${idSeq}`;
}

async function safeStop(timerId: string) {
  try { await LiveActivity.stopActivity({ timerId }); } catch { /* plugin missing: nothing to stop */ }
}

async function apply(slot: ToolLiveTimerSlot, view: ToolLiveTimerView | null) {
  const current = readShown()[slot] ?? null;
  if (!view) {
    if (current) {
      writeShown(slot, null);
      await safeStop(current.id);
    }
    return;
  }
  const sig = signature(view);
  if (current?.sig === sig) return;
  const id = nextId(slot, view);
  try {
    await LiveActivity.startActivity({
      id,
      type: view.type,
      label: view.label,
      subLabel: view.subLabel,
      // The lock-screen button only hides the timer; the session stays in the app.
      stopLabel: tr('livetimer_hide', 'Gizlət'),
      startTime: view.startTime,
      // Same channel as the feeding/sleep timers (passing the same name keeps it unchanged).
      channelName: tr('livetimer_channel_name', 'Taymerlər'),
      channelDesc: tr('livetimer_channel_desc', 'Aktiv süd vermə / yuxu taymerləri'),
    });
  } catch {
    // Live Activities off or unsupported: show nothing, drop the old one.
    writeShown(slot, null);
    if (current) await safeStop(current.id);
    return;
  }
  writeShown(slot, { id, sig });
  if (current && current.id !== id) await safeStop(current.id);
}

// Per slot, calls run one at a time and only the newest request is applied, so
// fast taps never pile up native activities and a hide immediately followed by
// the same show causes no flicker.
const desired = new Map<ToolLiveTimerSlot, ToolLiveTimerView | null>();
const runs = new Map<ToolLiveTimerSlot, Promise<void>>();

function request(slot: ToolLiveTimerSlot, view: ToolLiveTimerView | null): Promise<void> {
  if (!isNative) return Promise.resolve();
  desired.set(slot, view);
  const running = runs.get(slot);
  if (running) return running;
  const run = (async () => {
    try {
      // Let requests from the same render settle first (e.g. a restore that
      // immediately replaces a placeholder state), so they collapse into one.
      await new Promise((r) => setTimeout(r, 0));
      while (desired.has(slot)) {
        const next = desired.get(slot) ?? null;
        desired.delete(slot);
        try { await apply(slot, next); } catch (e) { console.warn('tool live timer:', e); }
      }
    } finally {
      runs.delete(slot);
    }
  })();
  runs.set(slot, run);
  return run;
}

/** Show (or update) the lock-screen live timer for a tool. */
export function showToolLiveTimer(slot: ToolLiveTimerSlot, view: ToolLiveTimerView): Promise<void> {
  return request(slot, view);
}

/** Remove the lock-screen live timer for a tool (no-op when nothing is shown). */
export function hideToolLiveTimer(slot: ToolLiveTimerSlot): Promise<void> {
  return request(slot, null);
}

/** Test helper: forget in-memory state. */
export function __resetToolLiveTimerForTests() {
  desired.clear();
  runs.clear();
  idSeq = 0;
}
