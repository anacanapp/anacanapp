// Ported from: src/lib/doctor-report-extras.ts
//
// Clinical sections of the doctor PDF report that come from dedicated trackers: blood sugar, kick counts,
// contractions (pregnancy), EPDS (pregnancy / postpartum), vaccines and WHO growth percentiles (child). Every
// builder is pure: rows in, a [ReportSection] out, or null when there is nothing to show for the period.
// Number formatting uses [language] (React: getLocaleTag()).
import '../../../core/i18n/count_format.dart' show formatIntlNumber;
import '../../../core/i18n/tr.dart';
import '../../../domain/dates/local_date.dart' show localDateKey;
import '../../../domain/growth/who_growth.dart' as who;
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' show getPrematurityInfo;
import '../../../domain/vaccines/vaccine_schedule.dart';
import '../../tools/blood_sugar/blood_sugar.dart' as bs;
import 'health_report_data.dart';
import 'pdf_report.dart';

String _two(int v) => v.toString().padLeft(2, '0');

/// `reportDate(date, time)`: `dd.MM.yyyy` (`dd.MM.yyyy HH:mm`) in local time; strings through date-fns parseISO.
String reportDate(Object date, [bool time = false]) {
  final d = date is DateTime ? date.toLocal() : parseIsoDateFns('$date')?.toLocal();
  if (d == null) return '—';
  final day = '${_two(d.day)}.${_two(d.month)}.${d.year.toString().padLeft(4, '0')}';
  return time ? '$day ${_two(d.hour)}:${_two(d.minute)}' : day;
}

/// `value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits })`.
String reportNumber(num? value, String language, [int digits = 1]) =>
    value == null || !value.isFinite ? '—' : formatIntlNumber(language, value, maximumFractionDigits: digits);

double? _finite(Object? value) => finiteMeasurement(value);

double? _avg(List<double> values) => values.isEmpty ? null : values.reduce((a, b) => a + b) / values.length;

/// m:ss, used for contraction durations/intervals and kick session lengths.
String clock(num? seconds) {
  if (seconds == null || !seconds.isFinite || seconds < 0) return '—';
  final total = jsRoundInt(seconds);
  return '${total ~/ 60}:${_two(total % 60)}';
}

int? _time(Object? iso) => iso is String && iso.isNotEmpty ? jsParseDate(iso)?.millisecondsSinceEpoch : null;
bool _inRange(int? t, ReportRange range) =>
    t != null && t <= range.end.millisecondsSinceEpoch && (range.start == null || t >= range.start!.millisecondsSinceEpoch);
bool _dayInRange(String day, ReportRange range) => day.compareTo(range.endDay) <= 0 && (range.startDay == null || day.compareTo(range.startDay!) >= 0);
String _s(Object? v) => v is String ? v : '';

// ── Blood sugar ──────────────────────────────────────────────────────────────

/// Gestational diabetes targets shared with BloodSugarTracker (mg/dL).
const ({int low, int fasting, int after1h, int after2h}) bloodSugarTargets =
    (low: bs.hypoMgdl, fasting: 95, after1h: 140, after2h: 120);

/// 'low' | 'target' | 'above'.
String bloodSugarBand(num value, String type) {
  final status = bs.glucoseStatus(value, type);
  return status == 'low' ? 'low' : status == 'high' ? 'above' : 'target';
}

