// Ported from: src/components/tools/WeatherClothing.tsx
//
// Weather & clothing (`weather-clothing`): the device position (Baku when location is unavailable, labelled as
// such), the user's context (baby age / pregnancy week / stage) and `weather-clothing` → outdoor and indoor clothing,
// room temperature, outing advice, warnings, pollen and UV.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart' show RowFields;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' show getPregnancyWeek;
import '../../../state/calendar_utils.dart' show differenceInCalendarDays;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_ports.dart';

/// date-fns `differenceInMonths(later, earlier)`.
int differenceInMonthsFns(DateTime left, DateTime right) {
  final sign = left.isBefore(right) ? -1 : (left.isAfter(right) ? 1 : 0);
  if (sign == 0) return 0;
  final later = sign > 0 ? left : right;
  final earlier = sign > 0 ? right : left;
  var months = (later.year - earlier.year) * 12 + later.month - earlier.month;
  final lastDayOfLater = DateTime(later.year, later.month + 1, 0).day;
  final anchor = DateTime(
    earlier.year,
    earlier.month + months,
    earlier.day > lastDayOfLater ? lastDayOfLater : earlier.day,
    earlier.hour,
    earlier.minute,
    earlier.second,
    earlier.millisecond,
  );
  if (anchor.isAfter(later)) months -= 1;
  final r = sign * (months < 0 ? 0 : months);
  return r == 0 ? 0 : r;
}

/// date-fns `differenceInDays(left, right)`: whole days, the last partial day not counted.
int differenceInDaysFns(DateTime left, DateTime right) {
  int cmp(DateTime a, DateTime b) => a.isBefore(b) ? -1 : (a.isAfter(b) ? 1 : 0);
  final sign = cmp(left, right);
  final diff = differenceInCalendarDays(left, right).abs();
  final moved = DateTime(left.year, left.month, left.day - sign * diff, left.hour, left.minute, left.second, left.millisecond);
  final notFull = cmp(moved, right) == -sign ? 1 : 0;
  final r = sign * (diff - notFull);
  return r == 0 ? 0 : r;
}

/// `getUserContext()`.
typedef WeatherUserContext = ({String? lifeStage, int? babyAgeMonths, int? babyAgeDays, int? pregnancyWeek});

WeatherUserContext weatherUserContext({UserState? store, Profile? profile, DateTime? now}) {
  final lifeStage = (store?.lifeStage?.isNotEmpty ?? false) ? store!.lifeStage : profile?.lifeStage;
  final at = now ?? DateTime.now();
  final babyDob = store?.babyBirthDate ?? profile?.row.date('baby_birth_date');
  int? months, days, week;
  if (babyDob != null) {
    months = differenceInMonthsFns(at, babyDob);
    days = differenceInDaysFns(at, babyDob);
  }
  final lmp = store?.lastPeriodDate ?? profile?.row.date('last_period_date');
  if (lmp != null && lifeStage == 'bump') week = getPregnancyWeek(lmp).toInt();
  return (lifeStage: lifeStage, babyAgeMonths: months, babyAgeDays: days, pregnancyWeek: week);
}

Map<String, Object?> weatherUserContextJson(WeatherUserContext c) => {
  'lifeStage': ?c.lifeStage,
  'babyAgeMonths': ?c.babyAgeMonths,
  'babyAgeDays': ?c.babyAgeDays,
  'pregnancyWeek': ?c.pregnancyWeek,
};

/// `WeatherAdvice`.
class WeatherAdvice {
  WeatherAdvice(this.j);
  final Map<String, dynamic> j;
  num _n(String k) => j[k] is num ? j[k] as num : 0;
  String? _s(String k) => j[k] is String && (j[k] as String).isNotEmpty ? j[k] as String : null;
  List<String> _l(String k) => [for (final v in (j[k] is List ? j[k] as List : const [])) '$v'];

  num get temperature => _n('temperature');
  num get feelsLike => _n('feelsLike');
  num get humidity => _n('humidity');
  num get windSpeed => _n('windSpeed');
  num get uvIndex => _n('uvIndex');
  String get weatherDescription => _s('weatherDescription') ?? '';
  String get clothingAdvice => _s('clothingAdvice') ?? '';
  List<String> get clothingItems => _l('clothingItems');
  String? get indoorClothingAdvice => _s('indoorClothingAdvice');
  List<String> get indoorClothingItems => _l('indoorClothingItems');
  String? get idealRoomTemperature => _s('idealRoomTemperature');
  String? get roomTemperatureAdvice => _s('roomTemperatureAdvice');
  List<String> get warnings => _l('warnings');
  String? get pollenWarning => _s('pollenWarning');
  String? get uvWarning => _s('uvWarning');
  String get outdoorAdvice => _s('outdoorAdvice') ?? '';
  bool get safeToGoOut => j['safeToGoOut'] == true;
  String get alertLevel => _s('alertLevel') ?? 'safe';
}

