import type { Plugin } from 'vite';
export function jsxTextValue(raw: string): string;
export function analyzeInlineCopy(code: string, file: string): {
  messages: Record<string, string>;
  replacements: { start: number; end: number; value: string }[];
};
export function transformInlineCopy(code: string, file: string): {
  code: string; map: unknown; messages: Record<string, string>;
} | null;
export function inlineLocalizationPlugin(): Plugin;
