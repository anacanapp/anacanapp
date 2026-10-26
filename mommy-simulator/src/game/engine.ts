import { ACTIVITIES, CHAPTERS, FURNITURE, STORIES, copy, SKINS, HAIRS, OUTFITS } from './content';
import type { ActivityId, Avatar, GameAction, GameState, Memory, Need, Placement } from './types';
import { canPlace } from './navigation';
import { BIRTH_CHAPTER, FIRST_BABY_CHAPTER } from './scenario';
import { activityLocation, currentStep, missionFinished, missionStepIds, simulationWeek } from './progression';
import { dailyLifeComplete, GROCERY_PRODUCTS, groceryCheckout, householdActivityIssue, householdAfterActivity, LIFE_LOCATIONS, lifeWeather, newHousehold } from './luzern';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const levelFor = (xp: number) => Math.min(50, 1 + Math.floor(Math.sqrt(xp / 55)));
export const levelProgress = (xp: number) => {
  const level = levelFor(xp), min = 55 * (level - 1) ** 2, max = 55 * level ** 2;
  return { level, value: clamp((xp - min) / (max - min) * 100), remaining: Math.max(0, max - xp) };
};
export const activityById = (id: ActivityId) => ACTIVITIES.find(a => a.id === id)!;
export const isBaby = (state: GameState) => state.pregnancy.born;
export const dailyGoals = (state: GameState) => {
  const base = [...CHAPTERS[state.chapter].goals];
  if (state.chapterDay % 2 === 0) base[2] = isBaby(state) ? 'bath' : 'rest';
  return base;
};
export const goalsComplete = (state: GameState) => dailyGoals(state).every(id => state.completedToday.includes(id));
export const chapterCanAdvance = (state: GameState) => missionFinished(state) && state.chapter < CHAPTERS.length - 1 &&
  (state.chapter !== BIRTH_CHAPTER || state.pregnancy.born);
export const activeStory = (state: GameState) => STORIES.find(story => story.chapter === state.chapter &&
  story.day <= state.chapterDay && !state.storySeen.includes(story.id) && state.dailyActions >= 1);
const earliestChapter: Partial<Record<ActivityId, number>> = { name: 3, kick: 3, assemble: 6, birthplan: 7, contractions: 8, call: 8, birth: 8 };
export const availableActivities = (state: GameState) => ACTIVITIES.filter(a => a.id !== 'travel' && (!a.babyOnly || isBaby(state)) &&
  (!a.pregnancyOnly || !isBaby(state)) && activityLocation(a, state) === state.location && state.chapter >= (earliestChapter[a.id] ?? 0) &&
  (a.id !== 'birth' || state.chapter === BIRTH_CHAPTER) && (a.id !== 'test' || state.chapter === 0));

export const DEFAULT_AVATAR: Avatar = { name: 'Aylin', babyName: 'Dəniz', skin: SKINS[0], hair: HAIRS[0],
  outfit: OUTFITS[0], hairstyle: 'bun', personality: 'dreamer', outfitStyle: 'dress' };

export function createState(): GameState {
  return {
    schema: 3, revision: 0, started: false, avatar: { ...DEFAULT_AVATAR }, language: 'az',
    chapter: 0, chapterDay: 1, unlockedChapter: 0, day: 1, time: 9 * 60,
    coins: 230, xp: 0, stars: 0,
    needs: { energy: 80, food: 72, mood: 86, babyFood: 75, babySleep: 78, comfort: 82, bond: 55 },
    skills: { care: 0, cooking: 0, creativity: 0, balance: 0 }, activity: null,
    completedToday: [], dailyRewardClaimed: false, dailyActions: 0, totalActions: 0,
    theme: 'lavender', inventory: ['olive-plant'], placements: [], memories: [], storySeen: [], favourites: [],
    location: 'home', household: newHousehold(), missions: { completed: [], quality: {}, rewards: [] },
    pregnancy: { birthPlan: 'undecided', birthStage: 0, born: false, appointments: [], feeding: 'combination', support: 50, supportPerson: 'partner', comfort: 'music' },
    settings: { sound: true, haptics: true, reducedMotion: false, speed: 1 }, lastSaved: '',
  };
}

