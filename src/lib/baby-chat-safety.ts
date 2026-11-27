/**
 * Health or worry in the mother's message: the baby answers with a curated loving line and the
 * chat shows a gentle "talk to your doctor" card. Same lists as the server function
 * supabase/functions/baby-chat-reply/index.ts (a test keeps them identical); other languages
 * rely on the server model's topic label.
 */
export const CARE_STEMS: Record<string, string[]> = {
  az: ['qanaxma', 'qan gəl', 'ağrı', 'ağrıy', 'ağrıs', 'sancı', 'düşük', 'qızdırma', 'həkim', 'xəstəxana', 'dərman', 'ölüm', 'öldü', 'intihar',
    'özümə zərər', 'tərpənmir', 'hərəkət etmir', 'qorxuram', 'narahatam', 'qusma', 'ödem', 'təzyiq'],
  en: ['bleed', 'blood', 'pain', 'pains', 'painful', 'hurt', 'hurts', 'hurting', 'cramp', 'cramps', 'contraction', 'miscarr', 'fever', 'doctor', 'hospital', 'medic', 'pill', 'pills',
    'died', 'dying', 'death', 'dead', 'suicid', 'kill myself', 'not moving', 'worried', 'scared', 'anxious', 'vomit', 'blood pressure'],
  ru: ['кровь', 'крови', 'кровот', 'боль', 'боли', 'болью', 'болит', 'схватк', 'выкидыш', 'температур', 'врач', 'врача', 'врачу', 'больниц', 'лекарств', 'умер', 'смерт', 'суицид',
    'не шевел', 'боюсь', 'тревог', 'рвота', 'рвоты', 'давлени'],
  tr: ['kanama', 'kan geldi', 'ağrı', 'sancı', 'düşük', 'ateş', 'ateşi', 'doktor', 'hastane', 'ilaç', 'ilacı', 'ölüm', 'öldü', 'intihar',
    'kıpırdamıyor', 'hareket etmiyor', 'korkuyorum', 'endişe', 'kusma', 'tansiyon'],
};

/** Phrases match anywhere; stems of 5+ letters at the start of a word, shorter ones as the whole word. */
export function hasCareTopic(message: string, language: string): boolean {
  const locale = language === 'tr' || language === 'az' ? 'tr' : language;
  const text = message.toLocaleLowerCase(locale);
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return (CARE_STEMS[language] || []).some((raw) => {
    const stem = raw.toLocaleLowerCase(locale);
    return stem.includes(' ') ? text.includes(stem) : words.some((w) => (stem.length >= 5 ? w.startsWith(stem) : w === stem));
  });
}
