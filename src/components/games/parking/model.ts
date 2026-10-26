export const PARKING_ID = 'clear-the-way';
export const PARKING_REVISION = 'parking-202610-v1';
export const PARKING_LEVELS = 40;
export const PARKING_SIZE = 6;
export interface ParkingCar { id: string; axis: 'h' | 'v'; lane: number; length: 2 | 3; color: number }
export interface ParkingMove { car: number; to: number }
export interface ParkingLevel {
  schema: 'anacan-parking-level-v1'; revision: string; level: number; chapter: 1 | 2 | 3 | 4 | 5;
  cars: ParkingCar[]; positions: number[]; keyBay: { car: number; position: number } | null;
  par: number; solution: ParkingMove[];
}
export interface ParkingState { positions: number[]; open: boolean }
export interface ParkingRound {
  schema: 'anacan-parking-round-v1'; level: number; path: ParkingMove[]; moves: number; hints: number; undos: number;
}
