// Ported from: src/lib/date-utils.ts
import 'package:intl/date_symbol_data_custom.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/date_symbols.dart';
import 'package:intl/date_time_patterns.dart';
import 'package:intl/intl.dart';

import 'app_languages.dart';
import 'generated/intl_data.g.dart';
import 'tr.dart';

/// Sunday-first short weekday labels (`weekdayLabels`, Intl `{ weekday: 'short' }`).
List<String> weekdayLabels(String language) => kWeekdayShort[normalizeAppLanguage(language)]!;

/// `new Date(value)` for the inputs the app passes: a `DateTime`, or a string. A bare
/// `YYYY-MM-DD` is UTC midnight (as in JS); ISO date-times without an offset are local.
DateTime? parseJsDate(Object? value) {
  if (value is DateTime) return value;
  if (value is! String) return null;
  final dateOnly = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (dateOnly != null) {
    return DateTime.utc(int.parse(dateOnly[1]!), int.parse(dateOnly[2]!), int.parse(dateOnly[3]!));
  }
  return DateTime.tryParse(value);
}

bool _isDateOnlyString(Object? value) => value is String && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);

/// `getTranslatedMonth`: `month_january`… through [tr].
String getTranslatedMonth(int monthIndex) {
  const keys = [
    ('month_january', 'Yanvar'), ('month_february', 'Fevral'), ('month_march', 'Mart'), ('month_april', 'Aprel'),
    ('month_may', 'May'), ('month_june', 'İyun'), ('month_july', 'İyul'), ('month_august', 'Avqust'),
    ('month_september', 'Sentyabr'), ('month_october', 'Oktyabr'), ('month_november', 'Noyabr'), ('month_december', 'Dekabr'),
  ];
  if (monthIndex < 0 || monthIndex >= keys.length) return '';
  return tr(keys[monthIndex].$1, keys[monthIndex].$2);
}

String _two(int value) => value.toString().padLeft(2, '0');

/// Renders an Intl template generated from Node ICU (see intl_data.g.dart).
String formatIntlDateTemplate(String language, String variant, DateTime date) {
  final template = kDateTemplates[language]![variant]!;
  final zero = (kNumberSymbols[language] ?? kNumberSymbols['en']!).$4;
  String digits(String text) => zero == '0'
      ? text
      : text.replaceAllMapped(RegExp('[0-9]'), (m) => String.fromCharCode(zero.codeUnitAt(0) + m[0]!.codeUnitAt(0) - 48));
  return template.$1.replaceAllMapped(RegExp(r'\{([dMyHm])\}'), (match) {
    switch (match[1]) {
      case 'd':
        return digits('${date.day}');
      case 'M':
        return template.$2[date.month - 1];
      case 'y':
        return digits('${date.year}');
      case 'H':
        return digits(_two(date.hour));
      default:
        return digits(_two(date.minute));
    }
  });
}

/// `formatDateAz(date, includeYear)`: pack languages use Intl (`d MMMM [y]`, UTC for a bare
/// `YYYY-MM-DD` string, local time otherwise); the other nine use `<day> <tr(month)> [year]` in
/// local time. Invalid input → ''.
String formatDateAz(Object date, {bool includeYear = false, String? language}) {
  final parsed = parseJsDate(date);
  if (parsed == null) return '';
  final lang = language ?? currentLanguage();
  if (isPackLanguage(lang)) {
    final value = _isDateOnlyString(date) ? parsed.toUtc() : parsed.toLocal();
    return formatIntlDateTemplate(lang, includeYear ? 'dmy' : 'dm', value);
  }
  final local = parsed.toLocal();
  final month = getTranslatedMonth(local.month - 1);
  return includeYear ? '${local.day} $month ${local.year}' : '${local.day} $month';
}

/// `formatDateTimeAz(date, includeYear)`: "18 Fevral, 14:30" (pack languages: Intl, local time).
String formatDateTimeAz(Object date, {bool includeYear = false, String? language}) {
  final parsed = parseJsDate(date);
  if (parsed == null) return '';
  final lang = language ?? currentLanguage();
  final local = parsed.toLocal();
  if (isPackLanguage(lang)) return formatIntlDateTemplate(lang, includeYear ? 'dmyhm' : 'dmhm', local);
  final month = getTranslatedMonth(local.month - 1);
  final time = '${_two(local.hour)}:${_two(local.minute)}';
  return includeYear ? '${local.day} $month ${local.year}, $time' : '${local.day} $month, $time';
}

