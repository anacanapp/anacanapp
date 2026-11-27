import { useEffect, useState } from 'react';
import type az from './az.json';

/** Health integration screen texts, one file per app language (same shape as az.json). */
export type HealthSyncText = typeof az;

const loaders = import.meta.glob<{ default: HealthSyncText }>('./*.json');

export async function loadHealthSyncText(language: string): Promise<HealthSyncText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

export function useHealthSyncText(language: string): HealthSyncText | null {
  const [text, setText] = useState<{ language: string; value: HealthSyncText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHealthSyncText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}

/** Fill {name} placeholders. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