/// JS `Math.round`.
String _round(num v) => '${(v + 0.5).floor()}';

class WeatherClothing extends ConsumerStatefulWidget {
  const WeatherClothing({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<WeatherClothing> createState() => _WeatherClothingState();
}

class _WeatherClothingState extends ConsumerState<WeatherClothing> {
  bool _isLoading = false;
  String? _locationError;
  bool _usingFallbackLocation = false;
  String _cityName = '';
  WeatherAdvice? _advice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_fetchWeather());
    });
  }

  WeatherUserContext _context() => weatherUserContext(store: ref.read(userStoreProvider), profile: ref.read(authProfileProvider));

  Future<void> _fetchWeather() async {
    setState(() {
      _isLoading = true;
      _locationError = null;
      _usingFallbackLocation = false;
      _advice = null;
    });
    try {
      double latitude, longitude;
      try {
        final position = await ref.read(geolocationProvider)();
        latitude = position.latitude;
        longitude = position.longitude;
      } catch (_) {
        // Fallback to Baku if geolocation fails entirely.
        latitude = 40.4093;
        longitude = 49.8671;
        if (mounted) setState(() => _usingFallbackLocation = true);
      }
      final res = await ref
          .read(mediaDbProvider)
          .invoke(
            'weather-clothing',
            body: {'lat': latitude, 'lng': longitude, 'userContext': weatherUserContextJson(_context()), 'language': ref.read(mediaLanguageProvider)()},
          );
      if (res.error != null) throw res.error!;
      final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : const <String, dynamic>{};
      if (data['success'] == true) {
        if (mounted) {
          setState(() {
            _cityName = '${data['cityName'] ?? ''}';
            _advice = data['advice'] is Map ? WeatherAdvice(Map<String, dynamic>.from(data['advice'] as Map)) : null;
          });
        }
      } else {
        throw StateError('${data['error'] ?? tr('weatherclothing_hava_melumati_alinmadi_f903fd', 'Hava məlumatı alınmadı')}');
      }
    } catch (error) {
      debugPrint('Weather fetch error: $error');
      final message = tr('weatherclothing_hava_melumati_alinarken_xeta_b_9b0a67', 'Hava məlumatı alınarkən xəta baş verdi.');
      if (mounted) {
        setState(() => _locationError = message);
        ref.read(mediaToastProvider)(context, MediaToastData(title: tr('weatherclothing_xeta_3cdbb6', 'Xəta'), description: message, destructive: true));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Color _alertColor(ATokens a, String level) => switch (level) {
    'danger' => a.pink2,
    'warning' => a.peach2,
    'caution' => a.yellow2,
    _ => a.green2,
  };

  String _weatherIcon(num temp) {
    if (temp < 5) return '❄️';
    if (temp < 15) return '🌤️';
    if (temp < 25) return '☀️';
    return '🔥';
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    ref.watch(userStoreProvider);
    ref.watch(authProfileProvider);
    final uc = _context();
    final advice = _advice;
    final eyebrow = uc.babyAgeMonths != null
        ? tr('weatherclothing_baby_age_for', '{months} aylıq körpə üçün').replaceAll('{months}', '${uc.babyAgeMonths}')
        : (uc.pregnancyWeek ?? 0) != 0
        ? tr('weatherclothing_pregnancy_week_for', 'Hamiləliyin {week}. həftəsi üçün').replaceAll('{week}', '${uc.pregnancyWeek}')
        : tr('weatherclothing_korpeniz_ucun_geyim_mesleheti_f5cbde', 'Körpəniz üçün geyim məsləhəti');

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: eyebrow,
            title: tr('weatherclothing_title', 'Hava & Geyim'),
            actions: [
              ToolIconButton(
                key: const ValueKey('weather-refresh'),
                semanticLabel: tr('a11y_refresh', 'Yenilə'),
                icon: _isLoading ? const _Spin(child: AIcon(AIcons.refreshCw, size: 16)) : const AIcon(AIcons.refreshCw, size: 16),
                onTap: _isLoading ? null : () => unawaited(_fetchWeather()),
              ),
            ],
          ),
          vgap(12, [
            if (_usingFallbackLocation && advice != null && !_isLoading)
              Semantics(
                liveRegion: true,
                child: ACard(
                  key: const ValueKey('weather-fallback'),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Text(
                    tr('weather_location_fallback', 'Məkan təyin edilmədi. Bakı üçün hava göstərilir. Məkan xidmətlərini yoxlayıb yenidən cəhd edin.'),
                    style: px(14, color: a.ink),
                  ),
                ),
              ),
            if (uc.babyAgeMonths != null || (uc.pregnancyWeek ?? 0) != 0)
              ACard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    if (uc.babyAgeMonths != null) ...[
                      AListIconBox(
                        gradient: a.gradBlue,
                        child: AIcon(AIcons.baby, size: 17, strokeWidth: 2.2, color: a.blueInk),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr('weatherclothing_korpenin_yasi_1dfff9', 'Körpənin yaşı'), style: AStyles.listTitle(context)),
                            Text(
                              '${uc.babyAgeMonths} ${tr('weatherclothing_ay_suffix_3c7a2d', 'ay')} (${uc.babyAgeDays} ${tr('weatherclothing_gun_4835dd', 'gün)')}',
                              style: AStyles.listSub(context),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      AListIconBox(
                        gradient: a.gradPink,
                        child: AIcon(AIcons.user, size: 17, strokeWidth: 2.2, color: a.alertInk),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr('weatherclothing_hamilelik_heftesi_c9e362', 'Hamiləlik həftəsi'), style: AStyles.listTitle(context)),
                            Text('${uc.pregnancyWeek}${tr('weatherclothing_hefte_459cfe', '. həftə')}', style: AStyles.listSub(context)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            if (_isLoading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 80),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _Spin(seconds: 2, child: AIcon(AIcons.cloudSun, size: 64, color: a.blue2)),
                    ),
                    Text(tr('weatherclothing_mekan_teyin_edilir_526792', 'Məkan təyin edilir...'), style: px(16, color: a.onBgSoft)),
                  ],
                ),
              ),
            if (_locationError != null && !_isLoading)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AIcon(AIcons.triangleAlert, size: 24, color: a.alertInk),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('weatherclothing_xeta_3cdbb6', 'Xəta'),
                            style: px(16, weight: FontWeight.w700, color: a.alertInk),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(_locationError!, style: px(14, color: a.alertSoft)),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: APillButton(
                              kind: APillKind.soft,
                              label: tr('weatherclothing_yeniden_cehd_et_d273ac', 'Yenidən cəhd et'),
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              onTap: () => unawaited(_fetchWeather()),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            if (advice != null && !_isLoading) FadeRise(child: _weather(context, advice, uc)),
          ]),
        ],
      ),
    );
  }

  Widget _chips(List<String> items, Color bg, Color ink) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (final item in items)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
          child: Text(
            item,
            style: px(14, weight: FontWeight.w600, color: ink),
          ),
        ),
    ],
  );

  Widget _weather(BuildContext context, WeatherAdvice advice, WeatherUserContext uc) {
    final a = context.a;
    Widget stat(Color bg, Color ink, AIconData icon, String label, String value) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          AIcon(icon, size: 20, color: ink),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Opacity(
              opacity: 0.8,
              child: Text(label, style: px(12, color: ink)),
            ),
          ),
          Text(
            value,
            style: px(14, weight: FontWeight.w700, color: ink),
          ),
        ],
      ),
    );
    return vgap(12, [
      ACard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(height: 6, color: _alertColor(a, advice.alertLevel)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.mapPin, size: 16, color: a.peach2),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_cityName, style: AStyles.listTitle(context))),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(color: advice.safeToGoOut ? a.green1 : a.pink1, borderRadius: BorderRadius.circular(999)),
                          child: Text(
                            advice.safeToGoOut
                                ? tr('weatherclothing_cixmaq_olar_ab7b33', '✓ Çıxmaq olar')
                                : tr('weatherclothing_diqqetli_olun_c597f9', '⚠ Diqqətli olun'),
                            style: px(12, weight: FontWeight.w700, color: advice.safeToGoOut ? a.greenInk : a.pinkInk),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Text(_weatherIcon(advice.temperature), style: const TextStyle(fontSize: 60, height: 1)),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${_round(advice.temperature)}°C', style: AStyles.heading(context, 44)),
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text('${tr('weatherclothing_feels_like', 'Hiss:')} ${_round(advice.feelsLike)}°C', style: AStyles.listSub(context)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(advice.weatherDescription, style: px(14, color: a.bodyText)),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: AGridCols(
                      columns: 3,
                      gap: 8,
                      children: [
                        stat(a.blue1, a.blueInk, AIcons.droplets, tr('weatherclothing_rutubet_3d8e74', 'Rütubət'), '${advice.humidity}%'),
                        stat(a.green1, a.greenInk, AIcons.wind, tr('weatherclothing_kulek_cc8bf6', 'Külək'), '${_round(advice.windSpeed)} km/h'),
                        stat(a.yellow1, a.warnInk, AIcons.sun, 'UV', '${advice.uvIndex}'),
                      ],
                    ),
                  ),
                ],
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
                  AIcon(AIcons.shirt, size: 20, color: a.peach2),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      uc.babyAgeMonths != null
                          ? tr('weatherclothing_baby_outdoor_clothing', '{months} aylıq körpə üçün bayır geyimi').replaceAll('{months}', '${uc.babyAgeMonths}')
                          : tr('weatherclothing_bayirda_geyim_tovsiyesi_650ba0', 'Bayırda Geyim Tövsiyəsi'),
                      style: AStyles.cardTitle(context),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(advice.clothingAdvice, style: AStyles.ctaText(context)),
            ),
            _chips(advice.clothingItems, a.peach1, a.accentInk),
          ],
        ),
      ),
      if (advice.indoorClothingAdvice != null || advice.idealRoomTemperature != null)
        ACard(
          color: a.lav1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    AIcon(AIcons.house, size: 20, color: a.lavInk),
                    const SizedBox(width: 8),
                    Text(tr('weatherclothing_ev_daxilinde_d10128', 'Ev daxilində'), style: AStyles.heading(context, 16, color: a.lavInk)),
                  ],
                ),
              ),
              if (advice.idealRoomTemperature != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0x80FFFFFF), borderRadius: BorderRadius.circular(12)), // rgba(255,255,255,0.5)
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          AIcon(AIcons.thermometer, size: 16, color: a.lavInk),
                          const SizedBox(width: 8),
                          Text(
                            tr('weatherclothing_ideal_otaq_temperaturu_6bf977', 'İdeal otaq temperaturu'),
                            style: px(14, weight: FontWeight.w700, color: a.lavInk),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(advice.idealRoomTemperature!, style: AStyles.heading(context, 24, color: a.lavInk)),
                      if (advice.roomTemperatureAdvice != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Opacity(
                            opacity: 0.8,
                            child: Text(advice.roomTemperatureAdvice!, style: px(12, color: a.lavInk)),
                          ),
                        ),
                    ],
                  ),
                ),
              if (advice.indoorClothingAdvice != null) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Opacity(
                    opacity: 0.85,
                    child: Text(advice.indoorClothingAdvice!, style: px(14, color: a.lavInk)),
                  ),
                ),
                if (advice.indoorClothingItems.isNotEmpty) _chips(advice.indoorClothingItems, a.chipOverlay, a.lavInk),
              ],
            ],
          ),
        ),
      ACard(
        color: advice.safeToGoOut ? a.green1 : a.peach1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  AIcon(AIcons.cloudSun, size: 20, color: advice.safeToGoOut ? a.greenInk : a.accentInk),
                  const SizedBox(width: 8),
                  Text(
                    tr('weatherclothing_bayirda_gezme_0ae215', 'Bayırda gəzmə'),
                    style: AStyles.heading(context, 16, color: advice.safeToGoOut ? a.greenInk : a.accentInk),
                  ),
                ],
              ),
            ),
            Opacity(
              opacity: 0.9,
              child: Text(advice.outdoorAdvice, style: px(14, color: advice.safeToGoOut ? a.greenInk : a.accentInk)),
            ),
          ],
        ),
      ),
      if (advice.warnings.isNotEmpty)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    AIcon(AIcons.triangleAlert, size: 20, color: a.alertInk),
                    const SizedBox(width: 8),
                    Text(tr('weatherclothing_xeberdarliqlar_5542c4', 'Xəbərdarlıqlar'), style: AStyles.heading(context, 16, color: a.alertInk)),
                  ],
                ),
              ),
              vgap(8, [
                for (final w in advice.warnings)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 8),
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(color: a.pink2, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(w, style: px(14, color: a.alertSoft)),
                      ),
                    ],
                  ),
              ]),
            ],
          ),
        ),
      if (advice.pollenWarning != null)
        _notice(context, a.yellow1, a.warnInk, AIcons.flower2, tr('weatherclothing_polen_xeberdarligi_1ae540', 'Polen Xəbərdarlığı'), advice.pollenWarning!),
      if (advice.uvWarning != null)
        _notice(context, a.peach1, a.accentInk, AIcons.shield, tr('weatherclothing_uv_xeberdarligi_327432', 'UV Xəbərdarlığı'), advice.uvWarning!),
    ]);
  }

  Widget _notice(BuildContext context, Color bg, Color ink, AIconData icon, String title, String text) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AIcon(icon, size: 20, color: ink),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: px(16, weight: FontWeight.w700, color: ink),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Opacity(
                  opacity: 0.85,
                  child: Text(text, style: px(14, color: ink)),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// `animate-spin` (1 s, or [seconds]).
class _Spin extends StatefulWidget {
  const _Spin({required this.child, this.seconds = 1});
  final Widget child;
  final int seconds;
  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(seconds: widget.seconds),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}
