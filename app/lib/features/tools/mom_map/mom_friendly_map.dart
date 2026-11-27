// Ported from: src/components/tools/MomFriendlyMap.tsx
//
// Ana Dostu Məkanlar. Despite its name the React tool draws no map (no Leaflet / Google Maps / iframe): it is a
// searchable, filterable list of places with a detail dialog (amenities, phone, reviews) and forms to suggest a
// place and to write a review. The port reproduces that list exactly, so no map SDK is needed.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Rows;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show jsParseDate;
import '../../settings/ui/settings_ui.dart' show AIconBtn, FadeRise, ShadSelect, ShadSwitch, px, toasts;
import '../health_common/health_common.dart' show healthLinkLauncherProvider;
import '../health_common/health_db.dart';
import '../health_common/health_ui.dart'
    show AField, AListCardBox, AListIconBox, AListRowBox, APillButton, APillKind, APulse, ASearchField, ATextArea, LucideFilled;
import '../kit/kit.dart';
import '../media_common/media_ports.dart' show localeDateString;
import '../more_common/more_ui.dart';
import 'mom_places_data.dart';

/// A `mom_friendly_places` row.
typedef _Place = Map<String, dynamic>;

/// `ICON_MAP` for the dynamic category icons (MapPin when unknown).
const Map<String, AIconData> _iconMap = {
  'MapPin': AIcons.mapPin,
  'Utensils': AIcons.utensils,
  'Building2': AIcons.building2,
  'TreePine': AIcons.treePine,
  'Heart': AIcons.heart,
  'Train': AIcons.tramFront,
  'Pill': AIcons.pill,
  'PlayCircle': AIcons.circlePlay,
};

class _Cat {
  const _Cat(this.value, this.label, this.icon);
  final String value;
  final String label;
  final AIconData icon;
}

class _Amenity {
  const _Amenity(this.key, this.label, this.icon);
  final String key;
  final String label;
  final String icon;
}

const List<String> _amenityColumns = [
  'has_breastfeeding_room',
  'has_changing_table',
  'has_elevator',
  'has_ramp',
  'has_stroller_access',
  'has_kids_menu',
  'has_play_area',
  'has_high_chair',
  'has_parking',
];

Map<String, dynamic> _emptyPlace() => {
  'name': '',
  'name_az': '',
  'address_az': '',
  'category': 'cafe',
  'latitude': 40.4093,
  'longitude': 49.8671,
  for (final c in _amenityColumns) c: false,
};

/// `place.avg_rating?.toFixed(1) || '–'`.
String _rating(Object? v) => v is num ? v.toStringAsFixed(1) : '–';

class MomFriendlyMap extends ConsumerStatefulWidget {
  const MomFriendlyMap({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<MomFriendlyMap> createState() => _MomFriendlyMapState();
}

class _MomFriendlyMapState extends ConsumerState<MomFriendlyMap> {
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  String _selectedCategory = 'all';
  List<String> _selectedAmenities = [];
  bool _showFilters = false;
  final TextEditingController _search = TextEditingController();

  Map<String, dynamic> _newPlace = _emptyPlace();
  bool _addingPlace = false;

  int _reviewRating = 0;
  final TextEditingController _reviewComment = TextEditingController();
  bool _showReviewForm = false;
  bool _addingReview = false;

  void _update(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
    _tick.value++;
  }

  @override
  void initState() {
    super.initState();
    _search.addListener(() => _update(() {}));
  }

  @override
  void dispose() {
    _tick.dispose();
    _search.dispose();
    _reviewComment.dispose();
    super.dispose();
  }

  List<_Cat> _categories(Rows db) => [
    for (final c in db.isNotEmpty ? db : fallbackPlaceCategories())
      _Cat('${c['category_key']}', '${c['label'] ?? ''}', _iconMap['${c['icon_name']}'] ?? AIcons.mapPin),
  ];

  List<_Amenity> _amenities(Rows db) => [
    for (final a in db.isNotEmpty ? db : fallbackPlaceAmenities()) _Amenity('${a['amenity_key']}', '${a['label'] ?? ''}', '${a['emoji'] ?? ''}'),
  ];

  _Cat _categoryInfo(List<_Cat> cats, Object? category) => cats.firstWhere((c) => c.value == category, orElse: () => cats.first);

  List<_Amenity> _placeAmenities(List<_Amenity> all, _Place place) => all.where((a) {
    final v = place[a.key];
    return v != null && v != false && v != 0 && v != '';
  }).toList();

  Future<void> _addPlace(BuildContext dialogContext) async {
    if ('${_newPlace['name'] ?? ''}'.isEmpty) {
      toasts(context).error(tr('momfriendlymap_mekan_adi_teleb_olunur_989a8a', 'Məkan adı tələb olunur'));
      return;
    }
    final user = ref.read(authUserProvider);
    _update(() => _addingPlace = true);
    try {
      if (user == null) throw StateError('User not authenticated');
      await addMomPlace(ref.read(healthDbProvider), user.id, _newPlace);
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['mom-friendly-places']));
      if (mounted) {
        toasts(context).success(tr('usemomfriendlyplaces_mekan_elave_edildi_admin_tesdi_0c46f2', 'Məkan əlavə edildi! Admin təsdiqindən sonra görünəcək.'));
      }
      if (dialogContext.mounted) Navigator.of(dialogContext).pop();
      _update(() => _newPlace = _emptyPlace());
    } catch (_) {
      if (mounted) toasts(context).error(tr('usemomfriendlyplaces_mekan_elave_edile_bilmedi_9a9c5b', 'Məkan əlavə edilə bilmədi'));
    } finally {
      _update(() => _addingPlace = false);
    }
  }

