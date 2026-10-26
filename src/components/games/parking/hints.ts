import { solveParking } from './engine';
import type { ParkingLevel, ParkingMove, ParkingState } from './model';

export function requestParkingHint(level: ParkingLevel, state: ParkingState, signal: AbortSignal): Promise<ParkingMove | null> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  let worker: Worker;
  try { if (typeof Worker === 'undefined') return Promise.resolve(solveParking(level, state).path?.[0] || null);
    worker = new Worker(new URL('./parking.worker.ts', import.meta.url), { type: 'module' });
  } catch { return Promise.resolve(solveParking(level, state).path?.[0] || null); }
  return new Promise((resolve, reject) => {
    const finish = (value: ParkingMove | null, error?: Error) => { worker.terminate(); clearTimeout(timer); signal.removeEventListener('abort', cancel); if (error) reject(error); else resolve(value); };
    const cancel = () => finish(null, new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => finish(null, new Error('PARKING_HINT_TIMEOUT')), 10000);
    signal.addEventListener('abort', cancel, { once: true }); worker.onmessage = event => finish(event.data);
    worker.onerror = () => finish(null, new Error('PARKING_HINT_FAILED'));
    try { worker.postMessage({ level, state }); } catch { finish(null, new Error('PARKING_HINT_FAILED')); }
  });
}
