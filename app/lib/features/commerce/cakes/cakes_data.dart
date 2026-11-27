// Ported from: src/hooks/useCakes.ts (useCakes; the admin hooks stay web-only), src/components/cakes/cakeUi.ts
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/i18n.dart';
import '../../../state/user_store.dart';
import '../commerce_backend.dart';

/// A `cakes` row (kept as JSON: the persisted cake cart stores the same shape).
class Cake {
  Cake(this.row);
  final Map<String, dynamic> row;

  String get id => '${row['id']}';
  String get name => row['name'] is String ? row['name'] as String : '';
  String? get description => row['description'] is String ? row['description'] as String : null;

  /// `Number(cake.price)`.
  double get price {
    final p = row['price'];
    if (p is num) return p.toDouble();
    if (p is String) return double.tryParse(p.trim()) ?? 0;
    return 0;
  }

  String? get imageUrl => row['image_url'] is String && (row['image_url'] as String).isNotEmpty ? row['image_url'] as String : null;
  List<String> get images => row['images'] is List
      ? [
          for (final i in row['images'] as List)
            if (i is String && i.isNotEmpty) i,
        ]
      : const [];
  String get category => row['category'] is String ? row['category'] as String : '';
  int? get monthNumber => row['month_number'] is num ? (row['month_number'] as num).toInt() : null;
  String? get milestoneType => row['milestone_type'] is String ? row['milestone_type'] as String : null;
  String? get milestoneLabel => row['milestone_label'] is String && (row['milestone_label'] as String).isNotEmpty ? row['milestone_label'] as String : null;
  bool get hasCustomFields => row['has_custom_fields'] == true;
  List<String>? get customFieldLabels => row['custom_field_labels'] is List ? [for (final l in row['custom_field_labels'] as List) '$l'] : null;
}

/// `useCakes()`: active cakes by sort_order, translated (name, description, milestone_label).
final cakesQuery = queryProvider<List<Cake>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<List<Cake>>(
    queryKey: ['cakes', ref.watch(commerceBackendUrlProvider), language],
    staleTime: Duration.zero,
    queryFn: (_) async {
      final rows = await ref.read(commerceBackendProvider).cakes();
      return [
        for (final r in mapRowsTranslation(rows, language, const ['name', 'description', 'milestone_label'])) Cake(Map<String, dynamic>.from(r)),
      ];
    },
  );
}, name: 'cakesQuery');

// ── cakeUi.ts ──────────────────────────────────────────────────────────────────────────────

/// 'month' | 'milestone' | 'pregnancy' | 'family'
typedef CakeCategoryKey = String;
const List<String> cakeCategoryOrder = ['month', 'milestone', 'pregnancy', 'family'];

CakeCategoryKey categoryOf(Cake cake) => cakeCategoryOrder.contains(cake.category) ? cake.category : 'milestone';

String categoryLabel(CakeCategoryKey key) => switch (key) {
  'month' => tr('cakesscreen_cat_month', 'Aylıq tortlar'),
  'pregnancy' => tr('cakesscreen_cat_pregnancy', 'Hamiləlik'),
  'family' => tr('cakesscreen_cat_family', 'Ailə və bayram'),
  _ => tr('cakesscreen_cat_milestone', 'Xüsusi günlər'),
};

String categoryShort(CakeCategoryKey key) => switch (key) {
  'month' => tr('cakesscreen_chip_month', 'Aylıq'),
  'pregnancy' => tr('cakesscreen_cat_pregnancy', 'Hamiləlik'),
  'family' => tr('cakesscreen_cat_family', 'Ailə və bayram'),
  _ => tr('cakesscreen_cat_milestone', 'Xüsusi günlər'),
};

String categorySub(CakeCategoryKey key) => switch (key) {
  'month' => tr('cakesscreen_cat_month_sub', 'Hər ayın fotosu üçün bento tort'),
  'pregnancy' => tr('cakesscreen_cat_pregnancy_sub', 'Gender reveal və sevindirici xəbər'),
  'family' => tr('cakesscreen_cat_family_sub', 'Ana, əkizlər, bayramlar və adlı tortlar'),
  _ => tr('cakesscreen_cat_milestone_sub', '40 gün, ilk diş, ilk addım, 1 yaş'),
};

/// Size, weight and servings written in the description ("10–11 sm, ~400 q, 1–3 nəfərlik").
({String? size, String? weight, String? people}) cakeSpecs(String? description) {
  final text = description ?? '';
  final size = RegExp(r'(\d+(?:\s*[–-]\s*\d+)?)\s*sm\b', caseSensitive: false).firstMatch(text)?[1];
  final weight = RegExp(r'(~?\s*\d+(?:[.,]\d+)?)\s*(kq|q)\b', caseSensitive: false).firstMatch(text);
  final people = RegExp(r'(\d+(?:\s*[–-]\s*\d+)?)\s*nəfər', caseSensitive: false).firstMatch(text)?[1];
  String squash(String s) => s.replaceAll(RegExp(r'\s+'), '');
  return (
    size: size != null ? '${squash(size)} sm' : null,
    weight: weight != null ? '${squash(weight[1]!)} ${weight[2]}' : null,
    people: people != null ? squash(people) : null,
  );
}

/// Description without the measurements already shown as chips.
String cakeStory(String? description) => (description ?? '')
    .replaceFirst(RegExp(r'\s*\d+(?:\s*[–-]\s*\d+)?\s*sm,?\s*~?\s*[\d.,]*\s*(?:kq|q)?,?\s*\d*(?:\s*[–-]\s*\d+)?\s*nəfərlik\.?', caseSensitive: false), '')
    .trim();

const List<String> cakeFlavors = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
const String cakeFlavorField = 'Dad';

/// Photo box add-on: the bento with six cupcakes in one window box.
abstract final class CakePhotoBox {
  static const int extra = 18;
  static const String field = 'Əlavə';
  static const String value = 'Foto qutusu (+6 kapkeyk)';
  static const String image = 'https://api.anacan.az/storage/v1/object/public/assets/cakes/cake-1793813000-pkg-foto-qutusu.jpg';
}

bool isBento(Cake cake) => cake.category == 'month' || RegExp('bento', caseSensitive: false).hasMatch(cake.name);

/// Cakes without required fields can go straight to the cart from a card.
bool canQuickAdd(Cake cake) => !(cake.hasCustomFields && (cake.customFieldLabels ?? const []).isNotEmpty);

/// `${Number.isInteger(value) ? value : value.toFixed(2)} ₼`.
String cakeMoney(num value) => '${value == value.truncateToDouble() ? value.toInt() : value.toStringAsFixed(2)} ₼';

/// `cakesscreen_one_year` / `common_month_label_<m>`.
String cakeMonthLabel(int month, String language) =>
    month == 12 ? tr('cakesscreen_one_year', '1 yaş') : tr('common_month_label_$month', '${getOrdinal(month, language)} ay');

/// Passed to [cakeCartProvider]-backed widgets as the analytics sink (`trackEvent`).
typedef CakeTrack = void Function(String event, Map<String, Object?> params);