ReportSection? buildBloodSugarSection(List<ReportRowMap> logs, ReportRange range, {String? language}) {
  final lang = language ?? currentLanguage();
  final readings = <({ReportRowMap log, int at, double value, String band})>[];
  for (final log in logs) {
    final at = _time(log['logged_at'] ?? log['created_at']);
    final value = _finite(log['reading_value']);
    if (value == null || value <= 0 || !_inRange(at, range)) continue;
    readings.add((log: log, at: at!, value: value, band: bloodSugarBand(value, _s(log['reading_type']))));
  }
  if (readings.isEmpty) return null;
  readings.sort((a, b) => b.at - a.at);
  final types = <String, String>{
    'fasting': tr('bloodsugartracker_acliq_b6d5ee', 'Aclıq'),
    'before_meal': tr('bloodsugartracker_yemekden_evvel_167a3d', 'Yeməkdən əvvəl'),
    bs.afterMeal1h: tr('clinical_bs_after_1h', 'Yeməkdən 1 saat sonra'),
    'after_meal': tr('bloodsugartracker_yemekden_2_saat_sonra_c59165', 'Yeməkdən 2 saat sonra'),
    'bedtime': tr('bloodsugartracker_yatmazdan_evvel_a457fa', 'Yatmazdan əvvəl'),
    'random': tr('bloodsugartracker_tesadufi_98c20c', 'Təsadüfi'),
  };
  final bands = <String, String>{
    'low': tr('report_sugar_low', 'Aşağı (<70)'),
    'target': tr('report_sugar_in_target', 'Hədəfdə'),
    'above': tr('report_sugar_above', 'Hədəfdən yuxarı'),
  };
  final fasting = readings.where((r) => r.log['reading_type'] == 'fasting').toList();
  final other = readings.where((r) => r.log['reading_type'] != 'fasting').toList();
  final inTarget = readings.where((r) => r.band == 'target').length;
  return ReportSection(
    id: 'blood_sugar',
    title: tr('report_sugar_title', 'Qan şəkəri'),
    rows: [
      ReportRow(tr('report_sugar_readings', 'Ölçmələr'), '${readings.length}'),
      ReportRow(tr('report_sugar_in_target_count', 'Hədəfdə olan ölçmələr'), '$inTarget / ${readings.length}'),
      if (fasting.isNotEmpty)
        ReportRow(tr('report_sugar_fasting_avg', 'Aclıq qlükozası, orta'), '${reportNumber(_avg([for (final r in fasting) r.value]), lang, 0)} mg/dL'),
      if (other.isNotEmpty)
        ReportRow(tr('report_sugar_other_avg', 'Digər ölçmələr, orta'), '${reportNumber(_avg([for (final r in other) r.value]), lang, 0)} mg/dL'),
    ],
    note: tr('clinical_report_sugar_targets',
            'Hamiləlik hədəfləri: aclıq {fasting} mg/dL-dən aşağı, yeməkdən 1 saat sonra {after1h} mg/dL-dən aşağı, 2 saat sonra {after2h} mg/dL-dən aşağı; {low} mg/dL-dən aşağı dəyər aşağı sayılır.')
        .replaceFirst('{fasting}', '${bloodSugarTargets.fasting}')
        .replaceFirst('{after1h}', '${bloodSugarTargets.after1h}')
        .replaceFirst('{after2h}', '${bloodSugarTargets.after2h}')
        .replaceFirst('{low}', '${bloodSugarTargets.low}'),
    table: ReportTable(
      headers: [tr('pdf_date_time', 'Tarix / saat'), tr('report_sugar_type', 'Ölçmə növü'), 'mg/dL (mmol/L)', tr('report_sugar_vs_target', 'Hədəfə görə')],
      rows: [
        for (final r in readings)
          [
            reportDate(DateTime.fromMillisecondsSinceEpoch(r.at), true),
            types[_s(r.log['reading_type'])] ?? (_s(r.log['reading_type']).isEmpty ? '—' : _s(r.log['reading_type'])),
            '${reportNumber(r.value, lang, 0)} (${reportNumber(r.value / 18.016, lang, 1)})',
            bands[r.band]!,
          ],
      ],
      widths: const [1.2, 1.1, 1, 1],
    ),
  );
}

// ── Kick counts ──────────────────────────────────────────────────────────────

/// Calendar day in the phone's zone; session_date is a server default and may be the UTC day.
String _kickDay(ReportRowMap session) {
  final at = _time(session['created_at']);
  return at != null ? localDateKey(DateTime.fromMillisecondsSinceEpoch(at)) : _s(session['session_date']);
}

