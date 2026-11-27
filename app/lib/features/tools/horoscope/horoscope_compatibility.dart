// Ported from: src/components/tools/HoroscopeCompatibility.tsx
//
// Family birth chart (`horoscope`): mother (required) / father / baby (or expected due date) birth data in three
// steps, the daily free limit, `analyze-horoscope` behind a full-screen "reading the stars" overlay, the saved reading
// and the result view (score, charts, analysis cards, recommendations, lucky items, share).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart' show RowFields;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, AEyebrow, AWordmark, FadeRise, ShadSelect, ShadSwitch, px;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_ports.dart';
import 'date_picker_wheel.dart';
import 'horoscope_data.dart';

/// `PersonData`.
class HoroscopePerson {
  const HoroscopePerson({this.birthDate, this.birthTime = '', this.hasBirthTime = false});
  final DateTime? birthDate;
  final String birthTime;
  final bool hasBirthTime;

  HoroscopePerson copyWith({Object? birthDate = _keep, String? birthTime, bool? hasBirthTime}) => HoroscopePerson(
    birthDate: identical(birthDate, _keep) ? this.birthDate : birthDate as DateTime?,
    birthTime: birthTime ?? this.birthTime,
    hasBirthTime: hasBirthTime ?? this.hasBirthTime,
  );
}

const Object _keep = Object();

/// `TIME_OPTIONS`: 00:00 … 23:30.
final List<String> kHoroscopeTimeOptions = [
  for (var h = 0; h < 24; h++) ...['${h.toString().padLeft(2, '0')}:00', '${h.toString().padLeft(2, '0')}:30'],
];

/// The `analyze-horoscope` body (without `language`).
Map<String, String> horoscopePayload({
  required HoroscopePerson mom,
  required HoroscopePerson dad,
  required HoroscopePerson baby,
  required bool isBabyExpected,
  DateTime? expectedDueDate,
}) {
  final payload = <String, String>{'mom_birth_date': isoDay(mom.birthDate!)};
  if (mom.hasBirthTime) payload['mom_birth_time'] = mom.birthTime;
  if (dad.birthDate != null) {
    payload['dad_birth_date'] = isoDay(dad.birthDate!);
    if (dad.hasBirthTime) payload['dad_birth_time'] = dad.birthTime;
  }
  if (isBabyExpected && expectedDueDate != null) {
    payload['baby_due_date'] = isoDay(expectedDueDate);
  } else if (baby.birthDate != null) {
    payload['baby_birth_date'] = isoDay(baby.birthDate!);
    if (baby.hasBirthTime) payload['baby_birth_time'] = baby.birthTime;
  }
  return payload;
}

/// `getScoreMessage(score)`.
String horoscopeScoreMessage(num score) {
  if (score >= 90) return tr('horoscopecompatibility_mukemmel_kosmik_harmoniya_d98359', '💫 Mükəmməl kosmik harmoniya!');
  if (score >= 80) return tr('horoscopecompatibility_ela_uygunluq_3b4329', '🌟 Əla uyğunluq!');
  if (score >= 70) return tr('horoscopecompatibility_cox_yaxsi_enerji_axini_17ac98', '✨ Çox yaxşı enerji axını');
  if (score >= 60) return tr('horoscopecompatibility_guclu_bag_555d3b', '💪 Güclü bağ');
  if (score >= 50) return tr('horoscopecompatibility_tarazli_elaqe_8d9302', '🤝 Tarazlı əlaqə');
  return tr('horoscopecompatibility_ferqlilik_gucunuzdur_67c1a4', '💝 Fərqlilik gücünüzdür!');
}

String _elementName(String element) => switch (element) {
  'fire' => tr('horoscope_element_fire', 'Od'),
  'water' => tr('horoscope_element_water', 'Su'),
  'air' => tr('horoscope_element_air', 'Hava'),
  'earth' => tr('horoscope_element_earth', 'Torpaq'),
  _ => '',
};

AIconData? _elementIcon(String element) => switch (element) {
  'fire' => AIcons.flame,
  'water' => AIcons.droplets,
  'air' => AIcons.wind,
  'earth' => AIcons.mountain,
  _ => null,
};

Map<String, dynamic> _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<String> _list(Object? v) => [for (final e in (v is List ? v : const [])) '$e'];

