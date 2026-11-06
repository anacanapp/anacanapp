/** Demo / test personas for Anacan Recap (made-up people, not real accounts). */
import { parseRecap, type RecapData } from './types';

const base = {
  available: true, preview: true, year: 2026, member_since: '2025-03-02T10:00:00Z', first_open_this_year: '2026-01-01T08:12:00Z',
  is_premium: false, posts: 0, comments: 0, game_plays: 0, achievements: 0, mommy: null, bump: null, flow: null,
};

export const RECAP_PERSONAS: Record<'mommy' | 'bump' | 'flow' | 'light', RecapData> = {
  mommy: parseRecap({
    ...base, name: 'Aynur', stage: 'mommy', stages: ['bump', 'mommy'], days_active: 312, longest_streak: 47, favorite_hour: 3,
    top_tools: [{ id: 'baby-tracker', count: 410 }, { id: 'sleep-training', count: 38 }, { id: 'white-noise', count: 25 }],
    ai_questions: 64, posts_read: 286, likes: 120, comments: 18, posts: 3, game_plays: 12, achievements: 9, is_premium: true,
    mommy: {
      child_name: 'Leyla', child_birth_date: '2026-02-14', born_this_year: true, feedings: 1505, night_feedings: 412, sleeps: 980,
      sleep_hours: 1576, longest_sleep_hours: 6.5, diapers: 1820, milestones: 10,
      milestone_ids: ['first_smile', 'head_up', 'rolling', 'first_laugh', 'sitting', 'crawling', 'first_word', 'standing', 'first_tooth', 'first_steps'],
      growth_entries: 11, weight_start_kg: 3.2, weight_end_kg: 9.4, photos: 214, feedings_top_pct: 5,
    },
    bump: { due_date: '2026-02-16', week_start: 34, week_end: 40, kick_sessions: 31, kicks: 640, max_kicks_session: 38, kicks_top_pct: 12, bag_items_ready: 24, favorite_names: 6 },
  }) as RecapData,
  bump: parseRecap({
    ...base, name: 'Nigar', stage: 'bump', stages: ['flow', 'bump'], days_active: 186, longest_streak: 21, favorite_hour: 22,
    top_tools: [{ id: 'kick-counter', count: 96 }, { id: 'pregnancy-calendar', count: 70 }, { id: 'baby-names', count: 41 }],
    ai_questions: 23, posts_read: 140, likes: 35, comments: 4,
    bump: { due_date: '2027-01-20', week_start: 6, week_end: 34, kick_sessions: 58, kicks: 1172, max_kicks_session: 42, kicks_top_pct: 8, bag_items_ready: 18, favorite_names: 12 },
  }) as RecapData,
  flow: parseRecap({
    ...base, name: 'Səbinə', stage: 'flow', stages: ['flow'], days_active: 241, longest_streak: 33, favorite_hour: 8,
    top_tools: [{ id: 'cycle-calendar', count: 180 }, { id: 'mood-diary', count: 64 }, { id: 'water-tracker', count: 52 }],
    ai_questions: 31, posts_read: 95, likes: 60, comments: 7,
    flow: { cycles: 11, avg_cycle_length: 28.4, avg_period_length: 5.2, period_days_logged: 57, days_logged: 198, top_symptom: 'bloating', mood_avg: 3.9, water_glasses: 1240, logging_top_pct: 7, goal: 'track' },
  }) as RecapData,
  light: parseRecap({
    ...base, name: null, stage: 'flow', stages: ['flow'], days_active: 9, longest_streak: 2, favorite_hour: 21,
    top_tools: [], ai_questions: 3, posts_read: 6, likes: 0,
    flow: { cycles: 0, avg_cycle_length: null, avg_period_length: null, period_days_logged: 0, days_logged: 0, top_symptom: null, mood_avg: null, water_glasses: 0, logging_top_pct: null, goal: null },
  }) as RecapData,
};

/** Azerbaijani demo labels (the app resolves real ones from tool_configs / baby_milestones_db / symptoms). */
export const RECAP_DEMO_LABELS_AZ = {
  tool: (id: string) => ({
    'baby-tracker': 'Körpə izləyicisi', 'sleep-training': 'Yuxu təlimi', 'white-noise': 'Ağ səs', 'kick-counter': 'Təpik sayğacı',
    'pregnancy-calendar': 'Hamiləlik təqvimi', 'baby-names': 'Körpə adları', 'cycle-calendar': 'Dövr təqvimi', 'mood-diary': 'Əhval gündəliyi', 'water-tracker': 'Su izləyicisi',
  } as Record<string, string>)[id] ?? null,
  milestone: (id: string) => ({
    first_smile: 'İlk təbəssüm', head_up: 'Başını tutdu', rolling: 'Çevrildi', first_laugh: 'İlk gülüş', sitting: 'Oturdu', crawling: 'Emklədi',
    first_word: 'İlk söz', standing: 'Ayağa qalxdı', first_tooth: 'İlk diş', first_steps: 'İlk addım',
  } as Record<string, string>)[id] ?? null,
  symptom: (id: string) => ({ bloating: 'şişkinlik', cramps: 'sancı', headache: 'baş ağrısı' } as Record<string, string>)[id] ?? null,
};
