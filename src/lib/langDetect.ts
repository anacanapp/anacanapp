// ============================================================
// langDetect — cəmiyyət postları üçün yüngül dil aşkarlama (az/en/ru/tr/kk/uz/ka/de).
// Prinsip:
//   1. Kiril mətnində özbək-spesifik hərflər (ў/ҳ) varsa → uz;
//      qazax-spesifik hərflər (ә/ғ/қ/ң/ө/ұ/ү/һ/і) varsa → kk
//   2. Qalan kiril üstünlüyü → ru
//   3. "ə" hərfi varsa → az ("ə" az dilinin ən çox işlənən hərfidir; tr/en/ru-da yoxdur)
//   4. Alman-spesifik: ß varsa → de; ä varsa (ə-siz mətndə) → de
//   5. ASCII az/uz sözlərini ortaq türk sözlərindən əvvəl yoxla; sonra ğ/ş/ı:
//        q/x da varsa → az; ayrıca TR sübutu yoxdursa AZ fallback-i saxla
//        (ö/ü tək başına türk sayılmır — almanda da var; stop-söz sayğacı həll edir)
//   6. Stop-söz sayğacı → qalan latın mətnlər; ortaq bir/bu/var dili dəyişmir
//   7. Qısa/qeyri-müəyyən mətn → fallback (UI dili)
// Qeyd: bu YALNIZ ilkin təxmindir — istifadəçi compose-da dil çipi ilə düzəldə bilər.
// ============================================================

import { NEW_LANGUAGE_CODES, type AppLanguageCode } from './app-languages';
import { cyrillicLanguageEvidence, languageText, turkicLanguageEvidence } from './community-language-evidence';
export type FeedLang = AppLanguageCode;

/** Feed linzasında göstərilən sıra ilə bütün dəstəklənən dillər */
export const FEED_LANGS: FeedLang[] = ['az', 'ru', 'tr', 'kk', 'uz', 'ka', 'de', 'ar', 'en', ...NEW_LANGUAGE_CODES];

export function isFeedLang(v: unknown): v is FeedLang {
  return typeof v === 'string' && (FEED_LANGS as string[]).includes(v);
}

/** Massivi təmizlə: yalnız dəstəklənən dillər, dublikatsız; boşdursa fallback */
export function sanitizeFeedLangs(input: unknown, fallback: FeedLang[]): FeedLang[] {
  const arr = Array.isArray(input) ? input.filter(isFeedLang) : [];
  const uniq = [...new Set(arr)];
  return uniq.length > 0 ? uniq : fallback;
}

// Diakritikasız da yazıla bilən stop-sözlər (tr klaviaturasız yazanlar üçün)
const TR_STOPWORDS = new Set([
  've', 'bir', 'bu', 'su', 'icin', 'için', 'cok', 'çok', 'ama', 'fakat', 'gibi', 'daha',
  'mi', 'mı', 'mu', 'mü', 'ne', 'evet', 'hayır', 'hayir', 'ben', 'sen', 'biz', 'siz',
  'degil', 'değil', 'var', 'yok', 'ile', 'olarak', 'bebek', 'bebeğim', 'hamile', 'anne',
]);
const EN_STOPWORDS = new Set([
  'the', 'and', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'my', 'your', 'for',
  'with', 'have', 'has', 'it', 'this', 'that', 'baby', 'you', 'i', 'am', 'be', 'not',
  'so', 'but', 'we', 'she', 'he', 'her', 'his', 'do', 'does', 'what', 'how',
]);
const DE_STOPWORDS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'ich', 'du', 'wir', 'ihr',
  'mein', 'meine', 'dein', 'mit', 'für', 'fur', 'auf', 'aus', 'bei', 'nach', 'wenn',
  'aber', 'auch', 'schon', 'noch', 'sehr', 'kann', 'hat', 'haben', 'sind', 'wird',
  'schlafen', 'schläft', 'monate', 'wochen', 'stillen', 'schwanger', 'mütter', 'mutter',
]);
const EXPANDED_STOPWORDS: Partial<Record<FeedLang, Set<string>>> = {
  id: new Set(['dan', 'yang', 'saya', 'anda', 'bayi', 'anak', 'ibu', 'hamil', 'tidak', 'dengan', 'untuk', 'ini', 'apakah', 'bagaimana', 'sudah', 'belum', 'menyusui']),
  fr: new Set(['le', 'la', 'les', 'des', 'une', 'un', 'et', 'est', 'je', 'vous', 'mon', 'ma', 'bébé', 'grossesse', 'enceinte', 'avec', 'pour', 'pas', 'votre', 'comment']),
  es: new Set(['el', 'la', 'los', 'las', 'una', 'uno', 'es', 'y', 'mi', 'bebé', 'embarazo', 'embarazada', 'con', 'para', 'que', 'cómo', 'tengo', 'estoy', 'hola']),
  pt: new Set(['o', 'a', 'os', 'as', 'uma', 'um', 'é', 'e', 'não', 'meu', 'minha', 'bebé', 'bebê', 'gravidez', 'grávida', 'com', 'para', 'que', 'como', 'estou', 'olá']),
  vi: new Set(['tôi', 'của', 'bé', 'mẹ', 'và', 'trẻ', 'không', 'thai', 'cho', 'hôm', 'nay', 'con', 'ngủ', 'đang', 'mình', 'bạn']),
  pl: new Set(['jest', 'jestem', 'moje', 'mój', 'moja', 'dziecko', 'ciąża', 'ciąży', 'nie', 'jak', 'się', 'dla', 'mam', 'bardzo', 'dzisiaj', 'dobrze']),
  nl: new Set(['de', 'het', 'een', 'en', 'ik', 'mijn', 'je', 'jij', 'wij', 'zwanger', 'baby', 'borstvoeding', 'vandaag', 'goed', 'hoe', 'voor', 'met', 'niet', 'dat', 'heb']),
  sv: new Set(['och', 'att', 'är', 'jag', 'min', 'mitt', 'barn', 'bebis', 'gravid', 'för', 'inte', 'det', 'du', 'vi', 'med', 'har', 'som', 'vad', 'hur', 'bra']),
};

