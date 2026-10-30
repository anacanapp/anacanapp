import { useEffect, useState } from 'react';
import type az from './az.json';

/**
 * Partner daily missions by the woman's stage. Texts live per language in ./<lang>.json
 * as { key: [title, description] }; every file has the same keys (checked in tests).
 */
export type PartnerMissionText = typeof az;
export type MissionKey = keyof PartnerMissionText;
export type MissionPool = 'any' | 'flow' | 'bump' | 'bump_late' | 'newborn' | 'mommy';
export type MissionCategory = 'care' | 'support' | 'surprise';
export type MissionDifficulty = 'easy' | 'medium' | 'hard';
export type MissionIcon = 'coffee' | 'heart' | 'home' | 'calendar' | 'droplets' | 'moon' | 'smile' | 'utensils'
  | 'music' | 'stethoscope' | 'baby' | 'cart' | 'car' | 'book' | 'camera' | 'sun' | 'gift' | 'flower' | 'star'
  | 'message' | 'bag' | 'phone' | 'pill' | 'footprints';

export interface PartnerMissionDef {
  key: MissionKey;
  pool: MissionPool;
  category: MissionCategory;
  difficulty: MissionDifficulty;
  points: number;
  icon: MissionIcon;
}

const m = (key: MissionKey, pool: MissionPool, category: MissionCategory, difficulty: MissionDifficulty, icon: MissionIcon): PartnerMissionDef =>
  ({ key, pool, category, difficulty, icon, points: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30 });

export const PARTNER_MISSIONS: PartnerMissionDef[] = [
  m('any_drink', 'any', 'care', 'easy', 'coffee'),
  m('any_dishes', 'any', 'care', 'easy', 'home'),
  m('any_compliment', 'any', 'surprise', 'easy', 'smile'),
  m('any_listen', 'any', 'support', 'easy', 'message'),
  m('any_walk', 'any', 'care', 'easy', 'footprints'),
  m('any_love_note', 'any', 'surprise', 'easy', 'heart'),
  m('any_cook', 'any', 'care', 'medium', 'utensils'),
  m('any_errand', 'any', 'support', 'medium', 'cart'),
  m('any_flowers', 'any', 'surprise', 'medium', 'flower'),

  m('flow_heat', 'flow', 'care', 'easy', 'droplets'),
  m('flow_supplies', 'flow', 'support', 'easy', 'cart'),
  m('flow_iron_meal', 'flow', 'care', 'medium', 'utensils'),
  m('flow_patience', 'flow', 'support', 'medium', 'heart'),
  m('flow_rest', 'flow', 'care', 'medium', 'moon'),
  m('flow_massage', 'flow', 'care', 'medium', 'heart'),
  m('flow_movie', 'flow', 'surprise', 'easy', 'star'),
  m('flow_active', 'flow', 'surprise', 'medium', 'sun'),

  m('bump_vitamins', 'bump', 'support', 'easy', 'pill'),
  m('bump_water', 'bump', 'care', 'easy', 'droplets'),
  m('bump_feet', 'bump', 'care', 'medium', 'heart'),
  m('bump_talk_baby', 'bump', 'support', 'easy', 'baby'),
  m('bump_appointment', 'bump', 'support', 'hard', 'stethoscope'),
  m('bump_read', 'bump', 'support', 'easy', 'book'),
  m('bump_heavy', 'bump', 'care', 'medium', 'home'),
  m('bump_photo', 'bump', 'surprise', 'easy', 'camera'),
  m('bump_snack', 'bump', 'care', 'easy', 'utensils'),
  m('bump_pillows', 'bump', 'care', 'easy', 'moon'),

  m('late_bag', 'bump_late', 'support', 'medium', 'bag'),
  m('late_route', 'bump_late', 'support', 'medium', 'car'),
  m('late_fuel', 'bump_late', 'support', 'easy', 'car'),
  m('late_car_seat', 'bump_late', 'support', 'hard', 'baby'),
  m('late_contractions', 'bump_late', 'support', 'easy', 'stethoscope'),
  m('late_phone', 'bump_late', 'support', 'easy', 'phone'),
  m('late_birth_plan', 'bump_late', 'support', 'medium', 'book'),

  m('nb_night_feed', 'newborn', 'care', 'hard', 'moon'),
  m('nb_diapers', 'newborn', 'care', 'medium', 'baby'),
  m('nb_bath', 'newborn', 'care', 'medium', 'droplets'),
  m('nb_skin', 'newborn', 'support', 'easy', 'heart'),
  m('nb_visitors', 'newborn', 'support', 'medium', 'home'),
  m('nb_meal', 'newborn', 'care', 'easy', 'utensils'),
  m('nb_feelings', 'newborn', 'support', 'easy', 'message'),
  m('nb_nap', 'newborn', 'care', 'medium', 'moon'),

  m('mm_play', 'mommy', 'support', 'easy', 'smile'),
  m('mm_bedtime', 'mommy', 'care', 'medium', 'moon'),
  m('mm_stroll', 'mommy', 'care', 'easy', 'footprints'),
  m('mm_baby_food', 'mommy', 'care', 'medium', 'utensils'),
  m('mm_me_time', 'mommy', 'surprise', 'medium', 'sun'),
  m('mm_photo', 'mommy', 'surprise', 'easy', 'camera'),
  m('mm_read', 'mommy', 'support', 'easy', 'book'),
  m('mm_date', 'mommy', 'surprise', 'hard', 'star'),
];

export interface MissionStageInput {
  lifeStage?: string | null;
  pregnancyWeek?: number;
  babyAgeDays?: number;
}

/** Pools that fit the woman's stage, most specific first. */
export function missionPoolsFor({ lifeStage, pregnancyWeek = 0, babyAgeDays = 0 }: MissionStageInput): MissionPool[] {
  if (lifeStage === 'flow') return ['flow'];
  if (lifeStage === 'mommy') return babyAgeDays < 90 ? ['newborn', 'mommy'] : ['mommy'];
  if (lifeStage === 'bump') return pregnancyWeek >= 32 ? ['bump_late', 'bump'] : ['bump'];
  return [];
}

const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const shuffle = <T,>(items: T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const missionDaySeed = (date = new Date()) => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

/**
 * Seven missions for the day: four from the stage (late pregnancy first when it applies)
 * and the rest from the general pool. Same day + same stage gives the same list.
 */
export function pickDailyMissions(input: MissionStageInput, date = new Date(), count = 7): PartnerMissionDef[] {
  const seed = missionDaySeed(date);
  const random = seededRandom(seed);
  const pools = missionPoolsFor(input);
  const staged = pools.flatMap((pool) => shuffle(PARTNER_MISSIONS.filter((x) => x.pool === pool), random));
  const general = shuffle(PARTNER_MISSIONS.filter((x) => x.pool === 'any'), random);
  const fromStage = staged.slice(0, pools.length ? 4 : 0);
  return [...fromStage, ...general].slice(0, count);
}

/** Stored mission id: date + key, so a completion belongs to exactly one day's mission. */
export const dailyMissionId = (key: MissionKey, date = new Date()) => `daily-${missionDaySeed(date)}-${key}`;

const loaders = import.meta.glob<{ default: PartnerMissionText }>('./*.json');

export async function loadPartnerMissionText(language: string): Promise<PartnerMissionText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

export function usePartnerMissionText(language: string): PartnerMissionText | null {
  const [text, setText] = useState<{ language: string; value: PartnerMissionText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPartnerMissionText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}
