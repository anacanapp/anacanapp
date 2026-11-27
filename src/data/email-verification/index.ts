import { useEffect, useState } from 'react';
import type az from './az.json';

/** E-mail verification code screen + e-mail texts, one file per app language (same shape as az.json). */
export type EmailVerificationText = typeof az;

const loaders = import.meta.glob<{ default: EmailVerificationText }>('./*.json');

export async function loadEmailVerificationText(language: string): Promise<EmailVerificationText> {
  const load = loaders[`./${language}.json`] ?? loaders['./en.json'] ?? loaders['./az.json'];
  return (await load()).default;
}

export function useEmailVerificationText(language: string): EmailVerificationText | null {
  const [text, setText] = useState<{ language: string; value: EmailVerificationText } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadEmailVerificationText(language).then((value) => { if (alive) setText({ language, value }); });
    return () => { alive = false; };
  }, [language]);
  return text?.language === language ? text.value : null;
}