  Future<void> _addReview(_Place place) async {
    final user = ref.read(authUserProvider);
    _update(() => _addingReview = true);
    try {
      if (user == null) throw StateError('User not authenticated');
      final placeId = '${place['id']}';
      await addPlaceReview(ref.read(healthDbProvider), user.id, {
        'place_id': placeId,
        'rating': _reviewRating,
        if (_reviewComment.text.isNotEmpty) 'comment': _reviewComment.text,
      });
      final qc = ref.read(queryClientProvider);
      unawaited(qc.invalidateQueries(queryKey: ['place-reviews', placeId]));
      unawaited(qc.invalidateQueries(queryKey: const ['mom-friendly-places']));
      if (mounted) {
        toasts(context).success(tr('usemomfriendlyplaces_reyiniz_gonderildi_admin_tesdi_abb220', 'Rəyiniz göndərildi! Admin təsdiqindən sonra görünəcək.'));
      }
      _reviewComment.clear();
      _update(() {
        _reviewRating = 0;
        _showReviewForm = false;
      });
    } catch (_) {
      if (mounted) toasts(context).error(tr('usemomfriendlyplaces_rey_elave_edile_bilmedi_81a081', 'Rəy əlavə edilə bilmədi'));
    } finally {
      _update(() => _addingReview = false);
    }
  }

  Widget _live(Widget Function(BuildContext context) build) => ValueListenableBuilder<int>(valueListenable: _tick, builder: (context, _, _) => build(context));

  Future<void> _showAdd() => showMoreDialog<void>(context, maxWidth: 448, maxHeightFactor: 0.85, builder: (_) => _live(_addContent));