/// The share text of the result.
String horoscopeShareText(Map<String, dynamic> result) {
  final charts = _map(result['charts']);
  final analysis = _map(result['analysis']);
  final mom = _map(_map(charts['mom'])['sun']);
  final dad = charts['dad'] is Map ? _map(_map(charts['dad'])['sun']) : null;
  final babyChart = charts['baby'] is Map ? _map(charts['baby']) : null;
  final baby = babyChart == null ? null : _map(babyChart['sun']);
  return '${tr('horoscope_share_title', '✨ Ailə Doğum Xəritəsi Analizi ✨')}\n'
      '\n'
      '👩 ${tr('horoscope_share_mom', 'Ana')}: ${mom['symbol'] ?? ''} ${mom['signAz'] ?? ''}\n'
      '${dad != null ? '👨 ${tr('horoscope_share_dad', 'Ata')}: ${dad['symbol'] ?? ''} ${dad['signAz'] ?? ''}' : ''}\n'
      '${baby != null ? '👶 ${babyChart!['isExpected'] == true ? tr('horoscopecompatibility_gozlenilen_4885bf', 'Gözlənilən') : ''} ${tr('horoscope_share_baby', 'Körpə')}: ${baby['symbol'] ?? ''} ${baby['signAz'] ?? ''}' : ''}\n'
      '\n'
      '🌟 ${tr('horoscope_share_compatibility', 'Ümumi Uyğunluq')}: ${analysis['overallScore']}%\n'
      '\n'
      '${tr('horoscope_share_footer', 'Anacan tətbiqi ilə yaradılıb 💜')}';
}

/// `LOADING_STEPS`.
List<({AIconData icon, String text, Color color})> _loadingSteps() => [
  (icon: AIcons.star, text: tr('horoscope_reading_stars', 'Ulduzlar oxunur...'), color: const Color(0xFFEAB308)), // text-yellow-500
  (
    icon: AIcons.moon,
    text: tr('horoscopecompatibility_ay_fazasi_hesablanir_63cb3c', 'Ay fazası hesablanır...'),
    color: const Color(0xFF60A5FA),
  ), // text-blue-400
  (
    icon: AIcons.sun,
    text: tr('horoscopecompatibility_gunes_movqeyi_teyin_edilir_bfba89', 'Günəş mövqeyi təyin edilir...'),
    color: const Color(0xFFF97316),
  ), // text-orange-500
  (
    icon: AIcons.compass,
    text: tr('horoscopecompatibility_yukselen_burc_axtarilir_f2408d', 'Yüksələn bürc axtarılır...'),
    color: const Color(0xFFC084FC),
  ), // text-purple-400
  (
    icon: AIcons.heart,
    text: tr('horoscopecompatibility_uygunluq_analiz_edilir_bca7bd', 'Uyğunluq analiz edilir...'),
    color: const Color(0xFFF472B6),
  ), // text-pink-400
  (
    icon: AIcons.sparkles,
    text: tr('horoscopecompatibility_kosmik_tovsiyeler_hazirlanir_25cfbf', 'Kosmik tövsiyələr hazırlanır...'),
    color: const Color(0xFF22D3EE),
  ), // text-cyan-400
];

