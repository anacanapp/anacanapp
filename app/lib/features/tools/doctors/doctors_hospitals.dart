// Ported from: src/components/tools/DoctorsHospitals.tsx
//
// Doctors & hospitals (`doctors`): providers of the user's country (search + specialty chips) and the provider
// detail (structured profile fields, contacts, hours, prices, reviews, call / directions).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../settings/ui/settings_ui.dart' show AEyebrow, AWordmark, FadeRise, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'doctors_data.dart';
import 'provider_profile.dart';
import 'provider_reviews.dart';

({String label, AIconData icon})? _typeLabel(Object? type) => switch (type) {
      'hospital' => (label: tr('doctorshospitals_xestexana_04539b', 'Xəstəxana'), icon: AIcons.building2),
      'clinic' => (label: tr('doctorshospitals_klinika_3c7a2d', 'Klinika'), icon: AIcons.building2),
      'doctor' => (label: tr('doctorshospitals_hekim_c127f7', 'Həkim'), icon: AIcons.user),
      _ => null,
    };

List<({String id, String label, String emoji})> _filters() => [
      (id: 'all', label: tr('doctorshospitals_hamisi_c73c4d', 'Hamısı'), emoji: '✨'),
      (id: 'hospital', label: tr('doctorshospitals_xestexana_04539b', 'Xəstəxana'), emoji: '🏥'),
      (id: 'gynecology', label: tr('common_ginekologiya', 'Ginekologiya'), emoji: '👩‍⚕️'),
      (id: 'ivf', label: 'IVF', emoji: '🔬'),
      (id: 'pediatrics', label: tr('common_pediatriya', 'Pediatriya'), emoji: '👶'),
      (id: 'mammology', label: tr('common_mamologiya', 'Mamologiya'), emoji: '🩺'),
    ];

Map<String, String> _dayLabels() => {
      'monday': tr('doctorshospitals_bazar_ertesi_4c733b', 'Bazar ertəsi'),
      'tuesday': tr('doctorshospitals_cersenbe_axsami_01435c', 'Çərşənbə axşamı'),
      'wednesday': tr('doctorshospitals_cersenbe_50bb90', 'Çərşənbə'),
      'thursday': tr('doctorshospitals_cume_axsami_8a8cf4', 'Cümə axşamı'),
      'friday': tr('doctorshospitals_cume_faba24', 'Cümə'),
      'saturday': tr('doctorshospitals_senbe_02045c', 'Şənbə'),
      'sunday': tr('common_bazar', 'Bazar'),
    };

String _n1(num v) => v.toStringAsFixed(1);