function change(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function needsAfter(state: GameState, effects: Partial<Record<Need, number>>, multiplier = 1): GameState['needs'] {
  const needs = { ...state.needs };
  for (const key of Object.keys(effects) as Need[]) needs[key] = clamp(needs[key] + effects[key]! * multiplier);
  return needs;
}

function memoryForChapter(state: GameState, chapter: number): Memory {
  const next = CHAPTERS[chapter];
  return { id: `chapter-${chapter}`, kind: 'chapter', chapter, day: state.day, title: next.title, description: next.subtitle, icon: next.icon };
}

function finishActivity(state: GameState): GameState {
  const active = state.activity!, a = activityById(active.id);
  const repeats = state.completedToday.filter(id => id === a.id).length;
  const rewardScale = repeats >= 2 ? 0.4 : 1;
  const qualityBonus = 1 + clamp(active.quality) / 200;
  const needs = needsAfter(state, a.effect, qualityBonus);
  const memories = [...state.memories];
  const step = currentStep(state), stepDone = step?.action === a.id && step.location === state.location && (!step.interactive || active.quality > 0);
  const missions = stepDone ? { ...state.missions, completed: [...state.missions.completed, step.id], quality: { ...state.missions.quality, [step.id]: active.quality } } : state.missions;
  const pregnancy = a.id === 'scan' ? { ...state.pregnancy, appointments: [...new Set([...state.pregnancy.appointments, simulationWeek(state)])] } :
    a.id === 'help' || a.id === 'talk' ? { ...state.pregnancy, support: clamp(state.pregnancy.support + 8) } : state.pregnancy;
  if (['test', 'scan', 'assemble', 'name', 'skin'].includes(a.id)) {
    const id = `${a.id}-${state.chapter}`;
    if (!memories.some(m => m.id === id)) memories.unshift({ id, kind: 'milestone', chapter: state.chapter, day: state.day, title: a.title, description: a.result, icon: a.icon, ...(active.sourceId ? { sourceId: active.sourceId } : {}) });
  }
  if (a.id === 'journal') {
    const id = `journal-${state.day}`;
    if (!memories.some(m => m.id === id)) memories.unshift({ id, kind: 'day', chapter: state.chapter, day: state.day,
      title: copy('Bu günün kiçik sevinci', 'Today’s little joy', 'Bugünün küçük sevinci'), description: CHAPTERS[state.chapter].subtitle, icon: 'pen' });
  }
  if (a.id === 'play') {
    const id = `discovery-${state.chapter}`;
    if (!memories.some(m => m.id === id)) memories.unshift({ id, kind: 'milestone', chapter: state.chapter, day: state.day,
      title: CHAPTERS[state.chapter].title,
      description: a.result, icon: 'sparkles', ...(active.sourceId ? { sourceId: active.sourceId } : {}) });
  }
  return change(state, { needs, activity: null, time: Math.min(23 * 60, state.time + a.minutes),
    xp: state.xp + Math.round(a.xp * qualityBonus * rewardScale),
    coins: state.coins + Math.round(a.coins * qualityBonus * rewardScale),
    skills: { ...state.skills, [a.skill]: Math.min(9999, state.skills[a.skill] + Math.round(8 * qualityBonus)) },
    completedToday: [...state.completedToday.slice(-60), a.id], dailyActions: state.dailyActions + 1,
    totalActions: state.totalActions + 1, memories: memories.slice(0, 120), missions, pregnancy,
    household: householdAfterActivity(state.household, a.id) });
}

function dayEnd(state: GameState): GameState {
  const id = `day-${state.day}`;
  const memory: Memory = { id, kind: 'day', day: state.day, chapter: state.chapter, icon: 'sun',
    title: copy('Bir gün də sevgi ilə', 'Another day with love', 'Bir gün daha sevgiyle'),
    description: copy(`${state.dailyActions} kiçik an, bir isti yuva.`, `${state.dailyActions} little moments, one cosy home.`, `${state.dailyActions} küçük an, sıcak bir yuva.`) };
  return change(state, { day: state.day + 1, chapterDay: state.chapterDay + 1, time: 8 * 60 + 30,
    needs: { ...state.needs, energy: 92, food: Math.max(52, state.needs.food - 12),
      babyFood: Math.max(55, state.needs.babyFood - 10), babySleep: 90, comfort: Math.max(65, state.needs.comfort), mood: Math.max(72, state.needs.mood) },
    completedToday: [], dailyActions: 0, dailyRewardClaimed: false,
    coins: state.coins + 12, memories: [memory, ...state.memories.filter(m => m.id !== id)].slice(0, 120),
    household: { ...state.household, chores: [], cleanliness: Math.max(10, state.household.cleanliness - 8),
      cash: Math.min(10000000, state.household.cash + (state.day % 7 === 0 ? 85000 : 0)),
      laundry: { ...state.household.laundry, dirty: Math.min(36, state.household.laundry.dirty + (state.pregnancy.born ? 5 : 3)) },
      weather: lifeWeather(state.day + 1), moodlet: 'home' } });
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START': {
      const chapter = action.chapter === 4 || action.chapter === FIRST_BABY_CHAPTER + 1 ? FIRST_BABY_CHAPTER + 1 : 0;
      const first = createState();
      return change(first, { started: true, avatar: sanitizeAvatar(action.avatar), language: action.language,
        chapter, unlockedChapter: chapter, memories: [memoryForChapter(first, chapter)],
        location: chapter === FIRST_BABY_CHAPTER + 1 ? 'clinic' : 'home',
        missions: { completed: CHAPTERS.slice(0, chapter).flatMap(c => c.mission.steps.map(s => s.id)), quality: {}, rewards: CHAPTERS.slice(0, chapter).map(c => c.id) },
        pregnancy: { ...first.pregnancy, born: chapter >= FIRST_BABY_CHAPTER, birthPlan: chapter >= FIRST_BABY_CHAPTER ? 'vaginal' : 'undecided', birthStage: chapter >= FIRST_BABY_CHAPTER ? 4 : 0 } });
    }
    case 'TICK': {
      if (!state.started || state.settings.speed === 0) return state;
      const dt = clamp(Number.isFinite(action.dt) ? action.dt : 0, 0, 1.1) * state.settings.speed;
      if (!dt) return state;
      const fatigue = !isBaby(state) && simulationWeek(state) >= 28 ? 1.5 : 1;
      const needs = needsAfter(state, { energy: -.06 * fatigue, food: -.07, mood: -.025,
        ...(isBaby(state) ? { babyFood: -.06, babySleep: -.04, comfort: -.045 } : {}) }, dt);
      const next = { ...state, needs, time: Math.min(23 * 60, state.time + dt * 1.25) };
      if (state.activity) {
        next.activity = { ...state.activity, elapsed: state.activity.elapsed + dt };
        if (next.activity.elapsed >= activityById(next.activity.id).seconds) return finishActivity(next);
      }
      return change(state, { needs: next.needs, time: next.time, activity: next.activity,
        household: { ...state.household, cleanliness: Math.max(10, state.household.cleanliness - dt * .009) } });
    }
    case 'BEGIN': {
      const a = ACTIVITIES.find(item => item.id === action.id);
      if (!state.started || state.activity || !a || (a.babyOnly && !isBaby(state)) || (a.pregnancyOnly && isBaby(state)) || activityLocation(a, state) !== state.location) return state;
      if (state.chapter < (earliestChapter[a.id] ?? 0) || a.id === 'test' && state.chapter > 0) return state;
      if (a.id === 'birth' || a.id === 'travel') return state;
      if (householdActivityIssue(state, a.id) || a.id === 'groceries' && (!action.quality || !state.household.purchases)) return state;
      return change(state, { activity: { id: a.id, elapsed: 0, quality: clamp(action.quality ?? 0),
        ...(typeof action.sourceId === 'string' ? { sourceId: action.sourceId.slice(0, 100) } : {}) } });
    }
    case 'CANCEL_ACTIVITY': return state.activity ? change(state, { activity: null }) : state;
    case 'SLEEP': return state.dailyActions >= 3 && !state.activity ? dayEnd(state) : state;
    case 'ADVANCE_CHAPTER': {
      if (!chapterCanAdvance(state) || state.activity) return state;
      const rested = dayEnd(state), chapter = state.chapter + 1;
      return change(rested, { chapter, unlockedChapter: chapter, chapterDay: 1, stars: state.stars + 1,
        coins: rested.coins + 80, xp: rested.xp + 45,
        memories: [memoryForChapter(rested, chapter), ...rested.memories].slice(0, 120),
        needs: { ...rested.needs, babyFood: 82, babySleep: 85, comfort: 88 },
        location: CHAPTERS[chapter].mission.steps[0].location });
    }
    case 'TRAVEL': {
      if (state.activity || state.location === action.location || !LIFE_LOCATIONS.some(l => l.id === action.location)) return state;
      const step = currentStep(state), completed = step?.action === 'travel' && step.travelTo === action.location && step.location === state.location;
      return change(state, { location: action.location, time: Math.min(23 * 60, state.time + (LIFE_LOCATIONS.find(l => l.id === action.location)?.minutes || 15)),
        missions: completed ? { ...state.missions, completed: [...state.missions.completed, step.id], quality: { ...state.missions.quality, [step.id]: 100 } } : state.missions });
    }
    case 'CLAIM_MISSION': {
      const chapter = CHAPTERS[state.chapter];
      if (!missionFinished(state) || state.missions.rewards.includes(chapter.id)) return state;
      return change(state, { coins: state.coins + chapter.mission.reward, xp: state.xp + 60, stars: state.stars + 2,
        missions: { ...state.missions, rewards: [...state.missions.rewards, chapter.id] } });
    }
    case 'BIRTH_PLAN': return !state.pregnancy.born && ['vaginal', 'cesarean'].includes(action.plan) ? change(state, { pregnancy: { ...state.pregnancy, birthPlan: action.plan,
      supportPerson: action.supportPerson === 'family' ? 'family' : action.supportPerson === 'partner' ? 'partner' : state.pregnancy.supportPerson,
      comfort: action.comfort === 'light' ? 'light' : action.comfort === 'music' ? 'music' : state.pregnancy.comfort } }) : state;
    case 'BOOK_APPOINTMENT': return Number.isInteger(action.appointment.day) && action.appointment.day >= state.day &&
      /^\d{2}:\d{2}$/.test(action.appointment.time) && ['partner', 'family'].includes(action.appointment.supportPerson)
      ? change(state, { pregnancy: { ...state.pregnancy, appointment: action.appointment } }) : state;
    case 'FEEDING': return ['breast', 'bottle', 'combination'].includes(action.method) ? change(state, { pregnancy: { ...state.pregnancy, feeding: action.method } }) : state;
    case 'BIRTH_STAGE': return state.chapter === BIRTH_CHAPTER && currentStep(state)?.action === 'birth' && state.pregnancy.birthPlan !== 'undecided' && !state.pregnancy.born && state.location === 'clinic' && action.stage === state.pregnancy.birthStage + 1 && action.stage <= 4
      ? change(state, { pregnancy: { ...state.pregnancy, birthStage: action.stage } }) : state;
    case 'BIRTH_COMPLETE': {
      const step = currentStep(state);
      if (state.chapter !== BIRTH_CHAPTER || state.location !== 'clinic' || state.pregnancy.birthPlan === 'undecided' || state.pregnancy.born || state.pregnancy.birthStage !== 4 || step?.action !== 'birth') return state;
      return change(state, { pregnancy: { ...state.pregnancy, born: true },
        missions: { ...state.missions, completed: [...state.missions.completed, step.id], quality: { ...state.missions.quality, [step.id]: clamp(action.quality) } },
        coins: state.coins + 100, xp: state.xp + 80, totalActions: state.totalActions + 1,
        memories: [{ id: 'birth-story', kind: 'milestone' as const, chapter: state.chapter, day: state.day,
          title: copy('Xoş gəldin, balacam', 'Welcome, little one', 'Hoş geldin, bebeğim'), description: copy(`${state.avatar.babyName} ilə ilk qucaq.`, `The first embrace with ${state.avatar.babyName}.`, `${state.avatar.babyName} ile ilk kucak.`), icon: 'baby' }, ...state.memories].slice(0, 120) });
    }
    case 'CLAIM_DAILY': {
      if (!goalsComplete(state) || state.dailyRewardClaimed) return state;
      return change(state, { dailyRewardClaimed: true, coins: state.coins + 55, xp: state.xp + 30, stars: state.stars + 1 });
    }
    case 'CLAIM_LIFE_DAY': {
      if (state.household.dailyRewardDay === state.day || !dailyLifeComplete(state)) return state;
      return change(state, { xp: state.xp + 35, coins: state.coins + 45, household: { ...state.household, dailyRewardDay: state.day } });
    }
    case 'SHOP': {
      if (!state.started || state.activity || state.location !== 'market') return state;
      const checkout = groceryCheckout(state.household, action.basket);
      if (!checkout) return state;
      return change(state, { household: { ...state.household, cash: state.household.cash - checkout.cost, groceries: checkout.groceries, purchases: state.household.purchases + 1 } });
    }
    case 'BUY': {
      const item = FURNITURE.find(i => i.id === action.itemId);
      if (!item || state.inventory.includes(item.id) || state.coins < item.price || levelFor(state.xp) < item.level) return state;
      return change(state, { inventory: [...state.inventory, item.id], coins: state.coins - item.price });
    }
    case 'PLACE': {
      const p = action.placement;
      if (!state.inventory.includes(p.itemId) || !validPlacement(p) || state.placements.some(i => i.itemId === p.itemId) ||
        !canPlace(p.x, p.z, p.itemId, state.placements)) return state;
      return change(state, { placements: [...state.placements, p] });
    }
    case 'REMOVE': return change(state, { placements: state.placements.filter(p => p.id !== action.id) });
    case 'THEME': return ['lavender', 'peach', 'sage'].includes(action.theme) ? change(state, { theme: action.theme }) : state;
    case 'AVATAR': return change(state, { avatar: sanitizeAvatar(action.avatar) });
    case 'SETTINGS': return change(state, { settings: { ...state.settings, ...action.settings } });
    case 'LANGUAGE': return ['az', 'en', 'tr'].includes(action.language) ? change(state, { language: action.language }) : state;
    case 'STORY': {
      const story = activeStory(state);
      if (!story || story.id !== action.id || ![0, 1].includes(action.choice)) return state;
      const memory: Memory = { id: `story-${story.id}`, kind: 'story', chapter: state.chapter, day: state.day,
        title: story.title, description: story.choices[action.choice], icon: story.icon };
      const theme = story.id === 'nursery-dream' ? (action.choice === 0 ? 'lavender' : 'sage') : state.theme;
      const skill = action.choice === 0 ? 'creativity' : 'care';
      return change(state, { storySeen: [...state.storySeen, story.id], memories: [memory, ...state.memories].slice(0, 120),
        coins: state.coins + 25, xp: state.xp + 20, theme,
        skills: { ...state.skills, [skill]: state.skills[skill] + 15 }, needs: needsAfter(state, { mood: 10, bond: 12 }) });
    }
    case 'MEMORY': {
      const m = action.memory;
      if (!validMemory(m) || state.memories.some(item => item.id === m.id)) return state;
      let photos = 0;
      return change(state, { memories: [m, ...state.memories].filter(memory => !memory.photo || ++photos <= 12).slice(0, 120) });
    }
    case 'FAVOURITE': return change(state, { favourites: state.favourites.includes(action.id)
      ? state.favourites.filter(id => id !== action.id) : [...state.favourites, action.id].slice(-500) });
    case 'LOAD': return validateState(action.state) ? change(action.state, { activity: null }) : state;
    case 'RESET': return createState();
  }
}

