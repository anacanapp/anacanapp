import { useEffect, useState } from 'react';

/**
 * Per-feature copy, one JSON file per app language with the same shape as az.json.
 * Falls back to English, then Azerbaijani.
 */
export function createFeatureText<T>(loaders: Record<string, () => Promise<{ default: T }>>) {
  const load = async (language: string): Promise<T> => {
    const loader = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
    return (await loader()).default;
  };
  const useText = (language: string): T | null => {
    const [text, setText] = useState<{ language: string; value: T } | null>(null);
    useEffect(() => {
      let alive = true;
      void load(language).then((value) => { if (alive) setText({ language, value }); });
      return () => { alive = false; };
    }, [language]);
    return text?.language === language ? text.value : null;
  };
  return { load, useText };
}

/** Fill {name} placeholders. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