class DoctorsHospitals extends ConsumerStatefulWidget {
  const DoctorsHospitals({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<DoctorsHospitals> createState() => _DoctorsHospitalsState();
}

class _DoctorsHospitalsState extends ConsumerState<DoctorsHospitals> {
  final _search = TextEditingController();
  String _filter = 'all';
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final country = ref.watch(healthcareCountryProvider);
    final q = ref.watch(healthcareProvidersQuery);
    final providers = q.data ?? const <Map<String, dynamic>>[];
    final translated = translateProviders(providers, language);

    final selected = translated.where((p) => p['id'] == _selectedId).firstOrNull;
    if (selected != null) return _ProviderDetail(provider: selected, onBack: () => setState(() => _selectedId = null));

    final filtered = translated.where((p) => providerMatches(p, _filter, _search.text)).toList();
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(children: [
              ToolIconButton(
                size: 44,
                semanticLabel: tr('common_back', 'Geri'),
                onTap: widget.onBack,
                icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  AEyebrow('${tr('doctorshospitals_klinika_3c7a2d', 'Klinika')} · ${tr('doctorshospitals_hekim_c127f7', 'Həkim')}'),
                  AWordmark(tr('doctorshospitals_hekimler_ve_xestexanalar_b29ffa', 'Həkimlər və Xəstəxanalar'), fontSize: 16),
                ]),
              ),
            ]),
          ),
        ),
        Text(localizedCountryName(country, language), key: const ValueKey('healthcare-country'), style: AStyles.listSub(context)),
        const SizedBox(height: 2),
        ASearchField(fieldKey: const ValueKey('doctors-search'), controller: _search, iconSize: 15, placeholder: tr('doctorshospitals_hekim_xestexana_axtar_be2094', 'Həkim, xəstəxana axtar...')),
        Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 4),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: hgap(8, [
              for (final f in _filters())
                ATagChip(
                  on: _filter == f.id,
                  pressScale: null,
                  onTap: () => setState(() => _filter = f.id),
                  children: [Text(f.emoji), Text(f.label)],
                ),
            ])),
          ),
        ),
        const SizedBox(height: 12),
        if (q.isLoading)
          vgap(10, [
            for (var i = 0; i < 4; i++)
              APulse(
                child: ACard(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 64, height: 64, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(15))),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        ABar(height: 16, widthFactor: 0.75),
                        SizedBox(height: 8),
                        ABar(height: 12, widthFactor: 0.5),
                        SizedBox(height: 8),
                        ABar(height: 12, widthFactor: 0.66),
                      ]),
                    ),
                  ]),
                ),
              ),
          ])
        else if (filtered.isEmpty)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 10), child: AIcon(AIcons.building2, size: 40, color: a.inkFaint)),
              Text(
                providers.isEmpty
                    ? tr('doctorshospitals_bu_olke_ucun_helelik_siyahi_yoxdur', 'Ölkəniz üçün hələlik siyahı yoxdur — tezliklə əlavə olunacaq')
                    : tr('doctorshospitals_hec_bir_netice_tapilmadi_5745d9', 'Heç bir nəticə tapılmadı'),
                textAlign: TextAlign.center,
                style: AStyles.listSub(context),
              ),
            ]),
          )
        else
          vgap(10, [
            for (var i = 0; i < filtered.length; i++)
              FadeRise(delay: Duration(milliseconds: (i * 50).clamp(0, 300)), child: _providerCard(context, filtered[i])),
          ]),
      ]),
    );
  }

  Widget _providerCard(BuildContext context, Map<String, dynamic> p) {
    final a = context.a;
    final type = _typeLabel(p['provider_type']);
    final image = p['image_url'];
    final rating = (p['rating'] as num?) ?? 0;
    final reviews = (p['review_count'] as num?) ?? 0;
    final specialty = p['specialty'];
    final address = p['address'];
    return ATap(
      semanticLabel: '${p['name'] ?? ''}',
      onTap: () => setState(() => _selectedId = '${p['id']}'),
      child: ACard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 64,
            height: 64,
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(15)),
            child: image is String && image.isNotEmpty
                ? Image.network(image, width: 64, height: 64, fit: BoxFit.cover, errorBuilder: (_, _, _) => AIcon(AIcons.building2, size: 24, color: a.accentInk))
                : AIcon(AIcons.building2, size: 24, color: a.accentInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (p['is_featured'] == true)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text('⭐ ${tr('doctorshospitals_tovsiyye_olunan_626cbb', '⭐ Tövsiyyə olunan').replaceAll('⭐ ', '')}', style: px(10, weight: FontWeight.w800, color: a.yellowInk)),
                      ),
                    Text('${p['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listTitle(context)),
                  ]),
                ),
                const SizedBox(width: 8),
                Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true)),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(children: [
                  AIcon(type?.icon ?? AIcons.building2, size: 11, color: a.peach2),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: type?.label ?? '${p['provider_type'] ?? ''}'),
                        if (specialty is String && specialty.isNotEmpty) TextSpan(text: ' · $specialty', style: TextStyle(color: a.inkSoft)),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: px(11.5, weight: FontWeight.w600, color: a.peach2),
                    ),
                  ),
                ]),
              ),
              if (address is String && address.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.mapPin, size: 11, color: a.inkSoft)),
                    const SizedBox(width: 4),
                    Expanded(child: Text(address, maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listSub(context))),
                  ]),
                ),
              if (rating > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(children: [
                    LucideFilled(AIcons.star, size: 12, color: a.yellow2),
                    const SizedBox(width: 4),
                    Text(_n1(rating), style: px(12, weight: FontWeight.w800, color: a.ink)),
                    if (reviews > 0) ...[const SizedBox(width: 4), Text('(${reviews.toInt()})', style: px(10.5, weight: FontWeight.w600, color: a.inkFaint))],
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _ProviderDetail extends ConsumerWidget {
  const _ProviderDetail({required this.provider, required this.onBack});
  final Map<String, dynamic> provider;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final id = '${provider['id']}';
    ref.watch(providerReviewsLiveProvider(id));
    final latest = ref.watch(healthcareProviderQuery(id)).data;
    final rating = (latest?['rating'] as num?) ?? (provider['rating'] as num?) ?? 0;
    final reviewCount = (latest?['review_count'] as num?) ?? (provider['review_count'] as num?) ?? 0;
    final type = _typeLabel(provider['provider_type']);
    // Language-robust: translated profiles keep their "Header: value" lines.
    final profile = parseProviderProfile(provider['description'] as String?);
    final fields = profile.fields;
    final other = profile.entries.where((e) => e.field == null || e.field == 'master').toList();
    final address = provider['address'] as String?;
    final city = provider['city'] as String?;
    final phone = provider['phone'] as String?;
    final email = provider['email'] as String?;
    final website = provider['website'] as String?;
    final mapsUrl = directionsUrl(address: address, city: city, latitude: provider['latitude'] as num?, longitude: provider['longitude'] as num?);
    final image = provider['image_url'];
    final hasImage = image is String && image.isNotEmpty;
    final hours = provider['working_hours'] is Map ? Map<String, dynamic>.from(provider['working_hours'] as Map) : null;
    final services = provider['services'] is List ? provider['services'] as List : null;
    final days = _dayLabels();
    final specialty = provider['specialty'];
    void open(Uri uri) => ref.read(healthLinkLauncherProvider)(uri);

    Widget contactRow(Gradient grad, Color ink, AIconData icon, String label, String value, {VoidCallback? onTap, bool link = false, bool ellipsis = false}) => AListRowBox(
          onTap: onTap,
          semanticLabel: label,
          children: [
            AListIconBox(gradient: grad, color: ink, child: AIcon(icon, size: 17, color: ink)),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: AStyles.listSub(context)),
                Text(value, maxLines: ellipsis ? 1 : null, overflow: ellipsis ? TextOverflow.ellipsis : null, style: AStyles.listTitle(context, color: link ? a.accentInk : null)),
              ]),
            ),
          ],
        );

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(
              height: hasImage ? 192 : 64,
              child: Stack(fit: StackFit.expand, children: [
                if (hasImage) ...[
                  DecoratedBox(decoration: BoxDecoration(gradient: a.gradPeach)),
                  Image.network(image, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
                ],
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [a.bg, a.bg.withValues(alpha: 0)], stops: const [0, 0.6]),
                  ),
                ),
                PositionedDirectional(
                  top: 16,
                  start: 16,
                  child: ToolIconButton(semanticLabel: tr('common_back', 'Geri'), onTap: onBack, icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
                ),
              ]),
            ),
            Transform.translate(
              offset: Offset(0, hasImage ? -48 : 0),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ACard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (provider['is_featured'] == true)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(tr('doctorshospitals_tovsiyye_olunan_626cbb', '⭐ Tövsiyyə olunan'), style: px(10, weight: FontWeight.w800, color: a.yellowInk)),
                          ),
                        Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('${provider['name'] ?? ''}', style: AStyles.heading(context, 19))),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(children: [
                            AIcon(type?.icon ?? AIcons.building2, size: 13, color: a.peach2),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text.rich(
                                TextSpan(children: [
                                  TextSpan(text: type?.label ?? ''),
                                  if (specialty is String && specialty.isNotEmpty) TextSpan(text: ' · $specialty', style: TextStyle(color: a.inkSoft)),
                                ]),
                                style: px(11.5, weight: FontWeight.w600, color: a.peach2),
                              ),
                            ),
                          ]),
                        ),
                        if (reviewCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(children: [
                              for (var s = 1; s <= 5; s++)
                                Padding(
                                  padding: const EdgeInsets.only(right: 2),
                                  child: s <= rating.round() ? LucideFilled(AIcons.star, size: 15, color: a.yellow2) : AIcon(AIcons.star, size: 15, color: a.lineStrong),
                                ),
                              const SizedBox(width: 6),
                              Text(rating > 0 ? _n1(rating) : '0.0', style: px(13, weight: FontWeight.w800, color: a.ink)),
                              const SizedBox(width: 8),
                              Text('(${reviewCount.toInt()} ${tr('doctorshospitals_rey_f2285f', 'rəy)')}', style: AStyles.listSub(context)),
                            ]),
                          ),
                        if (fields['experience'] != null || fields['languages'] != null || fields['education'] != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Wrap(spacing: 8, runSpacing: 8, children: [
                              if (fields['experience'] != null)
                                ATagChip(background: a.peach1, color: a.accentInk, children: [const AIcon(AIcons.briefcase, size: 11), Flexible(child: Text(fields['experience']!))]),
                              if (fields['languages'] != null)
                                ATagChip(background: a.blue1, color: a.blueInk, children: [const AIcon(AIcons.languages, size: 11), Flexible(child: Text(fields['languages']!))]),
                              if (fields['education'] != null)
                                ATagChip(background: a.green1, color: a.greenInk, children: [const AIcon(AIcons.graduationCap, size: 11), Flexible(child: Text(fields['education']!))]),
                            ]),
                          ),
                        if (other.isNotEmpty)
                          Padding(
                            key: const ValueKey('provider-profile-fields'),
                            padding: const EdgeInsets.only(bottom: 12),
                            child: vgap(6, [
                              for (final e in other)
                                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(e.label, style: AStyles.listSub(context)),
                                  Text(e.value, style: AStyles.listTitle(context)),
                                ]),
                            ], cross: CrossAxisAlignment.start),
                          ),
                        if (profile.basicDescription.isNotEmpty) Text(profile.basicDescription, style: AStyles.ctaText(context)),
                      ]),
                    ),
                  ),
                  if (fields['interests'] != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ACard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('❤️ ${tr('doctorshospitals_maraq_saheleri', 'Maraq sahələri')}', style: AStyles.cardTitle(context))),
                          Wrap(spacing: 8, runSpacing: 8, children: [for (final s in splitProfileList(fields['interests']!)) ATagChip(children: [Text(s)])]),
                        ]),
                      ),
                    ),
                  if (fields['services'] != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ACard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('🩺 ${tr('doctorshospitals_xidmetler', 'Xidmətlər')}', style: AStyles.cardTitle(context))),
                          vgap(8, [
                            for (final s in splitProfileList(fields['services']!))
                              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Container(width: 6, height: 6, margin: const EdgeInsets.only(top: 6), decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle)),
                                const SizedBox(width: 8),
                                Expanded(child: Text(s, style: AStyles.listSub(context))),
                              ]),
                          ]),
                        ]),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AListCardBox(children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                        child: Text(tr('doctorshospitals_elaqe_melumatlari_ddd442', 'Əlaqə məlumatları'), style: AStyles.cardTitle(context)),
                      ),
                      if (address != null && address.isNotEmpty)
                        contactRow(a.gradPeach, a.accentInk, AIcons.mapPin, tr('doctorshospitals_unvan_b8651a', 'Ünvan'), '$address${city != null && city.isNotEmpty ? ', $city' : ''}'),
                      if (phone != null && phone.isNotEmpty)
                        contactRow(a.gradGreen, a.greenInk, AIcons.phone, tr('untranslated_telefon_vwjgg5', 'Telefon'), phone, link: true, onTap: () => open(Uri(scheme: 'tel', path: phone))),
                      if (email != null && email.isNotEmpty)
                        contactRow(a.gradBlue, a.blueInk, AIcons.mail, tr('doctorshospitals_e_poct_f5c193', 'E-poçt'), email, link: true, onTap: () => open(Uri(scheme: 'mailto', path: email))),
                      if (website != null && website.isNotEmpty)
                        contactRow(a.gradLav, a.lavInk, AIcons.globe, tr('untranslated_vebsayt_7bupzh', 'Vebsayt'), website, link: true, ellipsis: true, onTap: () {
                          final uri = Uri.tryParse(website);
                          if (uri != null) open(uri);
                        }),
                    ]),
                  ),
                  if (hours != null && hours.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ACard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('🕐 ${tr('doctorshospitals_is_saatlari_cfa6fe', 'İş saatları')}', style: AStyles.cardTitle(context))),
                          vgap(8, [
                            for (final e in hours.entries)
                              Row(children: [
                                Expanded(child: Text(days[e.key] ?? e.key, style: AStyles.listSub(context))),
                                Text('${e.value}', style: AStyles.listValue(context, color: a.ink)),
                              ]),
                          ]),
                        ]),
                      ),
                    ),
                  if (services != null && services.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ACard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('💰 ${tr('doctorshospitals_xidmetler_ve_qiymetler_8e63a7', 'Xidmətlər və qiymətlər')}', style: AStyles.cardTitle(context))),
                          for (var i = 0; i < services.length; i++)
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                              child: Row(children: [
                                Expanded(child: Text('${(services[i] is Map ? services[i]['name'] : null) ?? ''}', style: AStyles.listSub(context))),
                                const SizedBox(width: 8),
                                ARankTagBox('${(services[i] is Map ? services[i]['price'] : null) ?? ''} AZN', background: a.peach1, color: a.accentInk),
                              ]),
                            ),
                        ]),
                      ),
                    ),
                  ProviderReviews(providerId: id, providerName: '${provider['name'] ?? ''}'),
                  // Online booking is not available: the actions are a call and directions when known.
                  if ((phone != null && phone.isNotEmpty) || mapsUrl != null)
                    Padding(
                      key: const ValueKey('provider-actions'),
                      padding: const EdgeInsets.only(top: 12),
                      child: Row(children: hgap(8, [
                        if (phone != null && phone.isNotEmpty)
                          Expanded(
                            child: APillButton(
                              buttonKey: const ValueKey('provider-call'),
                              kind: APillKind.solid,
                              label: tr('p3a_doctors_call', 'Zəng et'),
                              icon: const AIcon(AIcons.phone, size: 15, strokeWidth: 2.2),
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                              expand: true,
                              onTap: () => open(Uri(scheme: 'tel', path: phone)),
                            ),
                          ),
                        if (mapsUrl != null)
                          Expanded(
                            child: APillButton(
                              buttonKey: const ValueKey('provider-directions'),
                              kind: APillKind.soft,
                              label: tr('p3a_doctors_directions', 'Yol tarifi'),
                              icon: const AIcon(AIcons.navigation, size: 15, strokeWidth: 2.2),
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                              expand: true,
                              onTap: () => open(Uri.parse(mapsUrl)),
                            ),
                          ),
                      ])),
                    ),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