ReportSection? buildKickSection(List<ReportRowMap> sessions, ReportRange range, {int maxDays = 7, String? language}) {
  final lang = language ?? currentLanguage();
  final valid = sessions.where((s) {
    final day = _kickDay(s);
    return day.isNotEmpty && _dayInRange(day, range) && (_finite(s['kick_count']) ?? -1) >= 0;
  }).toList();
  if (valid.isEmpty) return null;
  final byDay = <String, ({int sessions, double kicks, double seconds})>{};
  for (final s in valid) {
    final day = _kickDay(s);
    final e = byDay[day] ?? (sessions: 0, kicks: 0.0, seconds: 0.0);
    final secs = _finite(s['duration_seconds']) ?? 0;
    byDay[day] = (sessions: e.sessions + 1, kicks: e.kicks + (_finite(s['kick_count']) ?? 0), seconds: e.seconds + (secs > 0 ? secs : 0));
  }
  final days = byDay.entries.toList()..sort((a, b) => b.key.compareTo(a.key));
  final totalKicks = valid.fold<double>(0, (sum, s) => sum + (_finite(s['kick_count']) ?? 0));
  double dur(ReportRowMap s) {
    final v = _finite(s['duration_seconds']) ?? 0;
    return v > 0 ? v : 0;
  }

  return ReportSection(
    id: 'kicks',
    title: tr('report_kicks_title', 'Təpik sayı'),
    rows: [
      ReportRow(tr('report_kicks_sessions', 'Sayma seansları'), '${valid.length}'),
      ReportRow(tr('report_kicks_days', 'Qeydli günlər'), '${byDay.length}'),
      ReportRow(tr('report_kicks_avg_session', 'Seans üzrə orta təpik'), reportNumber(totalKicks / valid.length, lang, 1)),
      ReportRow(tr('report_kicks_avg_duration', 'Seansın orta müddəti (dəq:san)'), clock(_avg([for (final s in valid) dur(s)]))),
    ],
    note: days.length > maxDays ? tr('report_recent_days_note', 'Cədvəldə son {n} qeydli gün göstərilir.').replaceFirst('{n}', '$maxDays') : null,
    table: ReportTable(
      headers: [
        tr('pdf_date', 'Tarix'),
        tr('report_kicks_sessions', 'Sayma seansları'),
        tr('report_kicks_total', 'Cəmi təpik'),
        tr('report_kicks_time', 'Cəmi vaxt (dəq:san)'),
      ],
      rows: [
        for (final e in days.take(maxDays)) [reportDate(e.key), '${e.value.sessions}', jsNumberToString(e.value.kicks), clock(e.value.seconds)],
      ],
      widths: const [1, 1, 1, 1],
    ),
  );
}

// ── Contractions ─────────────────────────────────────────────────────────────

/// A pause longer than this starts a new contraction-timing session.
const int contractionSessionGapMs = 60 * 60 * 1000;

class ContractionSession {
  const ContractionSession({required this.start, required this.count, required this.avgDuration, required this.avgInterval});
  final int start;
  final int count;
  final double? avgDuration;
  final double? avgInterval;
}

List<ContractionSession> groupContractionSessions(List<ReportRowMap> rows, ReportRange range) {
  final items = <({int at, double? duration, double? interval})>[
    for (final r in rows)
      if (_inRange(_time(r['start_time']), range)) (at: _time(r['start_time'])!, duration: _finite(r['duration_seconds']), interval: _finite(r['interval_seconds'])),
  ]..sort((a, b) => a.at - b.at);
  final groups = <List<({int at, double? duration, double? interval})>>[];
  for (final item in items) {
    if (groups.isNotEmpty && item.at - groups.last.last.at <= contractionSessionGapMs) {
      groups.last.add(item);
    } else {
      groups.add([item]);
    }
  }
  return [
    for (final group in groups)
      () {
        final intervals = <double>[];
        // Start-to-start within the session is authoritative; a stored interval fills in only for the first one.
        for (var i = 0; i < group.length; i++) {
          final item = group[i];
          if (i > 0) {
            intervals.add((item.at - group[i - 1].at) / 1000);
          } else if (item.interval != null && item.interval! > 0 && item.interval! * 1000 <= contractionSessionGapMs) {
            intervals.add(item.interval!);
          }
        }
        return ContractionSession(
          start: group.first.at,
          count: group.length,
          avgDuration: _avg([for (final g in group) if (g.duration != null && g.duration! > 0) g.duration!]),
          avgInterval: _avg(intervals),
        );
      }(),
  ];
}

