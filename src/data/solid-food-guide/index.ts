import { useEffect, useState } from 'react';
import type az from './az.json';

/** Texts of the solid food guide; every language file has this exact shape (checked in tests). */
export type SolidFoodGuideText = typeof az;

const loaders = import.meta.glob<{ default: SolidFoodGuideText }>('./*.json');

export async function loadSolidFoodGuideText(language: string): Promise<SolidFoodGuideText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

/** Loads the guide text for the app language (English if a file is missing). */
export function useSolidFoodGuideText(language: string): SolidFoodGuideText | null {
  const [text, setText] = useState<{ language: string; value: SolidFoodGuideText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadSolidFoodGuideText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}

export const fill = (template: string, n: number | string) => template.replace('{n}', String(n));
