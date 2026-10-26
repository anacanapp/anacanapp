import vocabulary from './community-language-vocabulary.json';

export function languageText(text: string): string {
  return (text || '').normalize('NFC').replace(/https?:\/\/\S+/gi, ' ').replace(/[@#]\S+/g, ' ');
}

/** Shared Turkic words are not evidence for moving an Azerbaijani post to TR. */
export function turkicLanguageEvidence(text: string) {
  const clean = languageText(text);
  const folded = clean.toLowerCase().replace(/i\u0307/g, 'i').replace(/[əğıöüşç]/g, letter => ({ ə: 'e', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c' })[letter]!);
  const words = new Set(folded.split(/[^\p{L}]+/u).filter(Boolean));
  const hits = (language: keyof typeof vocabulary) => vocabulary[language].filter(word => words.has(word)).length;
  return { az: hits('az'), tr: hits('tr'), uz: hits('uz'), azGlyph: /[Əə]/.test(clean), salutation: words.has('salam') };
}

export function cyrillicLanguageEvidence(text: string) {
  const words = new Set(languageText(text).toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const hits = (language: keyof typeof vocabulary) => vocabulary[language].filter(word => words.has(word)).length;
  return { kk: hits('kkCyrillic'), uz: hits('uzCyrillic'), ru: hits('ru') };
}

/** Conservative correction for old composers whose inferred labels are unmarked.
 * Explicit choices from the current composer bypass this through the v2 RPC.
 * Other scripts/labels and genuine Turkish evidence remain untouched.
 */
export function legacyPostLanguage(text: string, submitted: string, preferred: string | null): string {
  const clean = languageText(text);
  if (['ru', 'kk'].includes(submitted)) {
    const evidence = cyrillicLanguageEvidence(clean);
    if (preferred === 'kk' && submitted === 'ru' && evidence.kk >= 2 && evidence.kk > evidence.ru && evidence.kk > evidence.uz) return 'kk';
    if (preferred === 'uz' && evidence.uz >= 2 && evidence.uz > evidence.ru && evidence.uz > evidence.kk) return 'uz';
    return submitted;
  }
  if (!['az', 'tr', 'en'].includes(submitted)) return submitted;
  if (/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(clean)) return submitted;
  const evidence = turkicLanguageEvidence(clean);
  if (preferred === 'az' && submitted !== 'az' && evidence.az > evidence.tr && evidence.az > evidence.uz
    && (evidence.az >= 2 || evidence.azGlyph || evidence.salutation)) return 'az';
  if (preferred === 'uz' && submitted !== 'uz' && evidence.uz >= 2 && evidence.uz > evidence.az && evidence.uz > evidence.tr) return 'uz';
  return submitted;
}
