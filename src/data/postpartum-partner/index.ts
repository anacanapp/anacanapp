import { useEffect, useState } from 'react';
import type az from './az.json';

/**
 * "İlk 8 həftə" — postpartum support for the partner. Texts per language in ./<lang>.json,
 * every file has the same shape as az.json (checked in tests).
 */
export type PostpartumPartnerText = typeof az;

export const POSTPARTUM_WEEKS = 8;
/** Week 1..8 from the baby's age in days; null once the programme is over. */
export const postpartumWeek = (babyAgeDays: number): number | null =>
  babyAgeDays >= 0 && babyAgeDays < POSTPARTUM_WEEKS * 7 ? Math.floor(babyAgeDays / 7) + 1 : null;

const loaders = import.meta.glob<{ default: PostpartumPartnerText }>('./*.json');

export async function loadPostpartumPartnerText(language: string): Promise<PostpartumPartnerText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

export function usePostpartumPartnerText(language: string): PostpartumPartnerText | null {
  const [text, setText] = useState<{ language: string; value: PostpartumPartnerText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPostpartumPartnerText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}
