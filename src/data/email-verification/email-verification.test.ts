import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMAIL_VERIFICATION_COPY } from '../../../supabase/functions/_shared/email-verification-copy';

const dir = __dirname;
const languages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'));

describe('e-mail verification copy', () => {
  it('exists in all 21 languages with the same keys and placeholders', () => {
    expect(languages).toHaveLength(21);
    const az = read('az');
    for (const lang of languages) {
      const t = read(lang);
      for (const part of ['ui', 'email'] as const) {
        expect(Object.keys(t[part]).sort(), `${lang}.${part}`).toEqual(Object.keys(az[part]).sort());
        for (const [key, value] of Object.entries(az[part]) as [string, string][]) {
          expect(((t[part][key] as string).match(/\{\w+\}/g) || []).sort(), `${lang}.${part}.${key}`).toEqual((value.match(/\{\w+\}/g) || []).sort());
        }
      }
      expect(t.email.subject, lang).toContain('{code}');
    }
  });

  it('matches the copy built into the server function', () => {
    for (const lang of languages) expect(EMAIL_VERIFICATION_COPY[lang], lang).toEqual(read(lang).email);
  });
});
