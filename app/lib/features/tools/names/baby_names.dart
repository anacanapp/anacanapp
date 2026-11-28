// Ported from: src/components/tools/BabyNames.tsx
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowTranslation;
import '../../../core/i18n/app_languages.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../state/user_store.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../settings/ui/settings_ui.dart' show px, todayInfoEyebrow;
import '../data/data.dart' show babyNamesQuery, nameCollectionLanguage;
import '../kit/kit.dart';
import '../maternity/maternity_copy.dart' show pregnancyFollowupText;
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'favorite_names.dart';

const int namesPageSize = 60;

/// Heart colour of a favourite (`#e05575`, BabyNames.tsx literal).
const Color kFavoriteHeart = Color(0xFFE05575);

/// `window.open` for the Faker attribution link; tests override it.
final namesLinkLauncherProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    });

/// Picks the random name (`Math.random()`); tests override it.
final namesRandomProvider = Provider<math.Random>((ref) => math.Random());

class BabyNames extends ConsumerStatefulWidget {
  const BabyNames({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BabyNames> createState() => _BabyNamesState();
}

class _BabyNamesState extends ConsumerState<BabyNames> {
  final TextEditingController _search = TextEditingController();
  String _gender = 'all';
  int _visibleCount = namesPageSize;
  bool _aiLoading = false;
  String _aiStatus = 'idle';
  bool _detailOpen = false;
  Object? _pagingKey;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String get _query => _search.text;

  Future<void> _toggleFavorite(Map<String, dynamic> name) => ref.read(favoriteNamesProvider.notifier).toggleFavorite(
        '${name['name']}',
        '${name['gender'] ?? 'unisex'}',
        meaning: name['meaning'] as String?,
        origin: name['origin'] as String?,
      );

  Future<void> _aiSearch(String language, bool international) async {
    final q = _query.trim();
    if (q.length < 2 || _aiLoading) return;
    setState(() {
      _aiLoading = true;
      _aiStatus = 'idle';
    });
    try {
      ref.read(analyticsSinkProvider).logEvent('baby_names_ai_lookup', {'name': q});
      final res = await ref.read(namesRepositoryProvider).aiLookup(q, language);
      final data = res.data;
      if (res.error != null || data is! Map || data['success'] != true) throw res.error ?? StateError('lookup failed');
      if (data['found'] != true) {
        if (mounted) setState(() => _aiStatus = 'notfound');
        return;
      }
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['baby_names']));
      final item = data['item'] is Map ? Map<String, dynamic>.from(data['item'] as Map) : null;
      final display = data['display'] is Map ? Map<String, dynamic>.from(data['display'] as Map) : <String, dynamic>{};
      final localized = international && item != null ? mapRowTranslation(item, language, const ['meaning', 'origin']) : null;
      String? pick(Object? a, Object? b) {
        final s = a is String && a.isNotEmpty ? a : null;
        return s ?? (b as String?);
      }

      final selected = <String, dynamic>{
        'id': item?['id'] ?? 'ai-${DateTime.now().millisecondsSinceEpoch}',
        'name': display['name'],
        'gender': display['gender'],
        'meaning': pick(localized?['meaning'], display['meaning']),
        'origin': pick(localized?['origin'], display['origin']),
        'popularity': display['popularity'],
      };
      if (mounted) unawaited(_openDetail(selected, language));
    } catch (e) {
      debugPrint('AI name lookup failed: $e');
      if (mounted) setState(() => _aiStatus = 'error');
    } finally {
      if (mounted) setState(() => _aiLoading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> name, String language) async {
    setState(() => _detailOpen = true);
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'dialog',
      barrierColor: const Color(0x80000000),
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, _, _) => Center(
        child: AScope(
          child: Consumer(builder: (ctx, ref, _) {
            final fav = ref.watch(favoriteNamesProvider).isFavorite('${name['name']}');
            return _NameDetail(
              name: name,
              language: language,
              favorite: fav,
              onClose: () => Navigator.of(ctx).pop(),
              onToggle: () {
                unawaited(_toggleFavorite(name));
                Navigator.of(ctx).pop();
              },
            );
          }),
        ),
      ),
      transitionBuilder: (ctx, anim, _, child) => FadeTransition(
        opacity: anim,
        child: ScaleTransition(scale: Tween<double>(begin: 0.9, end: 1).animate(anim), child: child),
      ),
    );
    if (mounted) setState(() => _detailOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final storedCountry = ref.watch(userStoreProvider.select((s) => s.countryCode));
    final profile = ref.watch(authProfileProvider);
    final country = regionalCountry(language, [profile?.countryCode, storedCountry]);
    final international = isPackLanguage(language);
    final curated = isPackLanguage(nameCollectionLanguage(country, language));
    final favs = ref.watch(favoriteNamesProvider);
    final namesQ = ref.watch(babyNamesQuery(country));
    final slots = ref.watch(pregnancyToolSlotsProvider);

    if (namesQ.isLoading || favs.loading) return const ToolLoading();
    final names = namesQ.data ?? const <Map<String, dynamic>>[];

    final pagingKey = (_query, _gender, country);
    if (_pagingKey != pagingKey) {
      _pagingKey = pagingKey;
      _visibleCount = namesPageSize;
    }
    final q = _query.toLowerCase();
    final filteredIndexed = [
      for (var i = 0; i < names.length; i++)
        if (('${names[i]['name'] ?? ''}'.toLowerCase().contains(q) || '${names[i]['meaning'] ?? ''}'.toLowerCase().contains(q)) &&
            (_gender == 'all' || names[i]['gender'] == _gender || names[i]['gender'] == 'unisex'))
          (i, names[i]),
    ]..sort((m, n) {
        final c = ((n.$2['popularity'] as num?) ?? 0).compareTo((m.$2['popularity'] as num?) ?? 0);
        return c != 0 ? c : m.$1.compareTo(n.$1);
      });
    final filtered = [for (final e in filteredIndexed) e.$2];
    final visible = filtered.take(_visibleCount).toList();

    void random() {
      final pool = _gender == 'all' ? names : names.where((n) => n['gender'] == _gender || n['gender'] == 'unisex').toList();
      if (pool.isEmpty) return;
      unawaited(_openDetail(pool[ref.read(namesRandomProvider).nextInt(pool.length)], language));
    }

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (slots.babyNamesAd != null) slots.babyNamesAd!(context, !_detailOpen && !_aiLoading),
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: '${pregnancyFollowupText('names_country', language, {'country': localizedCountryName(country, language)})} · ${names.length}',
          title: tr('babynames_korpe_adlari_357880', 'Körpə Adları'),
          actions: [
            PTap(
              scale: 0.9,
              semanticLabel: tr('a11y_random_name', 'Təsadüfi ad seç'),
              onTap: random,
              child: Container(
                key: const ValueKey('names-random'),
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(12)),
                child: const AIcon(AIcons.shuffle, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
              ),
            ),
          ],
        ),
        PSearchBox(
          fieldKey: const ValueKey('names-search'),
          controller: _search,
          placeholder: tr('babynames_ad_ve_ya_mena_axtarin_30a88e', 'Ad və ya məna axtarın...'),
          onChanged: (_) => setState(() {}),
        ),
        Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: Row(children: [
            for (final f in [
              (id: 'all', label: '✨ ${tr('babynames_hamisi_c73c4d', 'Hamısı')}'),
              (id: 'boy', label: '👦 ${tr('babynames_oglan_e9715e', 'Oğlan')}'),
              (id: 'girl', label: '👧 ${tr('babynames_qiz_79bf6b', 'Qız')}'),
            ]) ...[
              if (f.id != 'all') const SizedBox(width: 2),
              Expanded(
                child: GestureDetector(
                  key: ValueKey('names-filter-${f.id}'),
                  onTap: () => setState(() => _gender = f.id),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _gender == f.id ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                    child: Text(f.label, maxLines: 1, softWrap: false, style: x.aTab.copyWith(color: _gender == f.id ? a.accentInk : a.inkSoft)),
                  ),
                ),
              ),
            ],
          ]),
        ),
        if (favs.favorites.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('💗 ${tr('babynames_secilmisler_cc04b8', 'Seçilmişlər')}', style: x.aSectionTitle.copyWith(fontSize: 15)),
                  Text('${favs.favorites.length}', style: x.aSectionLink),
                ]),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  for (var i = 0; i < favs.favorites.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(999)),
                      child: Text(favs.favorites[i].name, style: px(11.5, weight: FontWeight.w700, color: a.berryInk)),
                    ),
                  ],
                ]),
              ),
            ]),
          ),
        Padding(
          padding: EdgeInsets.only(top: favs.favorites.isNotEmpty ? 16 : 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(tr('babynames_neticeler_15e2bd', 'Nəticələr'), style: x.aSectionTitle.copyWith(fontSize: 15)),
                Text('${filtered.length} ${tr('babynames_ad_count_3c7a2d', 'ad')}', key: const ValueKey('names-count'), style: x.aSectionLink),
              ]),
            ),
            if (curated)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Wrap(children: [
                  Text('${pregnancyFollowupText('names_catalog_source', language)}: ', style: x.aListSub),
                  GestureDetector(
                    onTap: () => ref.read(namesLinkLauncherProvider)(Uri.parse('https://github.com/faker-js/faker/tree/v9.9.0/src/locales')),
                    child: Text(trInline('BabyNames.tsx', 'Faker v9.9.0 · MIT'), style: x.aListSub.copyWith(decoration: TextDecoration.underline)),
                  ),
                ]),
              ),
            if (filtered.isNotEmpty)
              ACard(
                variant: ACardVariant.list,
                child: Column(children: [
                  for (var i = 0; i < visible.length; i++) _nameRow(context, visible[i], i == 0, favs, language),
                ]),
              ),
            if (filtered.length > _visibleCount)
              GestureDetector(
                key: const ValueKey('names-more'),
                onTap: () => setState(() => _visibleCount += namesPageSize),
                child: Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                  alignment: Alignment.center,
                  child: Text(tr('community_load_more', 'Daha çox göstər'), style: x.aTab.copyWith(color: a.inkSoft)),
                ),
              ),
            if (filtered.isEmpty) _empty(context, language, international),
          ]),
        ),
      ]),
    );
  }

  Widget _empty(BuildContext context, String language, bool international) {
    final a = context.a;
    final x = context.aText;
    return ACard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 36),
      child: Column(children: [
        Padding(padding: const EdgeInsets.only(bottom: 10), child: AIcon(AIcons.search, size: 36, color: a.inkFaint)),
        Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(tr('babynames_ad_tapilmadi_cf4c7a', 'Ad tapılmadı'), style: x.aListTitle)),
        Text(
          _aiStatus == 'notfound'
              ? tr('babynames_ai_notfound', 'AI bu adı tanımadı — yazılışı yoxlayın')
              : _aiStatus == 'error'
                  ? tr('babynames_ai_error', 'AI axtarışı alınmadı — yenidən cəhd edin')
                  : tr('babynames_axtaris_sorgusunu_deyisin_992b5e', 'Axtarış sorğusunu dəyişin'),
          textAlign: TextAlign.center,
          style: x.aListSub,
        ),
        if (_query.trim().length >= 2)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Opacity(
              opacity: _aiLoading ? 0.6 : 1,
              child: PTap(
                scale: _aiLoading ? 1 : 0.97,
                onTap: _aiLoading ? null : () => unawaited(_aiSearch(language, international)),
                child: Container(
                  key: const ValueKey('names-ai'),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (_aiLoading)
                      const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFFFFFF)))
                    else
                      const AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        _aiLoading
                            ? tr('babynames_ai_searching', 'AI axtarır...')
                            : tr('babynames_ai_search', 'AI ilə axtar: {name}').replaceFirst('{name}', _query.trim()),
                        style: x.aPillBtn.copyWith(color: const Color(0xFFFFFFFF)),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _nameRow(BuildContext context, Map<String, dynamic> name, bool first, FavoriteNamesState favs, String language) {
    final a = context.a;
    final x = context.aText;
    final gender = name['gender'];
    final popularity = (name['popularity'] as num?) ?? 0;
    final fav = favs.isFavorite('${name['name']}');
    final grad = gender == 'boy' ? a.gradBlue : (gender == 'girl' ? a.gradPink : a.gradLav);
    final meaning = name['meaning'] as String?;
    return PListRow(
      first: first,
      onTap: () => unawaited(_openDetail(name, language)),
      leading: PListIcon(
        background: gender == 'boy' ? a.blue1 : (gender == 'girl' ? a.pink1 : a.lav1),
        child: Text(gender == 'boy' ? '👦' : (gender == 'girl' ? '👧' : '✨'), style: const TextStyle(fontSize: 17)),
      ),
      body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(child: Text('${name['name']}', style: x.aListTitle)),
          if (popularity >= 80) ...[const SizedBox(width: 5), Icon(Icons.star_rounded, size: 13, color: a.yellow2)],
        ]),
        const SizedBox(height: 2),
        Text(
          meaning == null || meaning.isEmpty ? pregnancyFollowupText('names_no_meaning', language) : meaning,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: x.aListSub,
        ),
      ]),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (popularity != 0) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Container(
              width: 44,
              height: 5,
              color: a.lineStrong,
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                widthFactor: (popularity / 100).clamp(0, 1).toDouble(),
                heightFactor: 1,
                child: DecoratedBox(decoration: BoxDecoration(gradient: grad, borderRadius: BorderRadius.circular(999))),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
        PTap(
          scale: 0.85,
          semanticLabel: tr('a11y_favorite', 'Sevimlilərə əlavə et'),
          selected: fav,
          onTap: () => unawaited(_toggleFavorite(name)),
          child: Container(
            key: ValueKey('names-fav-${name['name']}'),
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: fav ? a.pink1 : a.surface,
              borderRadius: BorderRadius.circular(12),
              border: fav ? null : Border.all(color: a.btnBorder),
            ),
            child: fav ? const Icon(Icons.favorite, size: 13, color: kFavoriteHeart) : AIcon(AIcons.heart, size: 13, color: a.inkSoft),
          ),
        ),
      ]),
    );
  }
}

