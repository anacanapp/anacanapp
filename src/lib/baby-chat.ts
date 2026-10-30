/**
 * "Körpəmdən mesajlar" — the unborn baby texts the mother once a day and answers her replies.
 * Everything is curated text (src/data/baby-chat/<lang>.json) filled with the week's facts:
 * no AI, nothing medical, nothing frightening. The thread lives on the device only.
 */
import type az from '@/data/baby-chat/az.json';

export type BabyChatText = typeof az;
export type BabyIntent = keyof BabyChatText['keywords'];
export interface BabyChatMessage { id: string; from: 'baby' | 'mom'; text: string; at: number }
export interface BabyWeekFacts { week: number; fruit?: string | null; cm?: number | null; weeksLeft?: number | null }

/** Order matters: the first matching intent wins. */
export const INTENT_ORDER: BabyIntent[] = ['thanks', 'love', 'name', 'dad', 'kick', 'hear', 'size', 'food', 'sleep', 'meet', 'how', 'hello'];
// Scripts without spaces between words are matched as substrings.
const SUBSTRING_LANGUAGES = new Set(['zh', 'ja', 'ko']);

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const pick = <T,>(items: T[], seed: string): T => items[hash(seed) % items.length];

export const dayKey = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Today's message arrives at a different time each day: 09:00–20:30, stable per user and date. */
export function dailyArrival(date: Date, userId: string): Date {
  const slot = hash(`${userId}:${dayKey(date)}`) % (23 * 30); // 23 half-hours × 30 one-minute steps
  const at = new Date(date);
  at.setHours(9, 0, 0, 0);
  at.setMinutes(Math.floor(slot / 30) * 30 + (slot % 30));
  return at;
}

export function detectIntent(message: string, keywords: BabyChatText['keywords'], language: string): BabyIntent | null {
  const text = message.toLocaleLowerCase(language).normalize('NFC');
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const phrase = ` ${words.join(' ')} `;
  for (const intent of INTENT_ORDER) {
    for (const raw of keywords[intent] || []) {
      const key = raw.toLocaleLowerCase(language);
      if (!/[\p{L}\p{N}]/u.test(key) || SUBSTRING_LANGUAGES.has(language)) {
        if (text.includes(key)) return intent;
      } else if (key.includes(' ') ? phrase.includes(` ${key}`) : words.some((w) => w.startsWith(key))) {
        return intent;
      }
    }
  }
  return null;
}

const fill = (template: string, facts: BabyWeekFacts) => template
  .replace(/\{fruit\}/g, facts.fruit || '')
  .replace(/\{cm\}/g, facts.cm ? String(Math.round(facts.cm * 10) / 10) : '')
  .replace(/\{week\}/g, String(facts.week))
  .replace(/\{weeks_left\}/g, String(facts.weeksLeft ?? ''));

/** Templates whose placeholders cannot be filled for this week are skipped. */
const usable = (templates: string[], facts: BabyWeekFacts) => templates.filter((t) =>
  (!t.includes('{fruit}') || !!facts.fruit) && (!t.includes('{cm}') || (facts.cm ?? 0) >= 1)
  && (!t.includes('{weeks_left}') || (facts.weeksLeft ?? 0) > 1));

/** The baby's answer to the mother's message, matched to its topic and the current week. */
export function babyReply(message: string, text: BabyChatText, facts: BabyWeekFacts, language: string, seed: string): string {
  const intent = detectIntent(message, text.keywords, language);
  const r = text.replies;
  let pool: string[] = r.generic;
  if (intent === 'kick') pool = facts.week < 18 ? r.kick_early : r.kick;
  else if (intent === 'hear') pool = facts.week < 18 ? r.hear_early : r.hear;
  else if (intent === 'meet') pool = (facts.weeksLeft ?? 99) <= 2 ? r.meet_soon : r.meet;
  else if (intent) pool = r[intent];
  const options = usable(pool, facts);
  return fill(pick(options.length ? options : usable(r.generic, facts), `${seed}:${message}`), facts);
}

/** The day's thread from the baby: an opener and the day's content message. */
export function dailyBabyMessages(text: BabyChatText, dailyMessage: string, date: Date, userId: string): BabyChatMessage[] {
  const at = dailyArrival(date, userId).getTime();
  const day = dayKey(date);
  return [
    { id: `${day}-open`, from: 'baby', text: pick(text.openers, `${userId}:${day}:open`), at },
    { id: `${day}-daily`, from: 'baby', text: dailyMessage, at: at + 1000 },
  ];
}

// ── Device storage: the last 14 days of threads, per user ──────────────────────
type Store = Record<string, BabyChatMessage[]>;
const storeKey = (userId: string) => `anacan_baby_chat_v1:${userId}`;

export function loadThreads(userId: string): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveThread(userId: string, day: string, messages: BabyChatMessage[]) {
  try {
    const all = { ...loadThreads(userId), [day]: messages.slice(-60) };
    const kept = Object.keys(all).sort().slice(-14);
    localStorage.setItem(storeKey(userId), JSON.stringify(Object.fromEntries(kept.map((k) => [k, all[k]]))));
  } catch { /* storage full or blocked: the thread stays in memory */ }
}