class HoroscopeCompatibility extends ConsumerStatefulWidget {
  const HoroscopeCompatibility({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<HoroscopeCompatibility> createState() => _HoroscopeCompatibilityState();
}

class _HoroscopeCompatibilityState extends ConsumerState<HoroscopeCompatibility> {
  int _step = 1;
  HoroscopePerson _mom = const HoroscopePerson();
  HoroscopePerson _dad = const HoroscopePerson();
  late HoroscopePerson _baby;
  late bool _isBabyExpected;
  DateTime? _expectedDueDate;
  bool _isAnalyzing = false;
  int _loadingStep = 0;
  Map<String, dynamic>? _result;
  OverlayEntry? _overlay;
  Timer? _stepInterval;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(authProfileProvider);
    final birth = profile?.row.date('baby_birth_date');
    _baby = HoroscopePerson(birthDate: birth);
    _isBabyExpected = (profile?.babyBirthDate ?? '').isEmpty;
    _expectedDueDate = profile?.row.date('expected_due_date');
  }

  @override
  void dispose() {
    _stepInterval?.cancel();
    _overlay?.remove();
    _overlay = null;
    super.dispose();
  }

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  void _syncOverlay() {
    if (_isAnalyzing && _overlay == null) {
      _overlay = OverlayEntry(builder: (_) => _LoadingOverlay(step: _loadingStep));
      Overlay.of(context, rootOverlay: true).insert(_overlay!);
    } else if (!_isAnalyzing && _overlay != null) {
      _overlay!.remove();
      _overlay = null;
    } else {
      _overlay?.markNeedsBuild();
    }
  }

  void _setAnalyzing(bool value) {
    if (!mounted) return;
    setState(() => _isAnalyzing = value);
    _syncOverlay();
  }

  Future<void> _analyze() async {
    if (_mom.birthDate == null) {
      _toast(MediaToastData(title: tr('horoscopecompatibility_ananin_dogum_tarixini_daxil_ed_d186ab', 'Ananın doğum tarixini daxil edin'), sonner: 'error'));
      return;
    }
    final decision = await ref.read(mediaUsageProvider).checkAndConsume('horoscope');
    if (!mounted) return;
    if (!decision.allowed) {
      unawaited(ref.read(mediaPremiumModalProvider)(context, 'horoscope'));
      return;
    }
    setState(() => _loadingStep = 0);
    _setAnalyzing(true);
    final steps = _loadingSteps().length;
    _stepInterval = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      if (!mounted) return;
      setState(() => _loadingStep = _loadingStep < steps - 1 ? _loadingStep + 1 : _loadingStep);
      _syncOverlay();
    });
    try {
      final payload = horoscopePayload(mom: _mom, dad: _dad, baby: _baby, isBabyExpected: _isBabyExpected, expectedDueDate: _expectedDueDate);
      final res = await ref.read(mediaDbProvider).invoke('analyze-horoscope', body: {...payload, 'language': ref.read(mediaLanguageProvider)()});
      _stepInterval?.cancel();
      if (res.error != null) throw res.error!;
      final data = _map(res.data);
      if (mounted) setState(() => _result = data);
      final charts = _map(data['charts']);
      String? sign(Object? chart) => chart is Map ? '${_map(_map(chart)['sun'])['sign']}' : null;
      await ref.read(saveHoroscopeReadingProvider)({
        'mom_sign': sign(charts['mom']),
        'dad_sign': ?sign(charts['dad']),
        'baby_sign': ?sign(charts['baby']),
        'compatibility_result': data,
      });
      _toast(MediaToastData(title: tr('horoscopecompatibility_analiz_tamamlandi_cd8c9d', 'Analiz tamamlandı!'), sonner: 'success'));
    } catch (_) {
      _toast(MediaToastData(title: tr('horoscopecompatibility_analiz_zamani_xeta_bas_verdi_66508c', 'Analiz zamanı xəta baş verdi'), sonner: 'error'));
      _stepInterval?.cancel();
    } finally {
      _setAnalyzing(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _resultView(context, result);
    final a = context.a;
    final signs = ref.watch(zodiacSignsQuery).data ?? const <Map<String, dynamic>>[];
    final steps = [
      (id: 1, title: tr('common_ana', 'Ana'), emoji: '👩'),
      (id: 2, title: tr('common_ata', 'Ata'), emoji: '👨'),
      (id: 3, title: tr('horoscopecompatibility_korpe_fa2b51', 'Körpə'), emoji: '👶'),
    ];

    Widget stepContent;
    switch (_step) {
      case 1:
        stepContent = _PersonInput(
          label: tr('horoscopecompatibility_ananin_dogum_melumatlari_61548b', 'Ananın Doğum Məlumatları'),
          emoji: '👩',
          data: _mom,
          onChanged: (d) => setState(() => _mom = d),
          signs: signs,
          isRequired: true,
        );
      case 2:
        stepContent = _PersonInput(
          label: tr('horoscopecompatibility_atanin_dogum_melumatlari_fef9a1', 'Atanın Doğum Məlumatları'),
          emoji: '👨',
          data: _dad,
          onChanged: (d) => setState(() => _dad = d),
          signs: signs,
          isOptional: true,
        );
      default:
        final now = DateTime.now();
        stepContent = vgap(16, [
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                const Text('🤰', style: TextStyle(fontSize: 24)),
                const SizedBox(width: 12),
                Expanded(child: Text(tr('horoscopecompatibility_korpe_hele_dogulmayib_b729e6', 'Körpə hələ doğulmayıb'), style: AStyles.listTitle(context))),
                ShadSwitch(key: const ValueKey('horo-expected'), checked: _isBabyExpected, onChanged: (v) => setState(() => _isBabyExpected = v)),
              ],
            ),
          ),
          if (_isBabyExpected)
            ACard(
              color: a.pink1,
              child: vgap(12, [
                Row(
                  children: [
                    AIcon(AIcons.calendar, size: 16, color: a.berryInk),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tr('horoscopecompatibility_gozlenilen_dogum_tarixi_a01877', 'Gözlənilən Doğum Tarixi'),
                        style: px(16, weight: FontWeight.w700, color: a.berryInk),
                      ),
                    ),
                  ],
                ),
                DatePickerWheel(
                  value: _expectedDueDate,
                  onChanged: (d) => setState(() => _expectedDueDate = d),
                  minYear: now.year,
                  maxYear: now.year + 1,
                  disabled: (d) => d.isBefore(DateTime.now()),
                  placeholder: tr('horoscopecompatibility_gozlenilen_tarix_secin_fdf25e', 'Gözlənilən tarix seçin'),
                ),
              ]),
            )
          else
            _PersonInput(
              label: tr('horoscopecompatibility_korpenin_dogum_melumatlari_4ef9a4', 'Körpənin Doğum Məlumatları'),
              emoji: '👶',
              data: _baby,
              onChanged: (d) => setState(() => _baby = d),
              signs: signs,
              isOptional: true,
            ),
        ]);
    }

    final momMissing = _mom.birthDate == null;
    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('horoscopecompatibility_aile_dinamikasi_ee22f4', 'Ailə Dinamikası'),
            title: tr('horoscopecompatibility_ulduz_fali_344189', 'Ulduz Falı'),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                for (final s in steps) ...[
                  if (s.id > 1) const SizedBox(width: 8),
                  Expanded(
                    child: ATap(
                      onTap: () {
                        if (s.id <= _step) setState(() => _step = s.id);
                      },
                      child: Container(
                        key: ValueKey('horo-step-${s.id}'),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _step == s.id ? a.lav2 : (_step > s.id ? a.lav1 : a.surface),
                          borderRadius: BorderRadius.circular(999),
                          border: _step < s.id ? Border.all(color: a.line) : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_step > s.id) AIcon(AIcons.check, size: 12, color: a.lavInk) else Text(s.emoji, style: const TextStyle(fontSize: 12)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                s.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: px(12, weight: FontWeight.w700, color: _step == s.id ? const Color(0xFFFFFFFF) : (_step > s.id ? a.lavInk : a.inkSoft)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          vgap(16, [
            _disclaimer(context),
            KeyedSubtree(
              key: ValueKey('horo-content-$_step'),
              child: FadeRise(dx: 20, dy: 0, child: stepContent),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  if (_step > 1) ...[
                    Expanded(
                      child: APillButton(
                        kind: APillKind.soft,
                        label: tr('horoscope_back', 'Geri'),
                        icon: AIcon(AIcons.arrowLeft, size: 15, strokeWidth: 2.2, color: a.accentInk, mirrorInRtl: true),
                        height: 48,
                        expand: true,
                        onTap: () => setState(() => _step--),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: _step < 3
                        ? APillButton(
                            buttonKey: const ValueKey('horo-next'),
                            label: tr('horoscopecompatibility_novbeti_6e8661', 'Növbəti'),
                            trailingIcon: const AIcon(AIcons.arrowRight, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF), mirrorInRtl: true),
                            height: 48,
                            expand: true,
                            background: a.lav2,
                            onTap: _step == 1 && momMissing ? null : () => setState(() => _step++),
                          )
                        : APillButton(
                            buttonKey: const ValueKey('horo-analyze'),
                            label: tr('horoscope_analyze_now', 'Analiz Et'),
                            icon: _isAnalyzing
                                ? const ALoader(size: 20, color: Color(0xFFFFFFFF))
                                : const AIcon(AIcons.sparkles, size: 16, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                            height: 48,
                            expand: true,
                            background: a.lav2,
                            disabledOpacity: 0.6,
                            onTap: momMissing || _isAnalyzing ? null : () => unawaited(_analyze()),
                          ),
                  ),
                ],
              ),
            ),
            ACard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.star, size: 16, color: a.yellow2),
                        const SizedBox(width: 8),
                        Text(tr('horoscopecompatibility_burcler_bb45a3', 'Bürclər'), style: AStyles.cardTitle(context)),
                      ],
                    ),
                  ),
                  AGridCols(
                    columns: 6,
                    gap: 8,
                    children: [
                      for (final sign in signs)
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            children: [
                              Text('${sign['symbol'] ?? ''}', style: const TextStyle(fontSize: 20, height: 28 / 20)),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  '${sign['name'] ?? ''}',
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  style: px(10, color: a.inkSoft, height: 1.25),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _disclaimer(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(16)),
      child: Text(
        '✨ ${tr('horoscope_entertainment_disclaimer', 'Ulduz falı yalnız əyləncə məqsədi daşıyır. Tibbi, psixoloji və ya valideynlik qərarları üçün ixtisaslı mütəxəssisə (həkim/psixoloq) müraciət edin.')}',
        style: px(11, color: a.lavInk, height: 1.625),
      ),
    );
  }

  ({Gradient grad, Color ink}) _scoreStyle(ATokens a, num score) {
    if (score >= 80) return (grad: a.gradGreen, ink: a.greenInk);
    if (score >= 60) return (grad: a.gradYellow, ink: a.warnInk);
    if (score >= 40) return (grad: a.gradPeach, ink: a.accentInk);
    return (grad: a.gradPink, ink: a.alertInk);
  }

  Widget _resultView(BuildContext context, Map<String, dynamic> result) {
    final a = context.a;
    final charts = _map(result['charts']);
    final analysis = _map(result['analysis']);
    final score = analysis['overallScore'] is num ? analysis['overallScore'] as num : 0;
    final style = _scoreStyle(a, score);
    final dad = charts['dad'] is Map ? _map(charts['dad']) : null;
    final baby = charts['baby'] is Map ? _map(charts['baby']) : null;
    String text(String k) => analysis[k] is String ? analysis[k] as String : '';
    final recommendations = _list(analysis['recommendations']);
    final luckyColors = _list(analysis['luckyColors']);
    final luckyDays = _list(analysis['luckyDays']);
    final luckyNumbers = _list(analysis['luckyNumbers']);

    Widget lucky(Color bg, Color labelInk, Color valueInk, AIconData icon, String label, List<String> values) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AIcon(icon, size: 24, color: labelInk),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Opacity(
              opacity: 0.8,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: px(12, color: labelInk),
              ),
            ),
          ),
          Text(
            values.join(', '),
            textAlign: TextAlign.center,
            style: px(12, weight: FontWeight.w700, color: valueInk),
          ),
        ],
      ),
    );

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  ToolIconButton(
                    key: const ValueKey('horo-result-back'),
                    size: 44,
                    semanticLabel: tr('common_back', 'Geri'),
                    icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true),
                    onTap: () => setState(() => _result = null),
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AEyebrow(tr('horoscopecompatibility_ulduz_fali_344189', 'Ulduz Falı')),
                        AWordmark(tr('horoscopecompatibility_neticeniz_d14591', 'Nəticəniz'), fontSize: 16),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: FadeRise(
              dy: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 26),
                decoration: BoxDecoration(gradient: style.grad, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
                child: Column(
                  children: [
                    Text('$score%', style: AStyles.heading(context, 56, color: style.ink)),
                    Text(
                      horoscopeScoreMessage(score),
                      textAlign: TextAlign.center,
                      style: AStyles.heading(context, 20, color: style.ink),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final k in _list(analysis['keywords']))
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                              decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(999)),
                              child: Text(
                                k,
                                style: px(14, weight: FontWeight.w600, color: style.ink),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          vgap(12, [
            _disclaimer(context),
            ACard(
              child: vgap(16, [
                Row(
                  children: [
                    AIcon(AIcons.sun, size: 20, color: a.yellow2),
                    const SizedBox(width: 8),
                    Text(tr('horoscopecompatibility_dogum_xeriteleri_c9a3ce', 'Doğum Xəritələri'), style: AStyles.cardTitle(context)),
                  ],
                ),
                _BirthChartCard(chart: _map(charts['mom']), label: tr('common_ana', 'Ana'), emoji: '👩'),
                if (dad != null) _BirthChartCard(chart: dad, label: tr('common_ata', 'Ata'), emoji: '👨'),
                if (baby != null)
                  _BirthChartCard(
                    chart: baby,
                    label: baby['isExpected'] == true
                        ? tr('horoscopecompatibility_gozlenilen_korpe_62132c', 'Gözlənilən Körpə')
                        : tr('horoscopecompatibility_korpe_fa2b51', 'Körpə'),
                    emoji: '👶',
                  ),
              ]),
            ),
            if (text('momAnalysis').isNotEmpty)
              _AnalysisCard(title: tr('horoscope_ana_analizi', 'Ana Analizi'), emoji: '👩', content: text('momAnalysis'), bg: a.pink1, ink: a.berryInk),
            if (text('dadAnalysis').isNotEmpty && dad != null)
              _AnalysisCard(title: tr('horoscope_ata_analizi', 'Ata Analizi'), emoji: '👨', content: text('dadAnalysis'), bg: a.blue1, ink: a.blueInk),
            if (text('babyAnalysis').isNotEmpty && baby != null)
              _AnalysisCard(
                title: baby['isExpected'] == true
                    ? tr('horoscopecompatibility_korpe_proqnozu_3079df', 'Körpə Proqnozu')
                    : tr('horoscopecompatibility_korpe_analizi_f790ae', 'Körpə Analizi'),
                emoji: '👶',
                content: text('babyAnalysis'),
                bg: a.yellow1,
                ink: a.warnInk,
              ),
            if (text('familyDynamics').isNotEmpty)
              _AnalysisCard(
                title: tr('horoscopecompatibility_aile_dinamikasi_ee22f4', 'Ailə Dinamikası'),
                icon: AIcons.users,
                content: text('familyDynamics'),
                bg: a.lav1,
                ink: a.lavInk,
              ),
            if (text('momBabyConnection').isNotEmpty && baby != null)
              _AnalysisCard(
                title: tr('horoscopecompatibility_ana_korpe_kosmik_bagi_deb848', 'Ana-Körpə Kosmik Bağı'),
                icon: AIcons.heart,
                content: text('momBabyConnection'),
                bg: a.pink1,
                ink: a.berryInk,
              ),
            if (text('parentCompatibility').isNotEmpty && dad != null)
              _AnalysisCard(
                title: tr('horoscopecompatibility_valideynler_uygunlugu_27180e', 'Valideynlər Uyğunluğu'),
                icon: AIcons.zap,
                content: text('parentCompatibility'),
                bg: a.peach1,
                ink: a.accentInk,
              ),
            if (recommendations.isNotEmpty)
              ACard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          AIcon(AIcons.book, size: 20, color: a.lav2),
                          const SizedBox(width: 8),
                          Text(tr('horoscopecompatibility_kosmik_tovsiyeler_d95708', 'Kosmik Tövsiyələr'), style: AStyles.cardTitle(context)),
                        ],
                      ),
                    ),
                    vgap(12, [
                      for (var i = 0; i < recommendations.length; i++)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: a.lav1, shape: BoxShape.circle),
                              child: Text(
                                '${i + 1}',
                                style: px(12, weight: FontWeight.w700, color: a.lavInk, height: 1),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(recommendations[i], style: px(14, color: a.bodyText)),
                            ),
                          ],
                        ),
                    ]),
                  ],
                ),
              ),
            AGridCols(
              columns: 3,
              gap: 12,
              children: [
                if (luckyColors.isNotEmpty)
                  lucky(a.pink1, a.berryInk, a.alertInk, AIcons.palette, tr('horoscopecompatibility_ugurlu_rengler_e52ad0', 'Uğurlu rənglər'), luckyColors),
                if (luckyDays.isNotEmpty)
                  lucky(a.blue1, a.blueInk, a.blueInk, AIcons.calendar, tr('horoscopecompatibility_ugurlu_gunler_6caab8', 'Uğurlu günlər'), luckyDays),
                if (luckyNumbers.isNotEmpty)
                  lucky(a.green1, a.greenInk, a.greenInk, AIcons.hash, tr('horoscopecompatibility_xosbext_reqemler_4d0da9', 'Xoşbəxt rəqəmlər'), luckyNumbers),
              ],
            ),
            APillButton(
              buttonKey: const ValueKey('horo-share'),
              kind: APillKind.soft,
              label: tr('horoscopecompatibility_neticeni_paylas_28650c', 'Nəticəni Paylaş'),
              icon: AIcon(AIcons.share2, size: 15, strokeWidth: 2.2, color: a.accentInk),
              height: 48,
              expand: true,
              onTap: () => unawaited(ref.read(mediaShareProvider)(text: horoscopeShareText(result))),
            ),
          ]),
        ],
      ),
    );
  }
}

