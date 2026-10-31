import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { babyDailyLine, babyReply, dailyArrival, dailyBabyMessages, detectIntent, type BabyChatText } from './baby-chat';

const dir = join(__dirname, '../data/baby-chat');
const languages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as BabyChatText;
const az = read('az');
const allReplies = (t: BabyChatText) => Object.values(t.replies).flat();

describe('baby chat content', () => {
  it('has every reply group, keyword group and UI text in all 21 languages', () => {
    expect(languages).toHaveLength(21);
    for (const lang of languages) {
      const t = read(lang);
      expect(Object.keys(t.ui).sort(), lang).toEqual(Object.keys(az.ui).sort());
      expect(Object.keys(t.replies).sort(), lang).toEqual(Object.keys(az.replies).sort());
      expect(Object.keys(t.keywords).sort(), lang).toEqual(Object.keys(az.keywords).sort());
      for (const [k, v] of Object.entries(t.replies)) expect(v.length, `${lang}.${k}`).toBe(az.replies[k as keyof typeof az.replies].length);
      expect(t.openers.length && t.notifications.length, lang).toBeTruthy();
    }
  });
});

describe('baby replies', () => {
  const facts = { week: 8, fruit: 'Noxud', cm: 1.6, weeksLeft: 32 };

  it('matches the mother\'s topic in Azerbaijani and other scripts', () => {
    expect(detectIntent('Səni çox sevirəm 💛', az.keywords, 'az')).toBe('love');
    expect(detectIntent('Sən hələ noxud boydasan 😂', az.keywords, 'az')).toBe('size');
    expect(detectIntent('Atana salam de', az.keywords, 'az')).toBe('dad');
    expect(detectIntent('Necəsən balaca?', az.keywords, 'az')).not.toBeNull();
    expect(detectIntent('Я тебя люблю', read('ru').keywords, 'ru')).toBe('love');
    expect(detectIntent('大好きだよ', read('ja').keywords, 'ja')).toBe('love');
    expect(detectIntent('qwerty', az.keywords, 'az')).toBeNull();
  });

  it('answers with week facts and never leaves a placeholder', () => {
    const size = babyReply('Nə boydasan?', az, facts, 'az', 's1');
    expect(az.replies.size.map((t) => t.replace('{fruit}', 'Noxud').replace('{cm}', '1.6').replace('{week}', '8'))).toContain(size);
    for (const lang of languages) {
      const t = read(lang);
      for (let i = 0; i < 30; i++) {
        const reply = babyReply(['love', 'kick', 'hello', 'zzz', 'meet', 'size'][i % 6], t, { week: 10 + i, fruit: null, cm: 0.5, weeksLeft: 1 }, lang, `x${i}`);
        expect(reply, lang).not.toMatch(/\{\w+\}/);
        expect(reply.trim().length, lang).toBeGreaterThan(0);
      }
    }
  });

  it('keeps early-pregnancy answers realistic', () => {
    const early = babyReply('təpik atdın?', az, { week: 10 }, 'az', 'a');
    expect(az.replies.kick_early).toContain(early);
    const late = babyReply('təpik atdın?', az, { week: 26 }, 'az', 'a');
    expect(az.replies.kick).toContain(late);
  });

  it('only uses curated lines', () => {
    const reply = babyReply('random words here', az, facts, 'az', 'z');
    expect(allReplies(az).some((t) => t.replace(/\{\w+\}/g, '').length > 0)).toBe(true);
    expect(az.replies.generic).toContain(reply);
  });
});

describe('daily arrival', () => {
  it('is between 09:00 and 20:30, stable for a user and day, and varies across days', () => {
    const times = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const at = dailyArrival(new Date(2026, 9, d, 3), 'user-1');
      expect(at.getHours() * 60 + at.getMinutes()).toBeGreaterThanOrEqual(9 * 60);
      expect(at.getHours() * 60 + at.getMinutes()).toBeLessThanOrEqual(20 * 60 + 30);
      expect(dailyArrival(new Date(2026, 9, d, 22), 'user-1').getTime()).toBe(at.getTime());
      times.add(`${at.getHours()}:${at.getMinutes()}`);
    }
    expect(times.size).toBeGreaterThan(10);
  });

  it('builds the day\'s opener and content message', () => {
    const msgs = dailyBabyMessages(az, 'Bu gün barmaqlarım çıxdı 🖐', new Date(2026, 9, 30), 'u');
    expect(msgs.map((m) => m.from)).toEqual(['baby', 'baby']);
    expect(az.openers).toContain(msgs[0].text);
    expect(msgs[1].text).toBe('Bu gün barmaqlarım çıxdı 🖐');
  });
});

describe('daily baby lines', () => {
  it('are short, complete and in every language', () => {
    for (const lang of languages) {
      const t = read(lang);
      expect(Object.keys(t.weekly).map(Number).sort((a, b) => a - b), lang).toEqual(Array.from({ length: 38 }, (_, i) => i + 4));
      expect(t.daily, lang).toHaveLength(az.daily.length);
      for (const line of [...Object.values(t.weekly), ...t.daily]) expect(line.length, `${lang}: ${line}`).toBeLessThanOrEqual(110);
    }
  });

  it('uses the week line twice a week and the daily pool otherwise, without placeholders', () => {
    expect(babyDailyLine(az, { week: 8, fruit: 'Noxud' }, 56, 'u')).toBe(az.weekly['8']);
    expect(babyDailyLine(az, { week: 8, fruit: 'Noxud' }, 59, 'u')).toBe(az.weekly['8']);
    for (let day = 1; day < 290; day++) {
      const line = babyDailyLine(az, { week: Math.floor(day / 7), fruit: day % 2 ? 'Noxud' : null }, day, 'u');
      expect(line).not.toMatch(/\{\w+\}/);
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe('baby chat safety', () => {
  it('uses the same care lists as the server function', async () => {
    const { CARE_STEMS } = await import('./baby-chat-safety');
    const server = readFileSync(join(__dirname, '../../supabase/functions/baby-chat-reply/index.ts'), 'utf8');
    const block = server.slice(server.indexOf('export const CARE_STEMS'), server.indexOf('};', server.indexOf('export const CARE_STEMS')));
    const serverStems = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(serverStems.sort()).toEqual(Object.values(CARE_STEMS).flat().sort());
  });

  it('spots health and worry topics without false alarms', async () => {
    const { hasCareTopic } = await import('./baby-chat-safety');
    expect(hasCareTopic('Bu gün qarnımda ağrı var', 'az')).toBe(true);
    expect(hasCareTopic('Körpə bu gün tərpənmir', 'az')).toBe(true);
    expect(hasCareTopic('I am so worried about you', 'en')).toBe(true);
    expect(hasCareTopic('У меня кровь', 'ru')).toBe(true);
    expect(hasCareTopic('Səni çox sevirəm 💛', 'az')).toBe(false);
    expect(hasCareTopic('I love the paint colour', 'en')).toBe(false);
    expect(hasCareTopic('Die Sonne scheint', 'de')).toBe(false);
  });
});