  Future<void> _showPlace(_Place place) async {
    await showMoreDialog<void>(context, maxWidth: 448, maxHeightFactor: 0.85, padded: false, builder: (_) => _live((c) => _placeContent(c, place)));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final cats = _categories(ref.watch(placeCategoriesQuery).data ?? const []);
    final amenities = _amenities(ref.watch(placeAmenitiesQuery).data ?? const []);
    final placesQ = ref.watch(momFriendlyPlacesQuery((category: _selectedCategory, amenities: List.unmodifiable(_selectedAmenities))));
    final places = placesQ.data ?? const <_Place>[];
    final q = _search.text.toLowerCase();
    final filtered = places.where((p) => '${p['name'] ?? ''}'.toLowerCase().contains(q) || '${p['address'] ?? ''}'.toLowerCase().contains(q)).toList();
    final verifiedCount = places.where((p) => p['is_verified'] == true).length;
    final avgRating = places.isNotEmpty
        ? (places.fold<num>(0, (s, p) => s + (p['avg_rating'] is num ? p['avg_rating'] as num : 0)) / places.length).toStringAsFixed(1)
        : '0';
    final filterOn = _showFilters || _selectedAmenities.isNotEmpty;

    Widget stat(Widget icon, String value, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(width: 4),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: value,
                style: px(12, weight: FontWeight.w700, color: a.onBg, height: 16 / 12),
              ),
              TextSpan(text: ' $label'),
            ],
          ),
        ),
      ],
    );

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('momfriendlymap_korpenizle_rahat_yerler_4e48e6', 'Körpənizlə rahat yerlər'),
            title: tr('momfriendlymap_ana_dostu_mekanlar_4153ec', 'Ana Dostu Məkanlar'),
            actions: [
              Semantics(
                selected: _showFilters,
                child: AIconBtn(
                  key: const ValueKey('mom-filter'),
                  semanticLabel: tr('a11y_filter', 'Filtr'),
                  background: filterOn ? a.pink2 : null,
                  foreground: filterOn ? const Color(0xFFFFFFFF) : null,
                  border: !filterOn,
                  onTap: () => _update(() => _showFilters = !_showFilters),
                  icon: const AIcon(AIcons.filter, size: 16),
                ),
              ),
              ToolIconButton(
                key: const ValueKey('mom-add'),
                semanticLabel: tr('a11y_add', 'Əlavə et'),
                onTap: _showAdd,
                icon: const AIcon(AIcons.plus, size: 16),
              ),
            ],
          ),
          ASearchField(controller: _search, placeholder: tr('momfriendlymap_mekan_axtar_8b889d', 'Məkan axtar...'), fieldKey: const ValueKey('mom-search')),
          const SizedBox(height: 12),
          DefaultTextStyle.merge(
            style: px(12, weight: FontWeight.w600, color: a.onBgSoft, height: 16 / 12),
            child: Wrap(
              spacing: 16,
              runSpacing: 4,
              children: [
                stat(AIcon(AIcons.mapPin, size: 12, color: a.onBgSoft), '${places.length}', tr('momfriendlymap_mekan_ea55b2', 'məkan')),
                stat(AIcon(AIcons.check, size: 12, color: a.green2), '$verifiedCount', tr('momfriendlymap_tesdiqlenmis_b28f33', 'təsdiqlənmiş')),
                stat(LucideFilled(AIcons.star, size: 12, color: a.yellow2), avgRating, tr('momfriendlymap_orta_reytinq_3c7a2d', 'orta reytinq')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          FadeRise(
            delay: const Duration(milliseconds: 250),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  for (var i = 0; i < cats.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    MorePillChip(
                      key: ValueKey('mom-cat-${cats[i].value}'),
                      selected: _selectedCategory == cats[i].value,
                      onTap: () => _update(() => _selectedCategory = cats[i].value),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      weight: FontWeight.w700,
                      gap: 8,
                      background: _selectedCategory == cats[i].value ? a.pink2 : a.surface,
                      color: _selectedCategory == cats[i].value ? const Color(0xFFFFFFFF) : a.inkSoft,
                      borderColor: _selectedCategory == cats[i].value ? const Color(0x00000000) : a.line,
                      // `0 8px 18px -8px rgba(255, 138, 164, 0.8)` (MomFriendlyMap.tsx literal)
                      shadow: _selectedCategory == cats[i].value
                          ? const [BoxShadow(color: Color(0xCCFF8AA4), offset: Offset(0, 8), blurRadius: 18, spreadRadius: -8)]
                          : null,
                      children: [AIcon(cats[i].icon, size: 16), Text(cats[i].label)],
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_showFilters) ...[
            const SizedBox(height: 12),
            ACard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.sparkles, size: 16, color: a.pink2),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            tr('momfriendlymap_i_mkanlara_gore_suz_f2f5d6', 'İmkanlara görə süz'),
                            style: x.heading(px(14.5, weight: FontWeight.w700, color: a.ink)),
                          ),
                        ),
                        if (_selectedAmenities.isNotEmpty)
                          GestureDetector(
                            key: const ValueKey('mom-clear'),
                            behavior: HitTestBehavior.opaque,
                            onTap: () => _update(() => _selectedAmenities = []),
                            child: Text(
                              tr('momfriendlymap_temizle_1c3651', 'Təmizlə'),
                              style: px(12, weight: FontWeight.w700, color: a.pinkInk, height: 16 / 12),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final am in amenities)
                        MorePillChip(
                          key: ValueKey('mom-amenity-${am.key}'),
                          selected: _selectedAmenities.contains(am.key),
                          onTap: () => _update(
                            () => _selectedAmenities = _selectedAmenities.contains(am.key)
                                ? _selectedAmenities.where((k) => k != am.key).toList()
                                : [..._selectedAmenities, am.key],
                          ),
                          background: _selectedAmenities.contains(am.key) ? a.pink2 : a.surfaceSoft,
                          color: _selectedAmenities.contains(am.key) ? const Color(0xFFFFFFFF) : a.ink,
                          children: [Text(am.icon), Text(am.label)],
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (placesQ.isLoading)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  APulse(
                    child: ACard(
                      child: Row(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                FractionallySizedBox(
                                  widthFactor: 0.75,
                                  child: Container(
                                    height: 16,
                                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                FractionallySizedBox(
                                  widthFactor: 0.5,
                                  child: Container(
                                    height: 12,
                                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            )
          else if (filtered.isEmpty)
            DashedEmptyCard(
              gradient: a.gradPink,
              icon: AIcon(AIcons.mapPin, size: 32, color: a.alertInk),
              title: tr('momfriendlymap_mekan_tapilmadi_ffea6b', 'Məkan tapılmadı'),
              text: tr('momfriendlymap_bu_filtrlere_uygun_mekan_yoxdu_d1f970', 'Bu filtrlərə uyğun məkan yoxdur'),
              action: APillButton(
                buttonKey: const ValueKey('mom-add-first'),
                background: a.pink2,
                foreground: const Color(0xFFFFFFFF),
                icon: const AIcon(AIcons.plus, size: 15, strokeWidth: 2.2),
                label: tr('momfriendlymap_i_lk_mekani_elave_et_47627a', 'İlk məkanı əlavə et'),
                onTap: _showAdd,
              ),
            )
          else
            AListCardBox(
              children: [
                for (var i = 0; i < filtered.length; i++)
                  FadeRise(
                    dy: 10,
                    delay: Duration(milliseconds: (i * 50).clamp(0, 300)),
                    child: _placeRow(context, filtered[i], cats, amenities, first: i == 0),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _verifiedTag(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AIcon(AIcons.check, size: 12, color: a.greenInk),
          const SizedBox(width: 4),
          Text(
            tr('momfriendlymap_tesdiqlenib_96c431', 'Təsdiqlənib'),
            style: px(10.5, weight: FontWeight.w800, color: a.greenInk),
          ),
        ],
      ),
    );
  }

  Widget _placeRow(BuildContext context, _Place place, List<_Cat> cats, List<_Amenity> all, {required bool first}) {
    final a = context.a;
    final x = context.aText;
    final cat = _categoryInfo(cats, place['category']);
    final ams = _placeAmenities(all, place);
    return AListRowBox(
      key: ValueKey('mom-place-${place['id']}'),
      first: first,
      crossAxisAlignment: CrossAxisAlignment.start,
      onTap: () => _showPlace(place),
      children: [
        AListIconBox(
          gradient: a.gradPink,
          child: AIcon(cat.icon, size: 18, strokeWidth: 2.2, color: a.alertInk),
        ),
        // `items-start` row: the chevron alone is `self-center` (centred against the text column's height).
        Expanded(
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Row(
                          children: [
                            Flexible(
                              child: Text('${place['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
                            ),
                            if (place['is_verified'] == true) ...[const SizedBox(width: 8), _verifiedTag(context)],
                          ],
                        ),
                      ),
                      Text(
                        '${place['address'] ?? ''}'.isNotEmpty ? '${place['address']}' : tr('momfriendlymap_unvan_gosterilmeyib_06305d', 'Ünvan göstərilməyib'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: x.aListSub,
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              LucideFilled(AIcons.star, size: 14, color: a.yellow2),
                              const SizedBox(width: 4),
                              Text(
                                _rating(place['avg_rating']),
                                style: px(12, weight: FontWeight.w700, color: a.ink, height: 16 / 12),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '(${place['review_count'] ?? 0})',
                                style: px(10, color: a.inkSoft, height: 15 / 10),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              for (final am in ams.take(5)) ...[
                                Semantics(
                                  tooltip: am.label,
                                  child: Container(
                                    margin: const EdgeInsetsDirectional.only(end: 4),
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)),
                                    child: Text(am.icon, style: px(12, height: 16 / 12)),
                                  ),
                                ),
                              ],
                              if (ams.length > 5)
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Text(
                                    '+${ams.length - 5}',
                                    style: px(10, color: a.inkSoft, height: 15 / 10),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 13),
                Center(child: AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _addContent(BuildContext context) {
    final a = context.a;
    final cats = _categories(ref.read(placeCategoriesQuery).data ?? const []);
    final amenities = _amenities(ref.read(placeAmenitiesQuery).data ?? const []);
    Widget label(String text, {double bottom = 6}) => MoreFieldLabel(text, bottom: bottom);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MoreDialogHeader(
          icon: Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(8)),
            child: AIcon(AIcons.plus, size: 16, color: a.alertInk),
          ),
          title: tr('momfriendlymap_yeni_mekan_elave_et_53fb45', 'Yeni Məkan Əlavə Et'),
        ),
        const SizedBox(height: 32),
        label(tr('momfriendlymap_mekan_adi_ec57ac', 'Məkan adı *')),
        _Input(
          fieldKey: const ValueKey('mom-new-name'),
          initial: '${_newPlace['name']}',
          placeholder: tr('momfriendlymap_meselen_port_baku_mall_760801', 'Məsələn: Port Baku Mall'),
          onChanged: (v) => _newPlace = {..._newPlace, 'name': v, 'name_az': v},
        ),
        const SizedBox(height: 16),
        label(tr('momfriendlymap_unvan_b8651a', 'Ünvan')),
        _Input(
          initial: '${_newPlace['address_az'] ?? ''}',
          placeholder: tr('momfriendlymap_baki_neftciler_prospekti_a5d7c0', 'Bakı, Neftçilər prospekti'),
          onChanged: (v) => _newPlace = {..._newPlace, 'address_az': v},
        ),
        const SizedBox(height: 16),
        label(tr('untranslated_kateqoriya_d7bf4y', 'Kateqoriya')),
        ShadSelect<String>(
          fieldKey: const ValueKey('mom-new-category'),
          value: '${_newPlace['category']}',
          background: a.surface,
          borderColor: a.lineStrong,
          textColor: a.ink,
          radius: 12,
          options: [
            for (final c in cats.where((c) => c.value != 'all'))
              (
                c.value,
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AIcon(c.icon, size: 16),
                    const SizedBox(width: 8),
                    Flexible(child: Text(c.label)),
                  ],
                ),
              ),
          ],
          onChanged: (v) => _update(() => _newPlace = {..._newPlace, 'category': v}),
        ),
        const SizedBox(height: 16),
        label(tr('momfriendlymap_imkanlar_60eb86', 'İmkanlar'), bottom: 12),
        for (var i = 0; i < amenities.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                Text(amenities[i].icon, style: px(18, height: 28 / 18)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    amenities[i].label,
                    style: px(14, color: a.ink, height: 20 / 14),
                  ),
                ),
                ShadSwitch(
                  key: ValueKey('mom-new-${amenities[i].key}'),
                  checked: _newPlace[amenities[i].key] == true,
                  onChanged: (v) => _update(() => _newPlace = {..._newPlace, amenities[i].key: v}),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        Builder(
          builder: (dialogContext) => APillButton(
            buttonKey: const ValueKey('mom-new-submit'),
            height: 46,
            expand: true,
            background: a.pink2,
            foreground: const Color(0xFFFFFFFF),
            opacity: _addingPlace ? 0.6 : 1,
            label: _addingPlace ? tr('momfriendlymap_elave_edilir_3c28b4', 'Əlavə edilir...') : tr('momfriendlymap_mekan_elave_et_dd9c6e', 'Məkan Əlavə Et'),
            onTap: _addingPlace ? null : () => _addPlace(dialogContext),
          ),
        ),
      ],
    );
  }

  Widget _placeContent(BuildContext context, _Place place) {
    final a = context.a;
    final x = context.aText;
    final cats = _categories(ref.read(placeCategoriesQuery).data ?? const []);
    final amenities = _placeAmenities(_amenities(ref.read(placeAmenitiesQuery).data ?? const []), place);
    final cat = _categoryInfo(cats, place['category']);
    return Consumer(
      builder: (context, ref, _) {
        final reviews = ref.watch(placeReviewsQuery('${place['id'] ?? ''}')).data ?? const <_Place>[];
        final phone = '${place['phone'] ?? ''}';
        Widget stars(int value, double size, {bool tappable = false}) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var s = 1; s <= 5; s++)
              tappable
                  ? Semantics(
                      button: true,
                      selected: _reviewRating == s,
                      label: formatTr('a11y_star_n', 'Qiymət: {n}/5', {'n': s}),
                      child: GestureDetector(
                        key: ValueKey('mom-star-$s'),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _update(() => _reviewRating = s),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: s <= value ? LucideFilled(AIcons.star, size: size, color: a.yellow2) : AIcon(AIcons.star, size: size, color: a.inkFaint),
                        ),
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsetsDirectional.only(end: 4),
                      child: s <= value ? LucideFilled(AIcons.star, size: size, color: a.yellow2) : AIcon(AIcons.star, size: size, color: a.inkFaint),
                    ),
          ],
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 128,
              decoration: BoxDecoration(gradient: a.gradPink),
              child: Stack(
                children: [
                  // `rgba(122, 31, 52, 0.3)` (MomFriendlyMap.tsx literal)
                  Center(child: AIcon(cat.icon, size: 64, color: const Color(0x4D7A1F34))),
                  PositionedDirectional(
                    top: 12,
                    end: 12,
                    child: Semantics(
                      button: true,
                      label: tr('common_close', 'Bağla'),
                      child: PressScale(
                        scale: 0.95,
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          // `rgba(255,255,255,0.35)` (MomFriendlyMap.tsx literal)
                          decoration: const BoxDecoration(color: Color(0x59FFFFFF), shape: BoxShape.circle),
                          child: AIcon(AIcons.x, size: 16, color: a.alertInk),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Text(
                          '${place['name'] ?? ''}',
                          style: x.heading(px(20, weight: FontWeight.w700, color: a.ink, height: 28 / 20)),
                        ),
                        if (place['is_verified'] == true) _verifiedTag(context),
                      ],
                    ),
                  ),
                  Text('${place['address'] ?? ''}', style: px(16, color: a.inkSoft)),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(12)),
                          child: LucideFilled(AIcons.star, size: 24, color: a.warnInk),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_rating(place['avg_rating']), style: x.heading(px(24, color: a.warnInk, height: 1.25))),
                            Opacity(
                              opacity: 0.8,
                              child: Text(
                                '${place['review_count'] ?? 0} ${tr('momfriendlymap_rey_bd4873', 'rəy')}',
                                style: px(14, color: a.warnInk, height: 20 / 14),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.sparkles, size: 16, color: a.pink2),
                        const SizedBox(width: 8),
                        Text(
                          tr('momfriendlymap_imkanlar_60eb86', 'İmkanlar'),
                          style: px(16, weight: FontWeight.w700, color: a.ink),
                        ),
                      ],
                    ),
                  ),
                  if (amenities.isNotEmpty)
                    _Grid2(
                      children: [
                        for (final am in amenities)
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                            child: Row(
                              children: [
                                Text(am.icon, style: px(18, height: 28 / 18)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    am.label,
                                    style: px(14, color: a.ink, height: 20 / 14),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(tr('momfriendlymap_imkan_gosterilmeyib_1f22f8', 'İmkan göstərilməyib'), textAlign: TextAlign.center, style: x.aListSub),
                    ),
                  if (phone.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    APillButton(
                      buttonKey: const ValueKey('mom-phone'),
                      kind: APillKind.soft,
                      height: 44,
                      expand: true,
                      icon: const AIcon(AIcons.phone, size: 14, strokeWidth: 2.2),
                      label: phone,
                      onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: phone)),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.star, size: 16, color: a.yellow2),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${tr('momfriendlymap_reyler_8be233', 'Rəylər (')}${reviews.length})',
                            style: px(16, weight: FontWeight.w700, color: a.ink),
                          ),
                        ),
                        APillButton(
                          buttonKey: const ValueKey('mom-review-toggle'),
                          kind: _showReviewForm ? APillKind.soft : APillKind.cta,
                          height: 34,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          fontSize: 11,
                          background: _showReviewForm ? null : a.pink2,
                          foreground: _showReviewForm ? null : const Color(0xFFFFFFFF),
                          label: _showReviewForm ? tr('momfriendlymap_legv_et_b5e49c', 'Ləğv et') : tr('momfriendlymap_rey_yaz_7b3aab', 'Rəy yaz'),
                          onTap: () => _update(() => _showReviewForm = !_showReviewForm),
                        ),
                      ],
                    ),
                  ),
                  if (_showReviewForm)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              tr('momfriendlymap_qiymetlendirme_1fde6b', 'Qiymətləndirmə'),
                              style: px(14, weight: FontWeight.w700, color: a.berryInk, height: 20 / 14),
                            ),
                          ),
                          stars(_reviewRating, 28, tappable: true),
                          const SizedBox(height: 12),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              tr('momfriendlymap_serh_isteye_bagli_0acfd0', 'Şərh (istəyə bağlı)'),
                              style: px(14, weight: FontWeight.w700, color: a.berryInk, height: 20 / 14),
                            ),
                          ),
                          ATextArea(
                            controller: _reviewComment,
                            placeholder: tr('momfriendlymap_tecrubenizi_paylasin_aeca62', 'Təcrübənizi paylaşın...'),
                            height: 72,
                            fieldKey: const ValueKey('mom-review-comment'),
                          ),
                          const SizedBox(height: 12),
                          APillButton(
                            buttonKey: const ValueKey('mom-review-send'),
                            height: 44,
                            expand: true,
                            background: a.pink2,
                            foreground: const Color(0xFFFFFFFF),
                            opacity: _reviewRating == 0 || _addingReview ? 0.5 : 1,
                            label: _addingReview
                                ? tr('momfriendlymap_gonderilir_1d548c', 'Göndərilir...')
                                : tr('momfriendlymap_rey_gonder_027e80', 'Rəy göndər'),
                            onTap: _reviewRating == 0 || _addingReview ? null : () => _addReview(place),
                          ),
                        ],
                      ),
                    ),
                  if (reviews.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        tr('momfriendlymap_hele_rey_yoxdur_ilk_reyi_siz_yazin_156bd8', 'Hələ rəy yoxdur. İlk rəyi siz yazın!'),
                        textAlign: TextAlign.center,
                        style: x.aListSub,
                      ),
                    )
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (var i = 0; i < reviews.length; i++) ...[
                          if (i > 0) const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Row(
                                    children: [
                                      stars(reviews[i]['rating'] is num ? (reviews[i]['rating'] as num).toInt() : 0, 14),
                                      const SizedBox(width: 4),
                                      Text(() {
                                        final d = jsParseDate('${reviews[i]['created_at'] ?? ''}');
                                        return d == null ? 'Invalid Date' : localeDateString(d.toLocal());
                                      }(), style: px(12, color: a.inkSoft, height: 16 / 12)),
                                    ],
                                  ),
                                ),
                                if ('${reviews[i]['comment'] ?? ''}'.isNotEmpty)
                                  Text(
                                    '${reviews[i]['comment']}',
                                    style: px(14, color: a.ink, height: 20 / 14),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// `grid grid-cols-2 gap-2`.
class _Grid2 extends StatelessWidget {
  const _Grid2({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var r = 0; r < children.length; r += 2) ...[
        if (r > 0) const SizedBox(height: 8),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: children[r]),
              const SizedBox(width: 8),
              Expanded(child: r + 1 < children.length ? children[r + 1] : const SizedBox()),
            ],
          ),
        ),
      ],
    ],
  );
}

/// `.a-input w-full` keeping its own controller.
class _Input extends StatefulWidget {
  const _Input({required this.initial, required this.placeholder, required this.onChanged, this.fieldKey});
  final String initial;
  final String placeholder;
  final ValueChanged<String> onChanged;
  final Key? fieldKey;
  @override
  State<_Input> createState() => _InputState();
}

class _InputState extends State<_Input> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AField(fieldKey: widget.fieldKey, controller: _c, placeholder: widget.placeholder, onChanged: widget.onChanged);
}
