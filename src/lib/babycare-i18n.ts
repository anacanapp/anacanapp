import { copyText, type CopyFile } from './ui-copy';
import { readAppLanguage } from './app-languages';

export type BabycareKey = keyof CopyFile['babycare'];

/** Copy for this area in all 21 languages (see ui-copy.ts); English is the safety net. */
export function bc(key: BabycareKey, vars?: Record<string, string | number>, language: string = readAppLanguage()): string {
  return copyText('babycare', key, language, vars);
}

/** Localized "h" / "min" abbreviations for duration labels. */
export const durationUnits = () => ({ hour: bc('babytracker_hour_short'), minute: bc('babytracker_minute_short') });