ReportSection? buildContractionSection(List<ReportRowMap> rows, ReportRange range, {int maxSessions = 5}) {
  final sessions = groupContractionSessions(rows, range);
  if (sessions.isEmpty) return null;
  final recent = sessions.reversed.take(maxSessions).toList();
  return ReportSection(
    id: 'contractions',
    title: tr('report_contractions_title', 'Sancılar'),
    rows: [
      ReportRow(tr('report_contractions_count', 'Qeyd edilmiş sancılar'), '${sessions.fold<int>(0, (sum, s) => sum + s.count)}'),
      ReportRow(tr('report_contractions_sessions', 'Ölçmə seansları'), '${sessions.length}'),
    ],
    note: sessions.length > maxSessions ? tr('report_recent_sessions_note', 'Cədvəldə son {n} seans göstərilir.').replaceFirst('{n}', '$maxSessions') : null,
    table: ReportTable(
      headers: [
        tr('report_session_start', 'Başlama'),
        tr('report_contractions_count_short', 'Sancı sayı'),
        tr('report_avg_duration', 'Orta müddət (dəq:san)'),
        tr('report_avg_interval', 'Orta interval (dəq:san)'),
      ],
      rows: [
        for (final s in recent) [reportDate(DateTime.fromMillisecondsSinceEpoch(s.start), true), '${s.count}', clock(s.avgDuration), clock(s.avgInterval)],
      ],
      widths: const [1.2, 0.8, 1, 1],
    ),
  );
}

// ── EPDS ─────────────────────────────────────────────────────────────────────

/// 'low' | 'possible' | 'probable'. The thresholds the app scores with (useSubmitEPDS): 10-12 moderate, 13+ high.
String epdsBand(num score) => score >= 13 ? 'probable' : score >= 10 ? 'possible' : 'low';

/// Answers are stored by question number; question 10 is thoughts of self-harm.
double? epdsQuestion10(Object? answers) {
  if (answers is! Map) return null;
  return _finite(answers['10'] ?? answers[10]);
}

ReportSection? buildEpdsSection(List<ReportRowMap> assessments, ReportRange range) {
  final dated = <({ReportRowMap item, int at, double score})>[
    for (final a in assessments)
      if (_time(a['completed_at']) != null && _finite(a['total_score']) != null && _time(a['completed_at'])! <= range.end.millisecondsSinceEpoch)
        (item: a, at: _time(a['completed_at'])!, score: _finite(a['total_score'])!),
  ]..sort((a, b) => b.at - a.at);
  // A screening outside a short period is still the latest one the clinician should see.
  final shown = dated.where((e) => _inRange(e.at, range)).toList();
  final list = shown.isNotEmpty ? shown : dated.take(1).toList();
  if (list.isEmpty) return null;
  final bands = <String, String>{
    'low': tr('report_epds_low', 'Hədd altında (0-9)'),
    'possible': tr('report_epds_possible', 'Mümkün depressiya (10-12)'),
    'probable': tr('report_epds_probable', 'Ehtimal olunan depressiya (13+)'),
  };
  String q(double v) => jsNumberToString(v);
  final flagged = list.where((e) => (epdsQuestion10(e.item['answers']) ?? 0) > 0).toList();
  final flag = flagged.isEmpty
      ? null
      : tr('report_epds_q10_flag',
              'Diqqət: 10-cu sual (özünə zərər vermək fikri) 0-dan yuxarı qiymətləndirilib: {dates}. Təhlükəsizlik qiymətləndirməsi tövsiyə olunur.')
          .replaceFirst('{dates}',
              flagged.map((e) => '${reportDate(DateTime.fromMillisecondsSinceEpoch(e.at))} (${q(epdsQuestion10(e.item['answers'])!)}/3)').join(', '));
  return ReportSection(
    id: 'epds',
    title: tr('report_epds_title', 'EPDS (Edinburq doğuşdansonrakı depressiya şkalası)'),
    flag: flag,
    note: tr('report_epds_note', 'EPDS skrininq vasitəsidir, diaqnoz deyil. Maksimum bal 30-dur.'),
    table: ReportTable(
      headers: [tr('pdf_date', 'Tarix'), tr('report_epds_score', 'Bal'), tr('report_epds_band', 'Risk qrupu'), tr('report_epds_q10', 'Sual 10')],
      rows: [
        for (final e in list)
          () {
            final q10 = epdsQuestion10(e.item['answers']);
            return [
              reportDate(DateTime.fromMillisecondsSinceEpoch(e.at)),
              '${q(e.score)} / 30',
              bands[epdsBand(e.score)]!,
              q10 == null ? '—' : q10 > 0 ? '${q(q10)} (!)' : '0',
            ];
          }(),
      ],
      widths: const [1, 0.7, 1.6, 0.7],
    ),
  );
}

