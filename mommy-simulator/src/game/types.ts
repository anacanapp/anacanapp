export type Language = 'az' | 'en' | 'tr';
export type Copy = readonly [az: string, en: string, tr: string];
export type Need = 'energy' | 'food' | 'mood' | 'babyFood' | 'babySleep' | 'comfort' | 'bond';
export type Room = 'living' | 'kitchen' | 'nursery' | 'garden' | 'bathroom' | 'bedroom' | 'clinic' | 'lakeside' | 'market' | 'cafe';
export type Location = 'home' | 'clinic' | 'lakeside' | 'market' | 'cafe';
export type Skill = 'care' | 'cooking' | 'creativity' | 'balance';
export type GameSpeed = 0 | 1 | 2;
export type ActivityId = 'rest' | 'water' | 'cook' | 'read' | 'breathe' | 'walk' | 'plant' |
  'talk' | 'help' | 'pack' | 'feed' | 'diaper' | 'lullaby' | 'play' | 'bath' | 'journal' | 'checkup' | 'tidy' |
  'test' | 'appointment' | 'scan' | 'stretch' | 'name' | 'kick' | 'assemble' | 'birthplan' | 'contractions' |
  'call' | 'birth' | 'skin' | 'carseat' | 'sterilise' | 'soothe' | 'routine' | 'travel' | 'laundry' | 'clean' | 'groceries' | 'coffee' | 'lakesideWalk';
export type MiniGameKind = 'cooking' | 'lullaby' | 'packing' | 'discovery' | 'pregnancyTest' | 'appointment' |
  'scan' | 'breathing' | 'nesting' | 'birthPlan' | 'contractions' | 'birth' | 'babyCare' | 'carseat' | 'routine' | 'names' | 'laundry' | 'cleaning' | 'groceries' | 'coffeeRitual' | 'lakeDiscovery';
export type Panel = 'tasks' | 'journey' | 'decorate' | 'family' | 'album' | 'library' | 'settings' | 'help' | 'map' | 'day';

export interface Household {
  cash: number;
  groceries: Record<'vegetables' | 'fruit' | 'milk' | 'bread' | 'oats', number>;
  cleanliness: number;
  laundry: { dirty: number; clean: number; folded: number };
  relationship: number;
  meals: number;
  purchases: number;
  dailyRewardDay: number;
  chores: ActivityId[];
  weather: 'sunny' | 'cloudy' | 'rain';
  moodlet: 'home' | 'nourished' | 'inspired' | 'rested' | 'connected';
}

export interface Avatar {
  name: string;
  babyName: string;
  skin: string;
  hair: string;
  hairstyle: 'bob' | 'bun' | 'long';
  outfit: string;
  personality: 'dreamer' | 'maker' | 'gentle';
  outfitStyle: 'dress' | 'casual' | 'knit';
}

export interface Chapter {
  id: string;
  title: Copy;
  subtitle: Copy;
  intro: Copy;
  period: Copy;
  week: number;
  baby: boolean;
  icon: string;
  colour: string;
  goals: ActivityId[];
  endWeek: number;
  mission: { title: Copy; description: Copy; reward: number; steps: MissionStep[] };
}

export interface MissionStep {
  id: string;
  title: Copy;
  description: Copy;
  action: ActivityId;
  location: Location;
  interactive?: boolean;
  travelTo?: Location;
}

export interface Activity {
  id: ActivityId;
  title: Copy;
  description: Copy;
  result: Copy;
  icon: string;
  room: Room;
  target: string;
  seconds: number;
  minutes: number;
  effect: Partial<Record<Need, number>>;
  skill: Skill;
  xp: number;
  coins: number;
  babyOnly?: boolean;
  pregnancyOnly?: boolean;
  mini?: MiniGameKind;
  location?: Location;
}

export interface ActiveActivity {
  id: ActivityId;
  elapsed: number;
  quality: number;
  sourceId?: string;
}

export interface Placement {
  id: string;
  itemId: string;
  x: number;
  z: number;
  rotation: number;
}