/// `formatTimeAz`: "14:30" (local).
String formatTimeAz(Object date) {
  final parsed = parseJsDate(date);
  if (parsed == null) return '';
  final local = parsed.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}';
}

/// `formatRelativeDateAz`: "Bu gün, 14:30", "Dünən, 14:30" or [formatDateTimeAz].
String formatRelativeDateAz(Object date, {DateTime? now}) {
  final parsed = parseJsDate(date);
  if (parsed == null) return '';
  final d = parsed.toLocal();
  final today = (now ?? DateTime.now()).toLocal();
  final yesterday = DateTime(today.year, today.month, today.day - 1, today.hour, today.minute);
  bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  if (sameDay(d, today)) return '${tr('dateutils_today', 'Bu gün')}, ${formatTimeAz(d)}';
  if (sameDay(d, yesterday)) return '${tr('dateutils_yesterday', 'Dünən')}, ${formatTimeAz(d)}';
  return formatDateTimeAz(d);
}

/// `getSymptomTranslations` (evaluated per call so the active language applies).
Map<String, String> getSymptomTranslations() {
  final headache = tr('dateutils_basagrisi_9e17a3', 'Başağrısı');
  final tired = tr('dateutils_yorgunluq_c68d62', 'Yorğunluq');
  final nausea = tr('dateutils_urekbulanma_a42830', 'Ürəkbulanma');
  final cramps = tr('dateutils_sanci_350c2d', 'Sancı');
  final bloating = tr('dateutils_siskinlik_7c7923', 'Şişkinlik');
  final backPain = tr('dateutils_bel_agrisi_9e824e', 'Bel ağrısı');
  final mood = tr('dateutils_ehval_deyisikliyi_9fa36f', 'Əhval dəyişikliyi');
  final insomnia = tr('dateutils_yuxusuzluq_68d6ab', 'Yuxusuzluq');
  final appetite = tr('dateutils_i_stah_deyisikliyi_fea8a7', 'İştah dəyişikliyi');
  final breast = tr('dateutils_dos_hessasligi_326b6d', 'Sinə həssaslığı');
  final acne = tr('dateutils_sizanaq_0b0664', 'Sızanaq');
  final dizziness = tr('dateutils_basgicellenme_9e0b89', 'Başgicəllənmə');
  final anxiety = tr('dateutils_narahatliq_33f05c', 'Narahatlıq');
  final stress = tr('dateutils_stress', 'Stress');
  final swelling = tr('dateutils_sislik_cd02e0', 'Şişlik');
  final constipation = tr('dateutils_qebizlik_aef088', 'Qəbizlik');
  final heartburn = tr('dateutils_kopukleme_2d7a33', 'Köpükləmə');
  final urination = tr('dateutils_tez_tez_sidike_getme_bfc357', 'Tez-tez sidikə getmə');
  final hot = tr('dateutils_i_stilikler_9c6091', 'İstiliklər');
  final cravings = tr('dateutils_i_stah_artimi_2b1e0b', 'İştah artımı');
  return {
    'headache': headache, 'Headache': headache, 'tired': tired, 'Tired': tired, 'fatigue': tired, 'Fatigue': tired,
    'nausea': nausea, 'Nausea': nausea, 'cramps': cramps, 'Cramps': cramps, 'bloating': bloating, 'Bloating': bloating,
    'back_pain': backPain, 'backpain': backPain, 'Back Pain': backPain, 'mood_swings': mood, 'Mood Swings': mood,
    'insomnia': insomnia, 'Insomnia': insomnia, 'appetite_changes': appetite, 'Appetite Changes': appetite,
    'breast_tenderness': breast, 'Breast Tenderness': breast, 'acne': acne, 'Acne': acne, 'dizziness': dizziness,
    'Dizziness': dizziness, 'anxiety': anxiety, 'Anxiety': anxiety, 'stress': stress, 'Stress': stress,
    'swelling': swelling, 'Swelling': swelling, 'constipation': constipation, 'Constipation': constipation,
    'heartburn': heartburn, 'Heartburn': heartburn, 'frequent_urination': urination, 'Frequent Urination': urination,
    'hot_flashes': hot, 'Hot Flashes': hot, 'cravings': cravings, 'Cravings': cravings,
    'bas_agrisi': headache, 'sanci': cramps, 'yorgunluq': tired, 'siskinlik': bloating, 'bel_agrisi': backPain,
    'ehval_deyisikliyi': mood,
  };
}