// ── Vaccines ─────────────────────────────────────────────────────────────────

/// `ReportChild`.
class ReportChild {
  const ReportChild({required this.birthDate, required this.gender, this.dueDate});
  final String birthDate;
  final String gender;
  final String? dueDate;
}

ScheduleLike _schedule(ReportRowMap r) => ScheduleLike(
      id: '${r['id']}',
      doseNumber: (r['dose_number'] as num?) ?? 0,
      recommendedAgeDays: (r['recommended_age_days'] as num?) ?? 0,
      minAgeDays: r['min_age_days'] as num?,
      maxAgeDays: r['max_age_days'] as num?,
      scheduleMeta: r['schedule_meta'],
    );

/// [schedule] rows carry their `vaccine` (`{name, name_az, is_active}`); [logs] are `child_vaccinations` rows.
ReportSection? buildVaccineSection(List<ReportRowMap> schedule, List<ReportRowMap> logs, ReportChild child, ReportRange range, [DateTime? today]) {
  if (schedule.isEmpty || child.birthDate.isEmpty) return null;
  final logMap = <String, ReportRowMap>{for (final l in logs) '${l['vaccine_schedule_id']}': l};
  VaccinationLike like(ReportRowMap l) => VaccinationLike(administeredAt: l['administered_at'] as String?, isSkipped: l['is_skipped'] == true);
  final likeMap = {for (final e in logMap.entries) e.key: like(e.value)};
  final items = <({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing})>[];
  for (final row in schedule) {
    final sched = _schedule(row);
    final log = logMap[sched.id];
    final vaccine = (row['vaccine'] as Map?) ?? const {};
    if (!((vaccine['is_active'] == true) || log != null)) continue;
    if (!vaccineEligible(sched, child.birthDate, child.gender, log == null ? null : like(log))) continue;
    items.add((row: row, sched: sched, log: log, status: vaccineStatus(sched, child.birthDate, likeMap, today), timing: vaccineTiming(sched)));
  }
  final routine = items.where((i) => i.timing == null || i.timing!.kind == 'routine').toList();
  final done = items.where((i) => i.status == 'done').toList();
  final due = routine.where((i) => i.status == 'pending').toList();
  final overdue = routine.where((i) => i.status == 'overdue').toList();
  if (done.isEmpty && due.isEmpty && overdue.isEmpty) return null;
  String? str(Object? v) => v is String && v.isNotEmpty ? v : null;
  String name(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) i) {
    final v = (i.row['vaccine'] as Map?) ?? const {};
    return str(v['name']) ?? str(v['name_az']) ?? '—';
  }

  String dose(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) i) =>
      str(i.row['dose_label']) ?? str(i.row['dose_label_az']) ?? jsNumberToString(i.sched.doseNumber);
  DateTime dueDate(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) i) =>
      (i.timing != null ? calendarOffsetDate(child.birthDate, i.timing!.age) : null) ??
      addDays(parseIsoDateFns(child.birthDate) ?? DateTime(1970), i.sched.recommendedAgeDays.toInt());
  final statusDone = tr('report_vaccine_done', 'Vurulub');
  final statusDue = tr('report_vaccine_due', 'Vaxtı çatıb');
  final statusOverdue = tr('report_vaccine_overdue', 'Gecikib');
  String administered(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) i) =>
      _s(i.log?['administered_at']);
  final doneInRange = done.where((i) {
    final at = administered(i);
    return at.isNotEmpty && _dayInRange(at.length >= 10 ? at.substring(0, 10) : at, range);
  }).toList()
    ..sort((a, b) => administered(b).compareTo(administered(a)));
  int byAge(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) a,
          ({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) b) =>
      (a.sched.recommendedAgeDays - b.sched.recommendedAgeDays).sign.toInt();
  String scheduled(({ReportRowMap row, ScheduleLike sched, ReportRowMap? log, String status, VaccineTiming? timing}) i) {
    final label = str(i.row['age_label']) ?? str(i.row['age_label_az']);
    return '${label ?? ''}${label != null ? ' · ' : ''}${reportDate(dueDate(i))}';
  }

  return ReportSection(
    id: 'vaccines',
    title: tr('report_vaccines_title', 'Peyvəndlər'),
    rows: [
      ReportRow(statusDone, '${done.length}'),
      ReportRow(statusDue, '${due.length}'),
      ReportRow(statusOverdue, '${overdue.length}'),
    ],
    note: tr('report_vaccines_note',
        'Tətbiqdə seçilmiş ölkə təqvimi və valideynin qeydləri əsasında. Cədvəldə gecikən, vaxtı çatan və seçilmiş dövrdə vurulan dozalar göstərilir.'),
    table: ReportTable(
      headers: [
        tr('report_vaccine_name', 'Peyvənd'),
        tr('report_vaccine_dose', 'Doza'),
        tr('report_vaccine_status', 'Status'),
        tr('report_vaccine_date', 'Tarix / tövsiyə olunan yaş'),
      ],
      rows: [
        for (final i in jsSorted(overdue, byAge)) [name(i), dose(i), statusOverdue, scheduled(i)],
        for (final i in jsSorted(due, byAge)) [name(i), dose(i), statusDue, scheduled(i)],
        for (final i in doneInRange) [name(i), dose(i), statusDone, reportDate(administered(i).substring(0, administered(i).length >= 10 ? 10 : administered(i).length))],
      ],
      widths: const [1.3, 0.9, 0.8, 1.3],
    ),
  );
}

