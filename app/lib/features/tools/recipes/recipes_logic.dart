// Ported from: src/components/tools/Recipes.tsx (getNormalizedCategorySlug, getTranslatedCategoryName,
//              isCategoryMatch, freeRecipeIds)
//
// Category matching / labels of the recipes (slug, Azerbaijani or English names all match) and the free tier: the
// first 3 recipes of each category are free.
import '../../../core/data/data.dart' show Row, Rows;
import '../../../core/i18n/app_languages.dart' show isPackLanguage;
import '../../../core/i18n/tr.dart';

const Map<String, String> _slugMap = {
  'səhər yeməyi': 'seher_yemeyi',
  'seher yemeyi': 'seher_yemeyi',
  'seher_yemeyi': 'seher_yemeyi',
  'nahar': 'nahar',
  'şam yeməyi': 'sam_yemeyi',
  'sam yemeyi': 'sam_yemeyi',
  'sam_yemeyi': 'sam_yemeyi',
  'desertlər': 'desertler',
  'desertler': 'desertler',
  'desert': 'desertler',
  'qəlyanaltılar': 'qelyanaltilar',
  'qelyanaltilar': 'qelyanaltilar',
  'qelyanalti': 'qelyanaltilar',
  'qəlyanaltı': 'qelyanaltilar',
  'sulu yeməklər': 'sulu_yemekler',
  'sulu yemekler': 'sulu_yemekler',
  'sulu_yemekler': 'sulu_yemekler',
  'körpə qidası': 'korpe_qidasi',
  'korpe qidasi': 'korpe_qidasi',
  'korpe_qidasi': 'korpe_qidasi',
};

