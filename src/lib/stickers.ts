import copy from '../../scripts/i18n/sticker-copy.json';
import { normalizeAppLanguage, readAppLanguage } from './app-languages';

/** The 60 Anacan stickers (bundled under /stickers/NN.webp, mirrored in public storage for older builds). */
export type StickerGroup = 'ritm' | 'tumurcuq' | 'qucaq' | 'trio';
const NAMES = ['qucaq','qucaq','qucaq','ritm','ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','qucaq','qucaq','qucaq','qucaq',
  'ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','qucaq','qucaq','qucaq','trio','ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','qucaq','qucaq','qucaq','qucaq',
  'ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','qucaq','qucaq','qucaq','trio','ritm','ritm','ritm','tumurcuq','tumurcuq','tumurcuq','qucaq','qucaq','qucaq','trio'] as const;
export const STICKERS = NAMES.map((group, index) => ({ id: String(index + 1).padStart(2, '0'), group: group as StickerGroup }));
export const STICKER_GROUPS: StickerGroup[] = ['ritm', 'tumurcuq', 'qucaq', 'trio'];
const IDS = new Set(STICKERS.map(sticker => sticker.id));

export const stickerAsset = (id: string) => `/stickers/${id}.webp`;
/** Storage path used as a comment image, so builds without stickers still show the picture. */
export const STICKER_STORAGE_PATH = (id: string) => `stickers/v1/${id}.webp`;

/** Messages carry the sticker as readable text (older builds show "🧸 Stiker 12"). */
export const stickerMessage = (id: string) => `🧸 Stiker ${Number(id)}`;
export function stickerFromMessage(content: string | null | undefined): string | null {
  const match = /^🧸 Stiker (\d{1,2})$/u.exec((content || '').trim());
  if (!match) return null;
  const id = match[1].padStart(2, '0');
  return IDS.has(id) ? id : null;
}
export function stickerFromImageUrl(url: string | null | undefined): string | null {
  const match = /\/community-media\/stickers\/v1\/(\d{2})\.webp(?:\?.*)?$/.exec(url || '');
  return match && IDS.has(match[1]) ? match[1] : null;
}

type CopyKey = keyof typeof copy.languages.en;
export function stickerText(key: CopyKey, language: string = readAppLanguage()): string {
  return (copy.languages as Record<string, Record<string, string>>)[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key];
}

const RECENT_KEY = 'anacan_recent_stickers_v1';
export function recentStickers(): string[] {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(value) ? value.filter(id => IDS.has(id)).slice(0, 12) : []; } catch { return []; }
}
export function rememberSticker(id: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentStickers().filter(item => item !== id)].slice(0, 12))); } catch { /* storage unavailable */ }
}
