export const TWO_FRIENDS_ID = 'iki-dost';
export const TWO_FRIENDS_REVISION = 'friends-202610-v1';
export const TWO_FRIENDS_LEVELS = 40;
export const FRIEND_NAMES = ['Ritm', 'Tumurcuq'] as const;
export const FRIEND_DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type FriendDirection = typeof FRIEND_DIRECTIONS[number];
export type FriendControl = 'same' | 'mirror-x' | 'opposite' | 'mirror-y';
export type FriendTile = '#' | '.' | 'S' | 'H' | '!' | 'k' | 'l' | 'K' | 'L' | 'a' | 'b' | 'A' | 'B';
export interface FriendWorld { rows: string[]; start: number; home: number }
export interface FriendsLevel {
  schema: 'anacan-two-friends-level-v1'; revision: string; level: number; chapter: 1 | 2 | 3 | 4 | 5;
  worlds: [FriendWorld, FriendWorld]; control: FriendControl; plateCounts: [number, number];
  par: number; solution: FriendDirection[];
}
export interface FriendsState { positions: [number, number]; keys: number }
export interface FriendsMove {
  state: FriendsState; changed: boolean; lost: boolean; won: boolean;
  moved: [boolean, boolean]; collectedKeys: number; openedDoors: number;
}
export interface FriendsRound {
  level: number; path: FriendDirection[]; moves: number; hints: number; undos: number; awarded: boolean;
}
export interface FriendsProfile {
  schema: 'anacan-two-friends-profile-v1'; revision: string;
  progress: { unlocked: number; totalRescues: number; bestScore: number;
    levels: Record<string, { stars: 1 | 2 | 3; score: number }> };
  round: FriendsRound | null;
}
export interface FriendsPreferences { sound: boolean; haptics: boolean }
export const friendCell = (world: FriendWorld, position: number) => world.rows[Math.floor(position / world.rows[0].length)]?.[position % world.rows[0].length] as FriendTile | undefined;
export const friendPosition = (world: FriendWorld, position: number) => ({ row: Math.floor(position / world.rows[0].length), column: position % world.rows[0].length });