/// Recipes.tsx fallback dictionary (az, en, ru, tr, kk, de, ar; uz / ka bridge through ru).
const Map<String, Map<String, String>> _dictionary = {
  'seher_yemeyi': {'az': 'Səhər Yeməyi', 'en': 'Breakfast', 'ru': 'Завтрак', 'tr': 'Kahvaltı', 'kk': 'Таңғы ас', 'de': 'Frühstück', 'ar': 'الإفطار'},
  'səhər yeməyi': {'az': 'Səhər Yeməyi', 'en': 'Breakfast', 'ru': 'Завтрак', 'tr': 'Kahvaltı', 'kk': 'Таңғы ас', 'de': 'Frühstück', 'ar': 'الإفطار'},
  'seher yemeyi': {'az': 'Səhər Yeməyi', 'en': 'Breakfast', 'ru': 'Завтрак', 'tr': 'Kahvaltı', 'kk': 'Таңғы ас', 'de': 'Frühstück', 'ar': 'الإفطار'},
  'nahar': {'az': 'Nahar', 'en': 'Lunch', 'ru': 'Обед', 'tr': 'Öğle yemeği', 'kk': 'Түскі ас', 'de': 'Mittagessen', 'ar': 'الغداء'},
  'sam_yemeyi': {'az': 'Şam Yeməyi', 'en': 'Dinner', 'ru': 'Ужин', 'tr': 'Akşam yemeği', 'kk': 'Кешкі ас', 'de': 'Abendessen', 'ar': 'العشاء'},
  'şam yeməyi': {'az': 'Şam Yeməyi', 'en': 'Dinner', 'ru': 'Ужин', 'tr': 'Akşam yemeği', 'kk': 'Кешкі ас', 'de': 'Abendessen', 'ar': 'العشاء'},
  'sam yemeyi': {'az': 'Şam Yeməyi', 'en': 'Dinner', 'ru': 'Ужин', 'tr': 'Akşam yemeği', 'kk': 'Кешкі ас', 'de': 'Abendessen', 'ar': 'العشاء'},
  'şorbalar': {'az': 'Şorbalar', 'en': 'Soups', 'ru': 'Супы', 'tr': 'Çorbalar', 'kk': 'Сорпалар', 'de': 'Suppen', 'ar': 'الشوربات'},
  'sorbalar': {'az': 'Şorbalar', 'en': 'Soups', 'ru': 'Супы', 'tr': 'Çorbalar', 'kk': 'Сорпалар', 'de': 'Suppen', 'ar': 'الشوربات'},
  'pürelər': {'az': 'Pürelər', 'en': 'Purees', 'ru': 'Пюре', 'tr': 'Püreler', 'kk': 'Пюрелер', 'de': 'Pürees', 'ar': 'البورية'},
  'pureler': {'az': 'Pürelər', 'en': 'Purees', 'ru': 'Пюре', 'tr': 'Püreler', 'kk': 'Пюрелер', 'de': 'Pürees', 'ar': 'البورية'},
  'əsas yeməklər': {'az': 'Əsas yeməklər', 'en': 'Main dishes', 'ru': 'Основные блюда', 'tr': 'Ana yemekler', 'kk': 'Негізгі тағамдар', 'de': 'Hauptgerichte', 'ar': 'الأطباق الرئيسية'},
  'esas yemekler': {'az': 'Əsas yeməklər', 'en': 'Main dishes', 'ru': 'Основные блюда', 'tr': 'Ana yemekler', 'kk': 'Негізгі тағамдар', 'de': 'Hauptgerichte', 'ar': 'الأطباق الرئيسية'},
  'desertler': {'az': 'Desertlər', 'en': 'Desserts', 'ru': 'Десерты', 'tr': 'Tatlılar', 'kk': 'Десерттер', 'de': 'Desserts', 'ar': 'الحلويات'},
  'desertlər': {'az': 'Desertlər', 'en': 'Desserts', 'ru': 'Десерты', 'tr': 'Tatlılar', 'kk': 'Десерттер', 'de': 'Desserts', 'ar': 'الحلويات'},
  'desert': {'az': 'Desert', 'en': 'Dessert', 'ru': 'Десерт', 'tr': 'Tatlı', 'kk': 'Десерт', 'de': 'Dessert', 'ar': 'حلوى'},
  'saglam ickiler': {'az': 'Sağlam içkilər', 'en': 'Healthy Drinks', 'ru': 'Полезные напитки', 'tr': 'Sağlıklı içecekler', 'kk': 'Пайдалы сусындар', 'de': 'Gesunde Getränke', 'ar': 'مشروبات صحية'},
  'sağlam içkilər': {'az': 'Sağlam içkilər', 'en': 'Healthy Drinks', 'ru': 'Полезные напитки', 'tr': 'Sağlıklı içecekler', 'kk': 'Пайдалы сусындар', 'de': 'Gesunde Getränke', 'ar': 'مشروبات صحية'},
  'elave qida': {'az': 'Əlavə qida', 'en': 'Supplementary Food', 'ru': 'Прикорм', 'tr': 'Ek gıda', 'kk': 'Қосымша тағам', 'de': 'Beikost', 'ar': 'الغذاء التكميلي'},
  'əlavə qida': {'az': 'Əlavə qida', 'en': 'Supplementary Food', 'ru': 'Прикорм', 'tr': 'Ek gıda', 'kk': 'Қосымша тағам', 'de': 'Beikost', 'ar': 'الغذاء التكميلي'},
  'qelyanaltilar': {'az': 'Qəlyanaltılar', 'en': 'Snacks', 'ru': 'Перекусы', 'tr': 'Ara öğünler', 'kk': 'Жеңіл тағамдар', 'de': 'Snacks', 'ar': 'وجبات خفيفة'},
  'qəlyanaltılar': {'az': 'Qəlyanaltılar', 'en': 'Snacks', 'ru': 'Перекусы', 'tr': 'Ara öğünler', 'kk': 'Жеңіл тағамдар', 'de': 'Snacks', 'ar': 'وجبات خفيفة'},
  'qelyanalti': {'az': 'Qəlyanaltı', 'en': 'Snack', 'ru': 'Перекус', 'tr': 'Ara öğün', 'kk': 'Жеңіл тағам', 'de': 'Snack', 'ar': 'وجبة خفيفة'},
  'qəlyanaltı': {'az': 'Qəlyanaltı', 'en': 'Snack', 'ru': 'Перекус', 'tr': 'Ara öğün', 'kk': 'Жеңіл тағам', 'de': 'Snack', 'ar': 'وجبة خفيفة'},
  'sulu_yemekler': {'az': 'Sulu Yeməklər', 'en': 'Soups', 'ru': 'Супы', 'tr': 'Sulu yemekler', 'kk': 'Сорпалы тағамдар', 'de': 'Suppen', 'ar': 'الأطباق ذات المرق'},
  'sulu yeməklər': {'az': 'Sulu Yeməklər', 'en': 'Soups', 'ru': 'Супы', 'tr': 'Sulu yemekler', 'kk': 'Сорпалы тағамдар', 'de': 'Suppen', 'ar': 'الأطباق ذات المرق'},
  'sulu yemekler': {'az': 'Sulu Yeməklər', 'en': 'Soups', 'ru': 'Супы', 'tr': 'Sulu yemekler', 'kk': 'Сорпалы тағамдар', 'de': 'Suppen', 'ar': 'الأطباق ذات المرق'},
  'korpe_qidasi': {'az': 'Körpə Qidası', 'en': 'Baby Food', 'ru': 'Детское питание', 'tr': 'Bebek maması', 'kk': 'Бөбек тағамы', 'de': 'Babynahrung', 'ar': 'طعام الرضيع'},
  'körpə qidası': {'az': 'Körpə Qidası', 'en': 'Baby Food', 'ru': 'Детское питание', 'tr': 'Bebek maması', 'kk': 'Бөбек тағамы', 'de': 'Babynahrung', 'ar': 'طعام الرضيع'},
  'korpe qidasi': {'az': 'Körpə Qidası', 'en': 'Baby Food', 'ru': 'Детское питание', 'tr': 'Bebek maması', 'kk': 'Бөбек тағамы', 'de': 'Babynahrung', 'ar': 'طعام الرضيع'},
  'populyar': {'az': 'Populyar', 'en': 'Popular', 'ru': 'Популярное', 'tr': 'Popüler', 'kk': 'Танымал', 'de': 'Beliebt', 'ar': 'الأكثر شيوعًا'},
  'all': {'az': 'Hamısı', 'en': 'All', 'ru': 'Все', 'tr': 'Hepsi', 'kk': 'Барлығы', 'de': 'Alle', 'ar': 'الكل'},
  'hamısı': {'az': 'Hamısı', 'en': 'All', 'ru': 'Все', 'tr': 'Hepsi', 'kk': 'Барлығы', 'de': 'Alle', 'ar': 'الكل'},
  'hamisi': {'az': 'Hamısı', 'en': 'All', 'ru': 'Все', 'tr': 'Hepsi', 'kk': 'Барлығы', 'de': 'Alle', 'ar': 'الكل'},
};