export interface Furniture {
  id: string;
  title: Copy;
  description: Copy;
  price: number;
  level: number;
  kind: 'plant' | 'rug' | 'lamp' | 'toy' | 'ottoman' | 'flowers' | 'shelf';
  colour: string;
  icon: string;
  room: Room;
}

export interface Memory {
  id: string;
  kind: 'chapter' | 'milestone' | 'photo' | 'story' | 'day';
  chapter: number;
  day: number;
  title: Copy;
  description: Copy;
  icon: string;
  photo?: string;
  sourceId?: string;
}

export interface GameState {
  schema: 3;
  revision: number;
  started: boolean;
  avatar: Avatar;
  language: Language;
  chapter: number;
  chapterDay: number;
  day: number;
  time: number;
  coins: number;
  xp: number;
  stars: number;
  needs: Record<Need, number>;
  skills: Record<Skill, number>;
  activity: ActiveActivity | null;
  completedToday: ActivityId[];
  dailyRewardClaimed: boolean;
  dailyActions: number;
  totalActions: number;
  unlockedChapter: number;
  theme: 'lavender' | 'peach' | 'sage';
  inventory: string[];
  placements: Placement[];
  memories: Memory[];
  storySeen: string[];
  favourites: string[];
  location: Location;
  household: Household;
  missions: { completed: string[]; quality: Record<string, number>; rewards: string[] };
  pregnancy: { birthPlan: 'undecided' | 'vaginal' | 'cesarean'; birthStage: number; born: boolean;
    appointments: number[]; feeding: 'breast' | 'bottle' | 'combination'; support: number;
    supportPerson: 'partner' | 'family'; comfort: 'music' | 'light';
    appointment?: { day: number; time: string; supportPerson: 'partner' | 'family' } };
  settings: { sound: boolean; haptics: boolean; reducedMotion: boolean; speed: GameSpeed };
  lastSaved: string;
}

export type GameAction =
  | { type: 'START'; avatar: Avatar; chapter: number; language: Language }
  | { type: 'TICK'; dt: number }
  | { type: 'BEGIN'; id: ActivityId; quality?: number; sourceId?: string }
  | { type: 'CANCEL_ACTIVITY' }
  | { type: 'SLEEP' }
  | { type: 'ADVANCE_CHAPTER' }
  | { type: 'TRAVEL'; location: Location }
  | { type: 'CLAIM_MISSION' }
  | { type: 'BIRTH_PLAN'; plan: GameState['pregnancy']['birthPlan']; supportPerson?: GameState['pregnancy']['supportPerson']; comfort?: GameState['pregnancy']['comfort'] }
  | { type: 'BOOK_APPOINTMENT'; appointment: NonNullable<GameState['pregnancy']['appointment']> }
  | { type: 'BIRTH_STAGE'; stage: number }
  | { type: 'BIRTH_COMPLETE'; quality: number }
  | { type: 'FEEDING'; method: GameState['pregnancy']['feeding'] }
  | { type: 'CLAIM_DAILY' }
  | { type: 'CLAIM_LIFE_DAY' }
  | { type: 'SHOP'; basket: Partial<Household['groceries']> }
  | { type: 'BUY'; itemId: string }
  | { type: 'PLACE'; placement: Placement }
  | { type: 'REMOVE'; id: string }
  | { type: 'THEME'; theme: GameState['theme'] }
  | { type: 'AVATAR'; avatar: Avatar }
  | { type: 'SETTINGS'; settings: Partial<GameState['settings']> }
  | { type: 'LANGUAGE'; language: Language }
  | { type: 'STORY'; id: string; choice: number }
  | { type: 'MEMORY'; memory: Memory }
  | { type: 'FAVOURITE'; id: string }
  | { type: 'LOAD'; state: GameState }
  | { type: 'RESET' };

export interface PublicRow {
  id: string;
  [key: string]: unknown;
}

export interface Catalogue {
  schema: 'mommy-public-catalogue-v1';
  origin: string;
  project: string;
  fetchedAt: string;
  pregnancy: PublicRow[];
  milestones: PublicRow[];
  recipes: PublicRow[];
  bag: PublicRow[];
  names: PublicRow[];
  weekly: PublicRow[];
}