/// `PersonInput`.
class _PersonInput extends StatelessWidget {
  const _PersonInput({
    required this.label,
    required this.emoji,
    required this.data,
    required this.onChanged,
    required this.signs,
    this.isRequired = false,
    this.isOptional = false,
  });
  final String label;
  final String emoji;
  final HoroscopePerson data;
  final ValueChanged<HoroscopePerson> onChanged;
  final List<Map<String, dynamic>> signs;
  final bool isRequired;
  final bool isOptional;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sign = getZodiacSign(data.birthDate, signs);
    final element = '${sign?['element'] ?? ''}';
    final elementIcon = _elementIcon(element);
    return ACard(
      child: vgap(16, [
        Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(label, style: AStyles.heading(context, 16, color: a.ink)),
            ),
            if (isOptional) ARankTagBox(tr('horoscopecompatibility_ixtiyari_4d9763', 'İxtiyari'), background: a.surfaceSoft, color: a.inkSoft),
          ],
        ),
        vgap(8, [
          Row(
            children: [
              AIcon(AIcons.calendar, size: 12, color: a.inkSoft),
              const SizedBox(width: 4),
              Text(tr('horoscopecompatibility_dogum_tarixi_d96907', 'Doğum tarixi'), style: AStyles.listSub(context)),
              if (isRequired) Text(' *', style: AStyles.listSub(context, color: a.pink2)),
            ],
          ),
          DatePickerWheel(
            fieldKey: const ValueKey('horo-birth-date'),
            value: data.birthDate,
            onChanged: (d) => onChanged(data.copyWith(birthDate: d)),
            disabled: (d) => d.isAfter(DateTime.now()),
            placeholder: tr('horoscopecompatibility_dogum_tarixini_secin_825730', 'Doğum tarixini seçin'),
          ),
        ]),
        vgap(8, [
          Row(
            children: [
              AIcon(AIcons.clock, size: 12, color: a.inkSoft),
              const SizedBox(width: 4),
              Expanded(child: Text(tr('horoscopecompatibility_dogum_saati_6ecf09', 'Doğum saatı'), style: AStyles.listSub(context))),
              Text(tr('horoscopecompatibility_bilirem_fa9716', 'Bilirəm'), style: px(12, color: a.inkSoft)),
              const SizedBox(width: 8),
              ShadSwitch(
                key: const ValueKey('horo-has-time'),
                checked: data.hasBirthTime,
                onChanged: (v) => onChanged(data.copyWith(hasBirthTime: v, birthTime: v ? '12:00' : '')),
              ),
            ],
          ),
          if (data.hasBirthTime)
            FadeRise(
              dy: 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ShadSelect<String>(
                    value: data.birthTime.isEmpty ? null : data.birthTime,
                    options: [for (final t in kHoroscopeTimeOptions) (t, Text(t))],
                    onChanged: (v) => onChanged(data.copyWith(birthTime: v)),
                    placeholder: tr('horoscopecompatibility_saat_secin_c24ec4', 'Saat seçin'),
                    height: 48,
                    background: a.surface,
                    borderColor: a.lineStrong,
                    textColor: a.ink,
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(
                      children: [
                        AIcon(AIcons.compass, size: 12, color: a.inkSoft),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            tr('horoscopecompatibility_yukselen_burcun_hesablanmasi_u_94af5d', 'Yüksələn bürcün hesablanması üçün lazımdır'),
                            style: px(12, color: a.inkSoft),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ]),
        if (sign != null)
          Container(
            key: const ValueKey('horo-sign'),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                Text('${sign['symbol'] ?? ''}', style: const TextStyle(fontSize: 30)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${sign['name'] ?? ''}', style: AStyles.listTitle(context)),
                      if (element.isNotEmpty && elementIcon != null)
                        Row(
                          children: [
                            AIcon(elementIcon, size: 12, color: a.inkSoft),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text('${_elementName(element)} ${trInline('HoroscopeCompatibility.tsx', 'elementi')}', style: AStyles.listSub(context)),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                if (data.hasBirthTime)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(tr('horoscopecompatibility_yukselen_b35c71', 'Yüksələn'), style: px(12, color: a.inkSoft)),
                      Text(
                        tr('untranslated_hesablanacaq_w6pf63', 'Hesablanacaq ↗'),
                        style: px(12, weight: FontWeight.w700, color: a.lav2),
                      ),
                    ],
                  ),
              ],
            ),
          ),
      ]),
    );
  }
}

