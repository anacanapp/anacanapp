// Ported from: src/lib/baby-chat-safety.ts
//
// Health or worry in the mother's message: the baby answers with a curated loving line and the
// chat shows a gentle "talk to your doctor" card. Same lists as the server function
// supabase/functions/baby-chat-reply/index.ts (a test keeps them identical); other languages
// rely on the server model's topic label.
import 'baby_chat.dart' show localeLower;

const Map<String, List<String>> kCareStems = {
  'az': ['qanaxma', 'qan gəl', 'ağrı', 'ağrıy', 'ağrıs', 'sancı', 'düşük', 'qızdırma', 'həkim', 'xəstəxana', 'dərman', 'ölüm', 'öldü', 'intihar',
    'özümə zərər', 'tərpənmir', 'hərəkət etmir', 'qorxuram', 'narahatam', 'qusma', 'ödem', 'təzyiq'],
  'en': ['bleed', 'blood', 'pain', 'pains', 'painful', 'hurt', 'hurts', 'hurting', 'cramp', 'cramps', 'contraction', 'miscarr', 'fever', 'doctor', 'hospital', 'medic', 'pill', 'pills',
    'died', 'dying', 'death', 'dead', 'suicid', 'kill myself', 'not moving', 'worried', 'scared', 'anxious', 'vomit', 'blood pressure'],
  'ru': ['кровь', 'крови', 'кровот', 'боль', 'боли', 'болью', 'болит', 'схватк', 'выкидыш', 'температур', 'врач', 'врача', 'врачу', 'больниц', 'лекарств', 'умер', 'смерт', 'суицид',
    'не шевел', 'боюсь', 'тревог', 'рвота', 'рвоты', 'давлени'],
  'tr': ['kanama', 'kan geldi', 'ağrı', 'sancı', 'düşük', 'ateş', 'ateşi', 'doktor', 'hastane', 'ilaç', 'ilacı', 'ölüm', 'öldü', 'intihar',
    'kıpırdamıyor', 'hareket etmiyor', 'korkuyorum', 'endişe', 'kusma', 'tansiyon'],
};

final RegExp _nonWord = RegExp(r'[^\p{L}\p{N}]+', unicode: true);

/// Phrases match anywhere; stems of 5+ letters at the start of a word, shorter ones as the whole word.
bool hasCareTopic(String message, String language) {
  final locale = language == 'tr' || language == 'az' ? 'tr' : language;
  final text = localeLower(message, locale);
  final words = text.split(_nonWord).where((w) => w.isNotEmpty).toList();
  return (kCareStems[language] ?? const <String>[]).any((raw) {
    final stem = localeLower(raw, locale);
    return stem.contains(' ') ? text.contains(stem) : words.any((w) => stem.length >= 5 ? w.startsWith(stem) : w == stem);
  });
}