export function sanitizeAvatar(avatar: Avatar): Avatar {
  const clean = (value: unknown, fallback: string) => typeof value === 'string'
    ? value.replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 24) || fallback : fallback;
  return { name: clean(avatar.name, 'Aylin'), babyName: clean(avatar.babyName, 'Dəniz'),
    skin: SKINS.includes(avatar.skin) ? avatar.skin : SKINS[0], hair: HAIRS.includes(avatar.hair) ? avatar.hair : HAIRS[0],
    outfit: OUTFITS.includes(avatar.outfit) ? avatar.outfit : OUTFITS[0],
    hairstyle: ['bob', 'bun', 'long'].includes(avatar.hairstyle) ? avatar.hairstyle : 'bun',
    personality: ['dreamer', 'maker', 'gentle'].includes(avatar.personality) ? avatar.personality : 'dreamer',
    outfitStyle: ['dress', 'casual', 'knit'].includes(avatar.outfitStyle) ? avatar.outfitStyle : 'dress' };
}

function validPlacement(p: Placement): boolean {
  return !!p && typeof p.id === 'string' && p.id.length <= 100 && FURNITURE.some(i => i.id === p.itemId) &&
    Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) < 7 && Math.abs(p.z) < 7 &&
    Number.isFinite(p.rotation) && p.rotation >= 0 && p.rotation <= Math.PI * 2;
}