/// `BirthChartCard`.
class _BirthChartCard extends StatelessWidget {
  const _BirthChartCard({required this.chart, required this.label, required this.emoji});
  final Map<String, dynamic> chart;
  final String label;
  final String emoji;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sun = _map(chart['sun']);
    final moon = _map(chart['moon']);
    final rising = chart['rising'] is Map ? _map(chart['rising']) : null;
    Widget cell({
      required Color? bg,
      Border? border,
      required AIconData icon,
      required Color ink,
      required List<Widget> body,
      required String caption,
      required Color captionInk,
    }) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: border),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: AIcon(icon, size: 16, color: ink),
          ),
          ...body,
          Opacity(
            opacity: 0.75,
            child: Text(
              caption,
              textAlign: TextAlign.center,
              style: px(10, color: captionInk),
            ),
          ),
        ],
      ),
    );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Expanded(child: Text(label, style: AStyles.listTitle(context))),
                if (chart['isExpected'] == true) ARankTagBox(tr('horoscopecompatibility_gozlenilen_4885bf', 'Gözlənilən'), background: a.lav1, color: a.lavInk),
              ],
            ),
          ),
          AGridCols(
            columns: 3,
            gap: 8,
            children: [
              cell(
                bg: a.yellow1,
                icon: AIcons.sun,
                ink: a.warnInk,
                body: [
                  Text('${sun['symbol'] ?? ''}', style: const TextStyle(fontSize: 24)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${sun['signAz'] ?? ''}',
                      textAlign: TextAlign.center,
                      style: px(12, weight: FontWeight.w700, color: a.warnInk),
                    ),
                  ),
                ],
                caption: tr('horoscopecompatibility_gunes_b7b2ab', 'Günəş'),
                captionInk: a.warnInk,
              ),
              cell(
                bg: a.blue1,
                icon: AIcons.moon,
                ink: a.blueInk,
                body: [
                  Text('${moon['symbol'] ?? ''}', style: const TextStyle(fontSize: 24)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${moon['signAz'] ?? ''}',
                      textAlign: TextAlign.center,
                      style: px(12, weight: FontWeight.w700, color: a.blueInk),
                    ),
                  ),
                ],
                caption: tr('untranslated_ay_m6wwbp', 'Ay'),
                captionInk: a.blueInk,
              ),
              cell(
                bg: rising != null ? a.lav1 : a.surface,
                border: rising != null ? null : Border.all(color: a.lineStrong),
                icon: AIcons.compass,
                ink: rising != null ? a.lavInk : a.inkFaint,
                body: rising != null
                    ? [
                        Text('${rising['symbol'] ?? ''}', style: const TextStyle(fontSize: 24)),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '${rising['signAz'] ?? ''}',
                            textAlign: TextAlign.center,
                            style: px(12, weight: FontWeight.w700, color: a.lavInk),
                          ),
                        ),
                      ]
                    : [
                        Text('?', style: px(18, color: a.inkFaint)),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(tr('untranslated_bilinmir_iqd3o8', 'Bilinmir'), style: px(12, color: a.inkSoft)),
                        ),
                      ],
                caption: tr('horoscopecompatibility_yukselen_b35c71', 'Yüksələn'),
                captionInk: rising != null ? a.lavInk : a.inkSoft,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// `AnalysisCard`.