/// `translateSymptom`: exact key, then lower-case key, else the input.
String translateSymptom(String symptom) {
  final map = getSymptomTranslations();
  return map[symptom] ?? map[symptom.toLowerCase()] ?? symptom;
}

List<String> translateSymptoms(List<String> symptoms) => symptoms.map(translateSymptom).toList();

// ── package:intl locales for date-fns style patterns (`getCurrentDateLocale`) ──

const List<String> _tkMonths = ['ýanwar', 'fewral', 'mart', 'aprel', 'maý', 'iýun', 'iýul', 'awgust', 'sentýabr', 'oktýabr', 'noýabr', 'dekabr'];
const List<String> _tkMonthsShort = ['ýan', 'few', 'mar', 'apr', 'maý', 'iýun', 'iýul', 'awg', 'sen', 'okt', 'noý', 'dek'];
const List<String> _tkDays = ['ýekşenbe', 'duşenbe', 'sişenbe', 'çarşenbe', 'penşenbe', 'anna', 'şenbe'];
const List<String> _tkDaysShort = ['ýek', 'duş', 'siş', 'çar', 'pen', 'ann', 'şen'];

/// `value.charAt(0).toLocaleUpperCase('tr') + rest` (dotted i → İ).
String _capitalTr(String value) {
  if (value.isEmpty) return value;
  final first = value[0];
  final upper = first == 'i' ? 'İ' : first.toUpperCase();
  return upper + value.substring(1);
}

bool _dateLocalesReady = false;

/// Initializes intl date data and registers `tk` (Turkish patterns + fixed Turkmen names, like the
/// custom date-fns locale). Kyrgyz uses intl's own `ky` data (CLDR names = Intl ky-KG).
Future<void> ensureDateLocales() async {
  if (_dateLocalesReady) return;
  await initializeDateFormatting();
  final turkish = dateTimeSymbolMap()['tr'] as DateSymbols;
  final map = Map<String, dynamic>.of(turkish.serializeToMap());
  List<String> narrow(List<String> wide) => wide.map((value) => _capitalTr(value[0])).toList();
  List<String> capital(List<String> values) => values.map(_capitalTr).toList();
  map['NAME'] = 'tk';
  map['MONTHS'] = _tkMonths;
  map['STANDALONEMONTHS'] = capital(_tkMonths);
  map['SHORTMONTHS'] = _tkMonthsShort;
  map['STANDALONESHORTMONTHS'] = capital(_tkMonthsShort);
  map['NARROWMONTHS'] = narrow(_tkMonths);
  map['STANDALONENARROWMONTHS'] = narrow(_tkMonths);
  map['WEEKDAYS'] = _tkDays;
  map['STANDALONEWEEKDAYS'] = capital(_tkDays);
  map['SHORTWEEKDAYS'] = _tkDaysShort;
  map['STANDALONESHORTWEEKDAYS'] = capital(_tkDaysShort);
  map['NARROWWEEKDAYS'] = narrow(_tkDays);
  map['STANDALONENARROWWEEKDAYS'] = narrow(_tkDays);
  initializeDateFormattingCustom(
    locale: 'tk',
    symbols: DateSymbols.deserializeFromMap(map),
    patterns: Map<String, String>.of(dateTimePatternMap()['tr']!),
  );
  _dateLocalesReady = true;
}

/// `format(date, pattern, { locale: getCurrentDateLocale() })` with date-fns-compatible output:
/// Latin digits (date-fns never localizes digits). Call [ensureDateLocales] once at startup.
/// Note: date-fns and intl pattern letters mostly coincide (d, M, MMM, MMMM, EEE, EEEE, y, H, m);
/// date-fns-only tokens (`do`, `P`, `p`, …) must be translated by the caller.
String formatDatePattern(DateTime date, String pattern, {String? language}) {
  final info = appLanguage(language ?? currentLanguage());
  // intl swaps a pattern that equals a CLDR skeleton (e.g. 'EEEE' → 'cccc', stand-alone forms);
  // date-fns never does. A trailing quoted sentinel keeps the pattern literal; it is stripped after.
  final format = DateFormat("$pattern'\u0001'", info.intlLocale)..useNativeDigits = false;
  final text = format.format(date);
  return text.endsWith('\u0001') ? text.substring(0, text.length - 1) : text;
}