// ── Growth (WHO percentiles) ─────────────────────────────────────────────────

ReportSection? buildGrowthSection(List<ReportRowMap> entries, ReportChild child, ReportRange range, {int maxRows = 8, String? language}) {
  final lang = language ?? currentLanguage();
  if (child.birthDate.isEmpty) return null;
  String day(ReportRowMap e) {
    final d = _s(e['entry_date']);
    return d.length >= 10 ? d.substring(0, 10) : d;
  }

  final valid = entries
      .where((e) =>
          _s(e['entry_date']).isNotEmpty &&
          day(e).compareTo(range.endDay) <= 0 &&
          (_finite(e['weight_kg']) ?? 0) + (_finite(e['height_cm']) ?? 0) + (_finite(e['head_cm']) ?? 0) > 0)
      .toList()
    ..sort((a, b) => _s(b['entry_date']).compareTo(_s(a['entry_date'])));
  final shown = valid.where((e) => _dayInRange(day(e), range)).toList();
  // Outside the period, the latest measurement is still what a paediatrician asks for.
  final list = (shown.isNotEmpty ? shown : valid.take(1).toList()).take(maxRows).toList();
  if (list.isEmpty) return null;
  final prematurity = getPrematurityInfo(child.birthDate, child.dueDate);
  // Same reference as BabyGrowthTracker: corrected age (from the due date) for babies born preterm.
  final reference = prematurity.isPremature && child.dueDate != null && child.dueDate!.isNotEmpty ? child.dueDate! : child.birthDate;
  final sex = child.gender == 'boy' || child.gender == 'girl' ? child.gender : null;
  int? pct(String measure, double months, double? value) {
    if (sex == null || value == null || value <= 0) return null;
    return who.percentile(measure, sex, months, value);
  }

  String cell(double? value, int digits, int? p) => value == null || value <= 0 ? '—' : '${reportNumber(value, lang, digits)}${p == null ? '' : ' · P$p'}';
  final rows = [
    for (final e in list)
      () {
        final months = who.ageInMonths(reference, _s(e['entry_date']));
        final weight = _finite(e['weight_kg']), height = _finite(e['height_cm']), head = _finite(e['head_cm']);
        return (
          entry: e,
          months: months,
          weight: weight,
          height: height,
          head: head,
          wp: pct('weight', months, weight),
          hp: pct('height', months, height),
          hcp: pct('head', months, head),
        );
      }(),
  ];
  final latest = rows.first;
  final cards = <ReportRow>[
    if (latest.wp != null) ReportRow(tr('report_growth_weight_pct', 'Çəki persentili (ÜST)'), 'P${latest.wp} · ${reportNumber(latest.weight, lang, 2)} ${tr('report_kg', 'kq')}'),
    if (latest.hp != null) ReportRow(tr('report_growth_height_pct', 'Boy persentili (ÜST)'), 'P${latest.hp} · ${reportNumber(latest.height, lang, 1)} cm'),
    if (latest.hcp != null)
      ReportRow(tr('clinical_report_growth_head_pct', 'Baş çevrəsi persentili (ÜST)'), 'P${latest.hcp} · ${reportNumber(latest.head, lang, 1)} cm'),
  ];
  final notes = [tr('clinical_report_growth_note', 'Persentillər ÜST uşaq böyümə standartlarına əsaslanır (0-5 yaş).')];
  if (reference != child.birthDate) notes.add(tr('report_growth_corrected', 'Vaxtından əvvəl doğulduğu üçün korreksiya olunmuş yaş istifadə edilib.'));
  if (sex == null) notes.add(tr('report_growth_no_sex', 'Cinsiyyət qeyd edilmədiyi üçün persentil hesablanmayıb.'));
  return ReportSection(
    id: 'growth',
    title: tr('report_growth_title', 'Böyümə (ÜST persentilləri)'),
    rows: cards,
    note: notes.join(' '),
    table: ReportTable(
      headers: [
        tr('pdf_date', 'Tarix'),
        tr('report_growth_age', 'Yaş (ay)'),
        tr('report_growth_weight', 'Çəki, kq (P)'),
        tr('report_growth_height', 'Boy, cm (P)'),
        tr('clinical_report_growth_head', 'Baş çevrəsi, cm (P)'),
      ],
      rows: [
        for (final r in rows)
          [
            reportDate(day(r.entry)),
            r.months >= 0 ? reportNumber(r.months, lang, 1) : '—',
            cell(r.weight, 2, r.wp),
            cell(r.height, 1, r.hp),
            cell(r.head, 1, r.hcp),
          ],
      ],
      widths: const [1, 0.7, 1.1, 1.1, 0.9],
    ),
  );
}