class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard({required this.title, this.emoji, this.icon, required this.content, required this.bg, required this.ink});
  final String title;
  final String? emoji;
  final AIconData? icon;
  final String content;
  final Color bg;
  final Color ink;

  @override
  Widget build(BuildContext context) => ACard(
    color: bg,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              if (emoji != null) ...[Text(emoji!, style: const TextStyle(fontSize: 20)), const SizedBox(width: 8)],
              if (icon != null) ...[AIcon(icon!, size: 20, color: ink), const SizedBox(width: 8)],
              Expanded(
                child: Text(title, style: AStyles.heading(context, 16, color: ink)),
              ),
            ],
          ),
        ),
        Opacity(
          opacity: 0.85,
          child: Text(content, style: px(14, color: ink, height: 1.625)),
        ),
      ],
    ),
  );
}

/// The fixed loading overlay (`linear-gradient(135deg, #2a1d4d, #3c2e5c, #4a2331)`, deterministic star field).
class _LoadingOverlay extends StatelessWidget {
  const _LoadingOverlay({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    final steps = _loadingSteps();
    final current = steps[step.clamp(0, steps.length - 1)];
    const white = Color(0xFFFFFFFF);
    return AScope(
      child: Material(
        key: const ValueKey('horo-loading'),
        type: MaterialType.transparency,
        child: Container(
          // HoroscopeCompatibility.tsx gradient literal
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2A1D4D), Color(0xFF3C2E5C), Color(0xFF4A2331)]),
          ),
          child: LayoutBuilder(
            builder: (context, c) {
              return Stack(
                children: [
                  for (var i = 0; i < 50; i++)
                    PositionedDirectional(
                      start: c.maxWidth * ((i * 37) % 100) / 100,
                      top: c.maxHeight * ((i * 61 + 13) % 100) / 100,
                      child: Text(
                        '✦',
                        style: TextStyle(color: const Color(0x33FFFFFF), fontSize: (4 + (i * 29) % 17).toDouble()),
                      ),
                    ),
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 112,
                            height: 112,
                            margin: const EdgeInsets.only(bottom: 32),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0x4DFFFFFF), width: 2),
                            ),
                            child: Container(
                              margin: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0x33FFFFFF)),
                              ),
                              alignment: Alignment.center,
                              child: AIcon(current.icon, size: 40, color: current.color),
                            ),
                          ),
                          Text(
                            current.text,
                            textAlign: TextAlign.center,
                            style: px(20, weight: FontWeight.w600, color: white),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${tr('horoscopecompatibility_addim_9346cd', 'Addım')} ${step + 1} / ${steps.length}',
                            style: px(14, color: const Color(0x99FFFFFF)),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              for (var i = 0; i < steps.length; i++) ...[
                                if (i > 0) const SizedBox(width: 8),
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(shape: BoxShape.circle, color: i <= step ? white : const Color(0x4DFFFFFF)),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
