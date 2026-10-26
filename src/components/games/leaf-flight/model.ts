export const LEAF_FLIGHT_ID = 'leaf-flight';
export const LEAF_FLIGHT_REVISION = 'flight-202610-v1';
export const LEAF_FLIGHT_LEVELS = 30;
export const FLIGHT_HEIGHT = 720;
export const FLIGHT_PLAYER_X = 100;
export const FLIGHT_STEP = 1 / 60;
export interface FlightGap { center: number; height: number }
export interface FlightGate {
  x: number; width: number; gap: FlightGap; motion: number; phase: number;
  secret: FlightGap | null;
}
export interface FlightStar { id: number; x: number; y: number; secret: boolean }
export interface FlightWind { from: number; to: number; force: number }
export interface FlightLevel {
  schema: 'anacan-leaf-flight-level-v1'; revision: string; level: number;
  chapter: 1 | 2 | 3 | 4 | 5; speed: number; distance: number; gates: FlightGate[];
  stars: FlightStar[]; winds: FlightWind[];
}
export interface FlightState {
  schema: 'anacan-leaf-flight-round-v1'; level: number; time: number; distance: number;
  y: number; velocity: number; hearts: number; shield: number; collected: number[];
  won: boolean; lost: boolean;
}