// ── Assembly ─────────────────────────────────────────────────────────────────

/// `DoctorReportExtras` (tracker rows; vaccines `{schedule, logs}` come from the vaccine queries).
class DoctorReportExtras {
  const DoctorReportExtras({this.bloodSugar, this.kicks, this.contractions, this.epds, this.growth, this.vaccines});
  final List<ReportRowMap>? bloodSugar;
  final List<ReportRowMap>? kicks;
  final List<ReportRowMap>? contractions;
  final List<ReportRowMap>? epds;
  final List<ReportRowMap>? growth;
  final ({List<ReportRowMap> schedule, List<ReportRowMap> logs})? vaccines;

  DoctorReportExtras withVaccines(({List<ReportRowMap> schedule, List<ReportRowMap> logs})? v) =>
      DoctorReportExtras(bloodSugar: bloodSugar, kicks: kicks, contractions: contractions, epds: epds, growth: growth, vaccines: v);
}

/// Only the sections that belong to the life stage and have data.
List<ReportSection> buildClinicalSections(
  DoctorReportExtras extras, {
  required String stage,
  required ReportRange range,
  ReportChild? child,
  bool? includeEpds,
  DateTime? today,
  String? language,
}) {
  final sections = <ReportSection?>[];
  if (stage == 'bump') {
    sections.add(buildBloodSugarSection(extras.bloodSugar ?? const [], range, language: language));
    sections.add(buildKickSection(extras.kicks ?? const [], range, language: language));
    sections.add(buildContractionSection(extras.contractions ?? const [], range));
  }
  if ((stage == 'bump' || stage == 'mommy') && includeEpds != false) sections.add(buildEpdsSection(extras.epds ?? const [], range));
  if (stage == 'mommy' && child != null) {
    sections.add(buildGrowthSection(extras.growth ?? const [], child, range, language: language));
    if (extras.vaccines != null) sections.add(buildVaccineSection(extras.vaccines!.schedule, extras.vaccines!.logs, child, range, today));
  }
  return [for (final s in sections) ?s];
}