/// JS `toLowerCase()` (the Turkish dotted İ becomes `i̇`, as in the browser).
String _lower(String s) => s.replaceAll('İ', 'i̇').toLowerCase();

Row? _match(Rows categories, String normalized) {
  bool eq(Object? v) => v is String && _lower(v) == normalized;
  for (final c in categories) {
    if (eq(c['category_id']) || eq(c['name_az']) || eq(c['name_en']) || eq(c['name'])) return c;
  }
  return null;
}

/// `getNormalizedCategorySlug(cat)`: any category string (slug, az name, en name) → the standard slug id.
String normalizedCategorySlug(Object? cat, Rows categories) {
  if (cat is! String || cat.isEmpty) return 'all';
  final normalized = _lower(cat.trim());
  final match = _match(categories, normalized);
  if (match != null) return '${match['category_id']}';
  return _slugMap[normalized] ?? normalized;
}

/// `getTranslatedCategoryName(cat, localizedLabel)`.
String translatedCategoryName(Object? cat, Rows categories, String language, {String? localizedLabel, String? Function(String key, String language)? cachedTranslation}) {
  if (cat is! String || cat.isEmpty) return '';
  final normalized = _lower(cat.trim());
  final match = _match(categories, normalized);
  if (match != null) return '${match['name'] ?? ''}';
  final entry = _dictionary[normalized];
  if (entry != null) {
    if (isPackLanguage(language)) return cachedTranslation?.call('recipe_category.$normalized', language) ?? entry['en']!;
    const known = ['az', 'en', 'ru', 'tr', 'kk', 'de', 'ar', 'uz', 'ka'];
    final key = known.contains(language) ? language : 'az';
    final value = entry[key];
    return value != null && value.isNotEmpty ? value : entry['ru']!;
  }
  final label = localizedLabel != null && localizedLabel.isNotEmpty ? localizedLabel : cat;
  if (label.isEmpty) return label;
  return label[0].toUpperCase() + label.substring(1).replaceAll('_', ' ');
}

/// `isCategoryMatch(recipeCat, selectedCat)`.
bool isCategoryMatch(Object? recipeCat, String selected, Rows categories) {
  if (selected == 'all') return true;
  if (recipeCat is! String || recipeCat.isEmpty) return false;
  return normalizedCategorySlug(recipeCat, categories) == normalizedCategorySlug(selected, categories);
}

/// `freeRecipeIds`: the first 3 recipes of each (normalized) category.
Set<String> freeRecipeIds(Rows recipes, Rows categories) {
  final ids = <String>{};
  final count = <String, int>{};
  for (final r in recipes) {
    final cat = normalizedCategorySlug(r['category'], categories);
    count[cat] = (count[cat] ?? 0) + 1;
    if (count[cat]! <= 3) ids.add('${r['id']}');
  }
  return ids;
}

/// The chip list: "All" + the DB categories (an "all" row from the DB is dropped).
List<({String id, String name, String emoji})> recipeChipCategories(Rows db) => [
      (id: 'all', name: tr('recipes_hamisi_c73c4d', 'Hamısı'), emoji: '🍽️'),
      for (final c in db)
        if (c['category_id'] != 'all' && _lower('${c['name'] ?? ''}') != tr('recipes_hamisi_6dc013', 'hamısı'))
          (id: '${c['category_id']}', name: '${c['name'] ?? ''}', emoji: c['emoji'] is String && (c['emoji'] as String).isNotEmpty ? c['emoji'] as String : '🍽️'),
    ];