function validMemory(m: Memory): boolean {
  return !!m && typeof m.id === 'string' && m.id.length <= 100 && ['chapter', 'milestone', 'photo', 'story', 'day'].includes(m.kind) &&
    Number.isInteger(m.chapter) && m.chapter >= 0 && m.chapter < CHAPTERS.length && Number.isInteger(m.day) && m.day >= 1 &&
    typeof m.icon === 'string' && [m.title, m.description].every(c => Array.isArray(c) && c.length === 3 && c.every(s => typeof s === 'string' && s.length < 5000)) &&
    (!m.photo || (typeof m.photo === 'string' && m.photo.startsWith('data:image/jpeg;base64,') && m.photo.length < 900000));
}

export function validateState(raw: unknown): raw is GameState {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as GameState;
  const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
  try {
    return s.schema === 3 && typeof s.started === 'boolean' && int(s.revision, 0, 1e9) && ['az', 'en', 'tr'].includes(s.language) &&
      int(s.chapter, 0, CHAPTERS.length - 1) && int(s.chapterDay, 1, 100000) && int(s.unlockedChapter, s.chapter, CHAPTERS.length - 1) && int(s.day, 1, 100000) &&
      int(s.coins, 0, 1e8) && int(s.xp, 0, 1e8) && int(s.stars, 0, 1e8) && Number.isFinite(s.time) && s.time >= 0 && s.time <= 1440 &&
      ['energy', 'food', 'mood', 'babyFood', 'babySleep', 'comfort', 'bond'].every(k => Number.isFinite(s.needs[k as Need]) && s.needs[k as Need] >= 0 && s.needs[k as Need] <= 100) &&
      ['care', 'cooking', 'creativity', 'balance'].every(k => int(s.skills[k as keyof typeof s.skills], 0, 99999)) &&
      typeof s.avatar.name === 'string' && typeof s.avatar.babyName === 'string' && s.avatar.name.length <= 24 && s.avatar.babyName.length <= 24 &&
      SKINS.includes(s.avatar.skin) && HAIRS.includes(s.avatar.hair) && OUTFITS.includes(s.avatar.outfit) &&
      ['bob', 'bun', 'long'].includes(s.avatar.hairstyle) && ['dreamer', 'maker', 'gentle'].includes(s.avatar.personality) &&
      ['dress', 'casual', 'knit'].includes(s.avatar.outfitStyle) &&
      (s.activity === null || (ACTIVITIES.some(a => a.id === s.activity?.id) && Number.isFinite(s.activity.elapsed) && s.activity.elapsed >= 0 && s.activity.elapsed <= 20 && Number.isFinite(s.activity.quality) && s.activity.quality >= 0 && s.activity.quality <= 100)) &&
      Array.isArray(s.completedToday) && s.completedToday.length <= 61 && s.completedToday.every(id => ACTIVITIES.some(a => a.id === id)) &&
      typeof s.dailyRewardClaimed === 'boolean' && int(s.dailyActions, 0, 100000) && int(s.totalActions, 0, 1e8) &&
      ['lavender', 'peach', 'sage'].includes(s.theme) && Array.isArray(s.inventory) && s.inventory.length <= FURNITURE.length &&
      s.inventory.every(id => FURNITURE.some(i => i.id === id)) && new Set(s.inventory).size === s.inventory.length &&
      Array.isArray(s.placements) && s.placements.length <= FURNITURE.length && s.placements.every(p => validPlacement(p) && s.inventory.includes(p.itemId)) &&
      new Set(s.placements.map(p => p.itemId)).size === s.placements.length &&
      Array.isArray(s.memories) && s.memories.length <= 120 && s.memories.every(validMemory) &&
      Array.isArray(s.storySeen) && s.storySeen.every(id => STORIES.some(story => story.id === id)) &&
      Array.isArray(s.favourites) && s.favourites.length <= 500 && s.favourites.every(id => typeof id === 'string' && id.length < 100) &&
      typeof s.settings.sound === 'boolean' && typeof s.settings.haptics === 'boolean' && typeof s.settings.reducedMotion === 'boolean' && [0, 1, 2].includes(s.settings.speed) &&
      LIFE_LOCATIONS.some(l => l.id === s.location) && Array.isArray(s.missions.completed) && s.missions.completed.length <= missionStepIds.size &&
      new Set(s.missions.completed).size === s.missions.completed.length && s.missions.completed.every(id => missionStepIds.has(id)) &&
      typeof s.missions.quality === 'object' && Object.entries(s.missions.quality).every(([id, quality]) => missionStepIds.has(id) && Number.isFinite(quality) && quality >= 0 && quality <= 100) &&
      Array.isArray(s.missions.rewards) && s.missions.rewards.length <= CHAPTERS.length && new Set(s.missions.rewards).size === s.missions.rewards.length && s.missions.rewards.every(id => CHAPTERS.some(c => c.id === id)) &&
      ['undecided', 'vaginal', 'cesarean'].includes(s.pregnancy.birthPlan) && int(s.pregnancy.birthStage, 0, 4) && typeof s.pregnancy.born === 'boolean' &&
      Array.isArray(s.pregnancy.appointments) && s.pregnancy.appointments.every(week => int(week, 0, 42)) && ['breast', 'bottle', 'combination'].includes(s.pregnancy.feeding) &&
      Number.isFinite(s.pregnancy.support) && s.pregnancy.support >= 0 && s.pregnancy.support <= 100 &&
      ['partner', 'family'].includes(s.pregnancy.supportPerson) && ['music', 'light'].includes(s.pregnancy.comfort) &&
      (!s.pregnancy.appointment || int(s.pregnancy.appointment.day, 1, 100000) && /^\d{2}:\d{2}$/.test(s.pregnancy.appointment.time) && ['partner', 'family'].includes(s.pregnancy.appointment.supportPerson)) &&
      int(s.household.cash, 0, 10000000) && GROCERY_PRODUCTS.every(p => int(s.household.groceries[p.id], 0, 40)) &&
      Number.isFinite(s.household.cleanliness) && s.household.cleanliness >= 0 && s.household.cleanliness <= 100 &&
      ['dirty', 'clean', 'folded'].every(k => int(s.household.laundry[k as keyof typeof s.household.laundry], 0, 100000)) &&
      int(s.household.relationship, 0, 100) && int(s.household.meals, 0, 100000) && int(s.household.purchases, 0, 100000) && int(s.household.dailyRewardDay, 0, 100000) &&
      Array.isArray(s.household.chores) && s.household.chores.length <= ACTIVITIES.length && s.household.chores.every(id => ACTIVITIES.some(a => a.id === id)) &&
      ['sunny', 'cloudy', 'rain'].includes(s.household.weather) && ['home', 'nourished', 'inspired', 'rested', 'connected'].includes(s.household.moodlet) && typeof s.lastSaved === 'string';
  } catch { return false; }
}
