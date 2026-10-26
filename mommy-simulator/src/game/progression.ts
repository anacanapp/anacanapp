import { ALL_MISSION_STEPS, BIRTH_CHAPTER, FIRST_BABY_CHAPTER, SIM_CHAPTERS } from './scenario';
import type { Activity, GameState } from './types';

export const currentMission = (state: GameState) => SIM_CHAPTERS[state.chapter].mission;
export const currentStep = (state: GameState) => currentMission(state).steps.find(step => !state.missions.completed.includes(step.id));
export const missionFinished = (state: GameState) => currentMission(state).steps.every(step => state.missions.completed.includes(step.id));
export const missionProgress = (state: GameState) => {
  const steps = currentMission(state).steps, completed = steps.filter(s => state.missions.completed.includes(s.id)).length;
  return { completed, total: steps.length, percent: completed / steps.length * 100 };
};
export function simulationWeek(state: GameState) {
  const chapter = SIM_CHAPTERS[state.chapter], progress = missionProgress(state);
  return Math.round(chapter.week + (chapter.endWeek - chapter.week) * progress.completed / progress.total);
}
export function activityLocation(activity: Activity, state: GameState): GameState['location'] {
  if (['talk', 'help', 'read', 'breathe', 'water'].includes(activity.id) && ['lakeside', 'cafe'].includes(state.location)) return state.location;
  if (['feed', 'diaper', 'skin', 'journal', 'rest', 'water', 'breathe', 'help', 'talk', 'name'].includes(activity.id) && state.location === 'clinic') return 'clinic';
  if (activity.id === 'checkup') return 'clinic';
  return activity.location ?? 'home';
}
export function targetForActivity(activity: Activity, state: GameState) {
  if (state.location !== 'clinic') return activity.id === 'skin' ? 'chair' : activity.target;
  if (activity.id === 'scan') return 'scanner';
  if (activity.id === 'checkup' || activity.id === 'journal') return 'doctor';
  if (activity.id === 'carseat' || activity.id === 'water' || activity.id === 'name') return 'reception';
  if (activity.id === 'diaper') return 'clinicdresser';
  if (activity.id === 'rest' || activity.id === 'feed' || activity.id === 'skin' || activity.id === 'birth') return 'birthbed';
  return 'birthbed';
}

export function upgradeLegacyState(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || (raw as { schema: number }).schema !== 1) return raw;
  const state = raw as Record<string, unknown>, oldChapter = Number(state.chapter);
  if (!Number.isInteger(oldChapter) || oldChapter < 0 || oldChapter > 7) return raw;
  const mapping = [0, 3, 4, 7, 10, 11, 12, 13], chapter = mapping[oldChapter];
  const completed = SIM_CHAPTERS.slice(0, chapter).flatMap(c => c.mission.steps.map(s => s.id));
  const avatar = state.avatar as Record<string, unknown>;
  return { ...state, schema: 2, chapter, unlockedChapter: chapter, avatar: { ...avatar, outfitStyle: 'dress' },
    location: 'home', missions: { completed, quality: Object.fromEntries(completed.map(id => [id, 70])), rewards: SIM_CHAPTERS.slice(0, chapter).map(c => c.id) },
    pregnancy: { birthPlan: chapter >= FIRST_BABY_CHAPTER ? 'vaginal' : 'undecided', birthStage: chapter >= FIRST_BABY_CHAPTER ? 4 : 0,
      born: chapter >= FIRST_BABY_CHAPTER, appointments: [], feeding: 'combination', support: 50, supportPerson: 'partner', comfort: 'music' },
    memories: Array.isArray(state.memories) ? state.memories.map(memory => ({ ...memory, chapter: mapping[memory.chapter as number] ?? 0 })) : state.memories,
  };
}

export const missionStepIds = new Set(ALL_MISSION_STEPS.map(s => s.id));
export const birthReady = (state: GameState) => state.chapter === BIRTH_CHAPTER && !state.pregnancy.born &&
  currentStep(state)?.action === 'birth' && state.location === 'clinic' && state.pregnancy.birthPlan !== 'undecided';
