import { useEffect, useState } from 'react';
import type az from './az.json';

/**
 * Pregnancy loss support ("Hamiləliyim davam etmir"): the mother's 8-week recovery guide and the
 * partner's support guide. Texts per language in ./<lang>.json, same shape as az.json (checked in tests).
 */
export type PregnancyLossText = typeof az;

export const LOSS_RECOVERY_WEEKS = 8;

const DAY = 86_400_000;
const localDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
const parseDay = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Days since the loss date (0 on the day itself), or null without a valid date. */
export function lossDays(lossDate: string | null | undefined, now = new Date()): number | null {
  if (!lossDate || !/^\d{4}-\d{2}-\d{2}/.test(lossDate)) return null;
  return Math.max(0, Math.round((localDay(now) - localDay(parseDay(lossDate))) / DAY));
}

/** Recovery week 1..8, or null once the eight weeks are over (or without a date). */
export function lossWeek(lossDate: string | null | undefined, now = new Date()): number | null {
  const days = lossDays(lossDate, now);
  if (days === null || days >= LOSS_RECOVERY_WEEKS * 7) return null;
  return Math.floor(days / 7) + 1;
}

/** The partner guide groups the eight weeks into four phases of two weeks. */
export const lossPhase = (week: number) => Math.min(3, Math.max(0, Math.floor((week - 1) / 2)));

const loaders = import.meta.glob<{ default: PregnancyLossText }>('./*.json');

export async function loadPregnancyLossText(language: string): Promise<PregnancyLossText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

export function usePregnancyLossText(language: string): PregnancyLossText | null {
  const [text, setText] = useState<{ language: string; value: PregnancyLossText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPregnancyLossText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}

/** The local emergency number is part of the translated text (112, 119, 120, ...). */
export const emergencyNumber = (text: PregnancyLossText) => (text.ui.signs_urgent.match(/\b\d{3}\b/) || ['112'])[0];
