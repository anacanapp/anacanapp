/**
 * Synchronous registry for the data behind the website tool pages (names, dekret). The SSR renderer
 * registers everything at import (tool-data-server.ts); the browser loads only the chunk a page needs
 * before hydration (tool-data-client.ts), so the main bundle does not carry the data.
 */
import type { MaternityRule } from '../../data/maternityRules';
import { buildNamesIndex, type NameRow, type NamesIndex, type NamesLanguage } from './names';

const names: Partial<Record<NamesLanguage, NamesIndex>> = {};
export function registerNames(language: NamesLanguage, rows: readonly NameRow[]) { names[language] = buildNamesIndex(language, rows); }
export function namesIndex(language: NamesLanguage): NamesIndex | undefined { return names[language]; }

export interface MaternityData { rule: MaternityRule; countryCount: number }
let maternity: MaternityData | undefined;
/** `countryCodes` are the extra regional calculator countries the app offers next to maternityRules. */
export function registerMaternity(rules: readonly MaternityRule[], regionalCodes: readonly string[] = []) {
  const rule = rules.find(item => item.code === 'AZ');
  if (!rule) throw new Error('WEBSITE_MATERNITY_AZ_RULE_REQUIRED');
  maternity = { rule, countryCount: new Set([...rules.map(item => item.code), ...regionalCodes]).size };
}
export function maternityData(): MaternityData | undefined { return maternity; }