export function detectLang(text: string, fallback: FeedLang = 'az'): FeedLang {
  // URL, @mention və #hashtag-ları aşkarlamadan çıxar (onlar dil daşımır)
  const t = languageText(text);

  // 0) Ərəb qrafikası — ən etibarlı marker (başqa heç bir dəstəklənən dildə yoxdur)
  const arb = (t.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  // Gürcü (Mkhedruli) qrafikası — ərəb kimi unikal markerdir
  const geo = (t.match(/[\u10D0-\u10FF]/g) || []).length;
  const cyr = (t.match(/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІіЎўҲҳ]/g) || []).length;
  const han = (t.match(/\p{Script=Han}/gu) || []).length;
  const kana = (t.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
  const hangul = (t.match(/\p{Script=Hangul}/gu) || []).length;
  const devanagari = (t.match(/\p{Script=Devanagari}/gu) || []).length;
  const lat = (t.match(/[A-Za-zÀ-ÖØ-öø-ÿƏəĞğIıİŞşŒœ]/g) || []).length;
  const totalLetters = arb + geo + cyr + lat + han + kana + hangul + devanagari;
  if (kana >= 1 && kana + han >= 3 && kana + han > totalLetters * 0.3) return 'ja';
  if (hangul >= 2 && hangul > totalLetters * 0.3) return 'ko';
  if (devanagari >= 2 && devanagari > totalLetters * 0.3) return 'hi';
  if (han >= 2 && han > totalLetters * 0.3) return fallback === 'ja' ? 'ja' : 'zh';

  // Çox qısa mətn (emoji, "ok" və s.) — təxmin etmə, UI dilini götür
  if (totalLetters < 6) return fallback;

  if (arb > totalLetters * 0.3) return 'ar';

  // 0a) Gürcü qrafikası — kiril yoxlamalarından ƏVVƏL (qarışıq ka+ru mətnlərində ka üstün gəlir)
  if (geo > totalLetters * 0.3) return 'ka';

  // 1) Kiril üstünlüyü → uz (özbək-spesifik hərf varsa), kk (qazax-spesifik hərf varsa) və ya ru
  if (cyr > totalLetters * 0.4) {
    // ў ҳ — rus/qazax əlifbasında yoxdur, özbək kiril mətninin etibarlı göstəricisidir
    if (/[ЎўҲҳ]/.test(t)) return 'uz';
    const evidence = cyrillicLanguageEvidence(t);
    if (evidence.uz >= 2 && evidence.uz > evidence.kk && evidence.uz > evidence.ru) return 'uz';
    if (evidence.kk >= 2 && evidence.kk > evidence.uz && evidence.kk > evidence.ru) return 'kk';
    // ә ғ қ ң ө ұ ү һ і — rus əlifbasında yoxdur, qazax mətninin etibarlı göstəricisidir
    return /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(t) ? 'kk' : 'ru';
  }

  // 2) "ə" → az (praktikada hər az cümləsində var: və, mən, gələcək...)
  if (/[Əə]/.test(t)) return 'az';

  // 2a) Özbək latın markeri: oʻ/gʻ digrafları (apostrof variantları ilə) —
  //     az/tr/en/de-də bu ardıcıllıq işlənmir; yalnız ilkin təxmindir, çiplə düzəldilə bilər
  if (/[OoGg][ʻʼ'’‘`]/.test(t)) return 'uz';

  // 3) Alman-spesifik: ß yalnız almandadır; ä (ə-siz mətndə) az/tr-də yoxdur
  if (/[ĐđĂăƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉĨĩỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỶỷỸỹỴỵ]/.test(t)) return 'vi';
  if (/[ŁłĄąĘęŚśĆćŹźŻżŃń]/.test(t)) return 'pl';
  if (/[Åå]/.test(t)) return 'sv';
  if (/[ß]/.test(t)) return 'de';
  if (/[Ññ¿¡]/.test(t)) return 'es';
  if (/[ÃãÕõ]/.test(t)) return 'pt';

  const evidence = turkicLanguageEvidence(t);
  // ASCII Azerbaijani/Uzbek must be considered before shared Turkish letters
  // and stopwords. "bir", "bu", "var" alone cannot identify Turkish.
  if (evidence.az >= 2 && evidence.az > evidence.tr && evidence.az > evidence.uz) return 'az';
  if (evidence.uz >= 2 && evidence.uz > evidence.tr && evidence.uz > evidence.az) return 'uz';

  // 4) Türk-spesifik hərflər ("ə"-siz). DİQQƏT: adi böyük "I" ingilis dilində də var —
  //    yalnız nöqtəsiz "ı" və nöqtəli böyük "İ" türk-spesifikdir.
  //    ö/ü almanda da olduğu üçün tək başına türk sayılmır — ğ/ş/ı/ç/İ tələb olunur.
  // Ç is also French/Portuguese; it is no longer a uniquely Turkic marker.
  const hasStrongTurkic = /[ĞğıİŞş]/.test(t);
  const hasQX = /[QqXx]/.test(t.replace(/[^A-Za-z]/g, ''));
  if (hasStrongTurkic) {
    // q/x türk əlifbasında yoxdur → az yazısıdır (ə-siz qısa az mətni)
    return hasQX || fallback === 'az' && evidence.tr === 0 ? 'az' : 'tr';
  }

  // 5) Saf latın mətn — stop-söz sayğacı (de vs tr vs en)
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  let trHits = 0;
  let enHits = 0;
  let deHits = 0;
  for (const w of words) {
    if (TR_STOPWORDS.has(w)) trHits++;
    if (EN_STOPWORDS.has(w)) enHits++;
    if (DE_STOPWORDS.has(w)) deHits++;
  }
  const expandedScores = Object.entries(EXPANDED_STOPWORDS).map(([language, dictionary]) => ({ language: language as FeedLang, score: words.filter(word => dictionary!.has(word)).length }));
  const bestExpanded = Math.max(...expandedScores.map(item => item.score));
  if (bestExpanded >= 2 && bestExpanded > Math.max(enHits, trHits, deHits)) {
    const best = expandedScores.filter(item => item.score === bestExpanded);
    return best.find(item => item.language === fallback)?.language ?? (best.length === 1 ? best[0].language : fallback);
  }
  if (deHits > enHits && deHits > trHits && deHits >= 2) return 'de';
  if (enHits > trHits && enHits >= 2) return 'en';
  if (trHits > enHits && trHits >= 2 && (evidence.tr > 0 || fallback === 'tr')) return 'tr';
  if (/[Ää]/.test(t) && fallback !== 'sv') return 'de';
  // ö/ü var amma stop-söz həll etmədi → türkcəyə meyl (bölgə reallığı)
  if (/[ÖöÜü]/.test(t) && trHits > 0 && (evidence.tr > 0 || fallback === 'tr')) return 'tr';

  // 6) Qeyri-müəyyən → UI dili
  return fallback;
}
