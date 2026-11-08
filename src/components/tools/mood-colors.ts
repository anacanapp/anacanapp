import type { CSSProperties } from 'react';

/**
 * Theme-aware mood colours. The selected mood used Tailwind pastels (`bg-red-100 border-red-300`, also stored in
 * mood_options.color_class) that stay light in dark mode. Moods now use the design tokens, which have their own
 * `.dark` values in anacan-design.css. The 1-5 scale decides the colour; the database class is only read for
 * values outside that scale.
 */
export type MoodTone = 'pink' | 'coral' | 'yellow' | 'blue' | 'green' | 'lav' | 'neutral';

const TONE_STYLE: Record<MoodTone, { background: string; borderColor: string }> = {
  pink: { background: 'var(--a-pink-1)', borderColor: 'var(--a-pink-2)' },
  coral: { background: 'var(--a-coral-soft)', borderColor: 'var(--a-peach-2)' },
  yellow: { background: 'var(--a-yellow-1)', borderColor: 'var(--a-yellow-2)' },
  blue: { background: 'var(--a-blue-1)', borderColor: 'var(--a-blue-2)' },
  green: { background: 'var(--a-green-1)', borderColor: 'var(--a-green-2)' },
  lav: { background: 'var(--a-lav-1)', borderColor: 'var(--a-lav-2)' },
  neutral: { background: 'var(--a-surface-soft)', borderColor: 'var(--a-line-strong)' },
};

const BY_VALUE: Record<number, MoodTone> = { 1: 'pink', 2: 'coral', 3: 'yellow', 4: 'blue', 5: 'green' };

const BY_HUE: [RegExp, MoodTone][] = [
  [/\b(?:bg|border)-(?:red|rose|pink|fuchsia)-/, 'pink'],
  [/\b(?:bg|border)-(?:orange|amber)-/, 'coral'],
  [/\b(?:bg|border)-yellow-/, 'yellow'],
  [/\b(?:bg|border)-(?:lime|green|emerald|teal)-/, 'green'],
  [/\b(?:bg|border)-(?:sky|blue|cyan|indigo)-/, 'blue'],
  [/\b(?:bg|border)-(?:violet|purple)-/, 'lav'],
];

export function moodTone(value: number, colorClass?: string | null): MoodTone {
  if (BY_VALUE[value]) return BY_VALUE[value];
  const cls = colorClass ?? '';
  return BY_HUE.find(([pattern]) => pattern.test(cls))?.[1] ?? 'neutral';
}

/** Inline style for a selected mood button (background + border colour). */
export const moodToneStyle = (tone: MoodTone): CSSProperties => ({ ...TONE_STYLE[tone] });
