/// <reference lib="webworker" />
import { solveParking } from './engine';
import type { ParkingLevel, ParkingState } from './model';

addEventListener('message', (event: MessageEvent<{ level: ParkingLevel; state: ParkingState }>) => {
  postMessage(solveParking(event.data.level, event.data.state).path?.[0] || null);
});
