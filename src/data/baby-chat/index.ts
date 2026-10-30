import { useEffect, useState } from 'react';
import type { BabyChatText } from '@/lib/baby-chat';

const loaders = import.meta.glob<{ default: BabyChatText }>('./*.json');

export async function loadBabyChatText(language: string): Promise<BabyChatText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

/** Texts of "Körpəmdən mesajlar" for the app language (English if a file is missing). */
export function useBabyChatText(language: string): BabyChatText | null {
  const [text, setText] = useState<{ language: string; value: BabyChatText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadBabyChatText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}