class _NameDetail extends StatelessWidget {
  const _NameDetail({required this.name, required this.language, required this.favorite, required this.onClose, required this.onToggle});
  final Map<String, dynamic> name;
  final String language;
  final bool favorite;
  final VoidCallback onClose;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final gender = name['gender'];
    final grad = gender == 'boy' ? a.gradBlue : (gender == 'girl' ? a.gradPink : a.gradLav);
    final ink = gender == 'boy' ? a.blueInk : (gender == 'girl' ? a.alertInk : a.lavInk);
    final popularity = (name['popularity'] as num?) ?? 0;
    final meaning = name['meaning'] as String?;
    final origin = name['origin'] as String?;
    return Material(
      type: MaterialType.transparency,
      child: Container(
        key: const ValueKey('names-detail'),
        constraints: const BoxConstraints(maxWidth: 384),
        margin: const EdgeInsets.all(16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(gradient: grad),
            child: Stack(children: [
              Column(children: [
                Container(
                  width: 64,
                  height: 64,
                  margin: const EdgeInsets.only(bottom: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(16)),
                  child: Text(gender == 'boy' ? '👦' : (gender == 'girl' ? '👧' : '✨'), style: const TextStyle(fontSize: 30)),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('${name['name'] ?? ''}', textAlign: TextAlign.center, style: x.heading(px(24, color: ink))),
                ),
                Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 6, children: [
                  PCtaBadge(
                    background: a.chipOverlay,
                    color: ink,
                    fontSize: 10,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    child: Text(upperCss(gender == 'boy' ? tr('babynames_oglan_e9715e', 'Oğlan') : (gender == 'girl' ? tr('babynames_qiz_79bf6b', 'Qız') : trInline('BabyNames.tsx', 'Unisex')))),
                  ),
                  PCtaBadge(
                    background: a.chipOverlay,
                    color: ink,
                    fontSize: 10,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    child: Text(upperCss(origin == null || origin.isEmpty ? tr('baby_name_origin_unspecified', 'Mənşə qeyd edilməyib') : origin)),
                  ),
                ]),
              ]),
              PositionedDirectional(
                top: -12,
                end: -12,
                child: Semantics(
                  button: true,
                  label: tr('common_close', 'Bağla'),
                  child: GestureDetector(
                    onTap: onClose,
                    child: Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      // `rgba(255,255,255,0.5)` (BabyNames.tsx literal)
                      decoration: const BoxDecoration(color: Color(0x80FFFFFF), shape: BoxShape.circle),
                      child: AIcon(AIcons.x, size: 15, color: ink),
                    ),
                  ),
                ),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(upperCss(tr('babynames_menasi_83a157', 'Mənası')), style: todayInfoEyebrow(context)),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(meaning == null || meaning.isEmpty ? pregnancyFollowupText('names_no_meaning', language) : meaning,
                    style: px(14.5, weight: FontWeight.w600, color: a.ink)),
              ),
              if (popularity != 0)
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(tr('babynames_populyarliq_1501b1', 'Populyarlıq'), style: px(11.5, weight: FontWeight.w700, color: a.inkSoft)),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          width: 80,
                          height: 6,
                          color: a.lineStrong,
                          alignment: AlignmentDirectional.centerStart,
                          child: FractionallySizedBox(
                            widthFactor: (popularity / 100).clamp(0, 1).toDouble(),
                            heightFactor: 1,
                            child: DecoratedBox(decoration: BoxDecoration(gradient: grad, borderRadius: BorderRadius.circular(999))),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('$popularity%', style: px(13, weight: FontWeight.w800, color: a.ink)),
                    ]),
                  ]),
                ),
              PTap(
                scale: 0.98,
                onTap: onToggle,
                child: Container(
                  key: const ValueKey('names-detail-toggle'),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  decoration: BoxDecoration(color: favorite ? a.peach1 : a.pink2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    favorite ? AIcon(AIcons.heart, size: 15, strokeWidth: 2.2, color: a.accentInk) : const Icon(Icons.favorite, size: 15, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        favorite ? tr('babynames_secilmislerden_cixar_69b878', 'Seçilmişlərdən çıxar') : tr('babynames_secilmislere_elave_et_d53f1e', 'Seçilmişlərə əlavə et'),
                        style: x.aPillBtn.copyWith(color: favorite ? a.accentInk : const Color(0xFFFFFFFF)),
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
