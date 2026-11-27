// Ported from: src/components/tools/VaccineCalendar.tsx
//
// Vaccination plan of the selected child for the child's programme country (explicit child choice → account →
// stored country → legacy child country → app language): stats, progress, reminders switch (native only), tabs
// (upcoming / full plan grouped by schedule age / done), detail sheet with done / skipped / reset, and the action
// dialog. The country choice is saved on the child (`user_children.vaccine_country_code`) and only applied once
// the write is confirmed.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/app_languages.dart' show appLanguage;
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/vaccines/vaccine_schedule.dart';
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../settings/ui/settings_ui.dart' show DateFieldBox, ShadButton, ShadButtonVariant, ShadDialogFrame, ShadInput, Tw, shadTitle, showShadDialog;
import '../baby_tracker/bt_ui.dart' show ACtaButton;
import '../kit/kit.dart';
import 'vaccine_labels.dart';
import 'vaccine_reminders.dart';
import 'vaccines_data.dart';

/// Opens the programme source link (`<a target="_blank">`). Tests override it.
final vaccineLinkLauncherProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    });

typedef _StatusMeta = ({String Function() label, AIconData icon, Color Function(ATokens a) bg, Color Function(ATokens a) ink});

final Map<String, _StatusMeta> _status = {
  'done': (label: () => tr('vaccinecalendar_vuruldu', 'Vuruldu'), icon: AIcons.circleCheck, bg: (a) => a.green1, ink: (a) => a.greenInk),
  'pending': (label: () => tr('vaccinecalendar_gozlemede_80f70e', 'Gözləmədə'), icon: AIcons.clock, bg: (a) => a.yellow1, ink: (a) => a.warnInk),
  'overdue': (label: () => tr('vaccinecalendar_gecikdi', 'Gecikdi'), icon: AIcons.triangleAlert, bg: (a) => a.pink1, ink: (a) => a.pinkInk),
  'skipped': (label: () => tr('vaccinecalendar_buraxildi_61c6a0', 'Buraxıldı'), icon: AIcons.ban, bg: (a) => a.surfaceSoft, ink: (a) => a.inkSoft),
  'future': (label: () => tr('vaccinecalendar_novbede_b7ecbc', 'Növbədə'), icon: AIcons.clock, bg: (a) => a.blue1, ink: (a) => a.blueInk),
  'conditional': (label: () => regionalText('conditional', currentLanguage()), icon: AIcons.info, bg: (a) => a.surfaceSoft, ink: (a) => a.inkSoft),
  'seasonal': (label: () => regionalText('seasonal', currentLanguage()), icon: AIcons.calendar, bg: (a) => a.surfaceSoft, ink: (a) => a.inkSoft),
  'interval': (label: () => regionalText('interval', currentLanguage()), icon: AIcons.info, bg: (a) => a.surfaceSoft, ink: (a) => a.inkSoft),
};

/// `parseISO(iso).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })`.
String formatVaccineDate(String iso, String language) {
  final d = parseIsoDateFns(iso);
  if (d == null) return '';
  try {
    final locale = appLanguage(language).intlLocale;
    final base = DateFormat.yMMMMd(locale).pattern ?? 'd MMMM y';
    final pattern = base.replaceAllMapped(RegExp(r'(?<!d)d(?!d)'), (_) => 'dd');
    return (DateFormat(pattern, locale)..useNativeDigits = false).format(d);
  } catch (_) {
    return formatYmd(d);
  }
}

/// `#rrggbb` + alpha suffix (`${color_hex}1f`).
Color? _hex(String? hex, [int alpha = 0xFF]) {
  if (hex == null) return null;
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(hex.trim());
  if (m == null) return null;
  return Color((alpha << 24) | int.parse(m[1]!, radix: 16));
}

class _Item {
  const _Item(this.row, this.log, this.status);
  final VaccineScheduleRow row;
  final ChildVaccination? log;
  final VaccineStatus status;
}

class VaccineCalendar extends ConsumerStatefulWidget {
  const VaccineCalendar({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<VaccineCalendar> createState() => _VaccineCalendarState();
}

class _VaccineCalendarState extends ConsumerState<VaccineCalendar> {
  ({String childId, String code})? _countryOverride;
  bool _savingCountry = false;
  String _tab = 'upcoming';
  String? _scopeKey;
  late bool _remindersOn = ref.read(vaccineRemindersProvider).enabled;
  VaccineReminderResult? _reminderResult;
  String _reminderKey = '';
  bool _detailOpen = false;

  void _toast({String? title, String? description, bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  Future<void> _changeCountry(String code, Child selected, List<VaccineCountry> countries) async {
    final user = ref.read(authUserProvider);
    if (user == null || _savingCountry || !countries.any((c) => c.code == code)) return;
    final childId = selected.id;
    final lang = ref.read(appLanguageProvider);
    setState(() => _savingCountry = true);
    try {
      final data = await ref.read(vaccinesRepositoryProvider).updateChildVaccineCountry(childId, user.id, code);
      if (data == null || data['id'] != childId || data['vaccine_country_code'] != code) throw StateError('VACCINE_COUNTRY_WRITE_UNCONFIRMED');
      if (mounted) setState(() => _countryOverride = (childId: childId, code: code));
      await ref.read(childrenActionsProvider).refetch();
    } catch (_) {
      _toast(title: regionalText('countrySaveFailed', lang), destructive: true);
    } finally {
      if (mounted) setState(() => _savingCountry = false);
    }
  }

  void _syncReminders({
    required bool supported,
    required Child? child,
    required List<Child> children,
    required bool scheduleReady,
    required bool logsReady,
    required List<ChildVaccination> logs,
    required List<_Item> items,
    required String lang,
  }) {
    if (!supported || child == null || !scheduleReady || !logsReady) return;
    final reminders = ref.read(vaccineRemindersProvider);
    final childName = child.name;
    final childIds = [for (final c in children) c.id];
    final baseId = _remindersOn ? reminders.vaccineChildBase(child.id, childIds.contains(child.id) ? childIds : [...childIds, child.id]) : null;
    final logMap = {for (final l in logs) if (l.vaccineScheduleId != null) l.vaccineScheduleId!: l.like};
    final doses = [for (final i in items) ReminderDose(id: i.row.id, status: i.status, due: vaccineDueDate(i.row.schedule, child.birthDate, logMap))];
    final slots = _remindersOn && baseId != null ? vaccineReminderSlots(doses, DomainClock.now(), baseId) : <VaccineReminderSlot>[];
    final key = vaccineSlotsKey(slots, '$_remindersOn:$lang:${child.id}:$childName');
    if (_reminderKey == key) return;
    _reminderKey = key;
    if (!_remindersOn) {
      unawaited(reminders.cancelAll().then((r) {
        if (mounted) setState(() => _reminderResult = r);
      }));
      return;
    }
    if (baseId == null) return;
    final byId = {for (final i in items) i.row.id: i.row};
    unawaited(reminders.sync(slots, (slot) => vaccineReminderText(slot.kind, childName, byId[slot.doseId], lang), baseId: baseId).then((r) {
      if (mounted) setState(() => _reminderResult = r);
    }));
  }

  void _toggleReminders() {
    final next = !_remindersOn;
    ref.read(vaccineRemindersProvider).enabled = next;
    setState(() => _remindersOn = next);
  }

  Future<void> _openDetail(VaccineScheduleRow row, Child child, String country, List<ChildVaccination> logs, String lang) async {
    _detailOpen = true;
    final scope = '${child.id}:$country';
    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DetailSheet(row: row, hasLog: logs.any((l) => l.vaccineScheduleId == row.id), language: lang),
    );
    _detailOpen = false;
    if (!mounted || action == null || _scopeKey != scope) return;
    if (action == 'reset') {
      ChildVaccination? log;
      for (final l in logs) {
        if (l.vaccineScheduleId == row.id) log = l;
      }
      if (log != null) {
        await ref.read(vaccinesActionsProvider).delete(id: log.id, childId: child.id);
        _toast(title: tr('vaccinecalendar_status_sifirlandi_77a21e', 'Status sıfırlandı'));
      }
      return;
    }
    await _openAction(row, child, country, action, lang);
  }

  Future<void> _openAction(VaccineScheduleRow row, Child child, String country, String mode, String lang) async {
    final scope = '${child.id}:$country:${row.id}';
    await showShadDialog<void>(
      context,
      builder: (ctx) => _ActionDialog(
        mode: mode,
        row: row,
        onSubmit: (payload) async {
          final selected = ref.read(childrenProvider).selectedChild;
          final current = '${selected?.id}:${_effectiveCountry(selected)}:${row.id}';
          if (selected == null || selected.id != child.id || row.countryCode != country || current != scope) return false;
          await ref.read(vaccinesActionsProvider).upsert({
            'child_id': child.id,
            'vaccine_schedule_id': row.id,
            'country_code': country,
            ...payload,
          });
          final after = ref.read(childrenProvider).selectedChild;
          if ('${after?.id}:${_effectiveCountry(after)}:${row.id}' != scope) return false;
          _toast(title: tr('vaccinecalendar_yadda_saxlandi_f72ffd', 'Yadda saxlandı'), description: vaccineDisplayName(row, lang));
          return true;
        },
      ),
    );
  }

  String _effectiveCountry(Child? child) {
    final o = _countryOverride;
    if (o != null && o.childId == child?.id) return o.code;
    final lang = ref.read(appLanguageProvider);
    return regionalCountry(lang, [child?.vaccineCountryCode, ref.read(authProfileProvider)?.countryCode, ref.read(userStoreProvider).countryCode, child?.countryCode]);
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(appLanguageProvider);
    final childrenView = ref.watch(childrenProvider);
    final children = childrenView.children;
    final selected = childrenView.selectedChild;
    final profileCountry = ref.watch(authProfileProvider)?.countryCode;
    final storedCountry = ref.watch(userStoreProvider.select((s) => s.countryCode));
    final countries = ref.watch(vaccineCountriesQuery).data ?? const <VaccineCountry>[];
    final accountCountry = regionalCountry(lang, [profileCountry, storedCountry]);
    final ordered = [...countries.where((c) => c.code == accountCountry), ...countries.where((c) => c.code != accountCountry)];
    final o = _countryOverride;
    final effectiveCountry = o != null && o.childId == selected?.id
        ? o.code
        : regionalCountry(lang, [selected?.vaccineCountryCode, profileCountry, storedCountry, selected?.countryCode]);

    final scheduleQ = ref.watch(vaccineScheduleQuery(effectiveCountry));
    final schedule = scheduleQ.data ?? const <VaccineScheduleRow>[];
    final logsQ = ref.watch(childVaccinationsQuery(selected?.id));
    final logs = logsQ.data ?? const <ChildVaccination>[];

    // Selected child / country changed: close the detail sheet and the action dialog.
    final scope = '${selected?.id}:$effectiveCountry';
    if (_scopeKey != null && _scopeKey != scope && _detailOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).popUntil((r) => r is! PopupRoute);
      });
    }
    _scopeKey = scope;

    final logMap = {for (final l in logs) if (l.vaccineScheduleId != null) l.vaccineScheduleId!: l};
    final likeMap = {for (final e in logMap.entries) e.key: e.value.like};
    final items = selected == null
        ? <_Item>[]
        : [
            for (final r in schedule)
              if ((r.vaccine.isActive || logMap.containsKey(r.id)) && vaccineEligible(r.schedule, selected.birthDate, selected.gender, logMap[r.id]?.like))
                _Item(r, logMap[r.id], vaccineStatus(r.schedule, selected.birthDate, likeMap)),
          ];

    final scheduler = ref.watch(vaccineNotificationSchedulerProvider);
    final remindersSupported = scheduler.isNativePlatform;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncReminders(
        supported: remindersSupported,
        child: selected,
        children: children,
        scheduleReady: scheduleQ.isSuccess,
        logsReady: logsQ.isSuccess,
        logs: logs,
        items: items,
        lang: lang,
      );
    });

    final a = context.a;
    final x = context.aText;
    final header = ToolHeader(
      eyebrow: tr('vaccine_national_schedule', 'Milli İmmunizasiya Qrafiki'),
      title: tr('vaccinecalendar_peyvend_teqvimi_d84c87', 'Peyvənd Təqvimi'),
      onBack: widget.onBack,
      actions: [AIcon(AIcons.sparkles, size: 16, color: a.peach2)],
    );

    if (selected == null) {
      return AScope(
        child: ColoredBox(
          color: a.bg,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: header),
            ConstrainedBox(
              constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.5),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.syringe, size: 44, color: a.inkFaint)),
                  Text(tr('vaccinecalendar_usaq_secilmeyib_a26423', 'Uşaq seçilməyib'), textAlign: TextAlign.center, style: x.aListTitle.copyWith(fontSize: 15)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(tr('vaccinecalendar_peyvend_teqvimini_gormek_ucun__8ce451', 'Peyvənd təqvimini görmək üçün əvvəlcə uşaq profili yaradın.'),
                        textAlign: TextAlign.center, style: x.aListSub),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      );
    }

    final routine = items.where((i) => i.row.timing == null || i.row.timing!.kind == 'routine').toList();
    final total = routine.length;
    final done = routine.where((i) => i.status == 'done').length;
    final overdue = routine.where((i) => i.status == 'overdue').length;
    final upcoming = routine.where((i) => const ['pending', 'overdue', 'interval'].contains(i.status)).length;
    final pct = total == 0 ? 0 : jsRoundInt(done / total * 100);

    final upcomingRows = jsSorted(items.where((i) => const ['overdue', 'pending', 'future', 'interval'].contains(i.status)),
            (_Item p, _Item q) => p.row.recommendedAgeDays - q.row.recommendedAgeDays)
        .take(30)
        .toList();
    final doneRows = jsSorted(items.where((i) => i.status == 'done'), (_Item p, _Item q) => (q.log?.administeredAt ?? '').compareTo(p.log?.administeredAt ?? ''));
    final grouped = vaccineAgeGroups<_Item>(items, (i) => i.row, lang);
    VaccineCountry? country;
    for (final c in countries) {
      if (c.code == effectiveCountry) country = c;
    }
    final age = getChildAge(selected);

    Widget statusBadge(String s) {
      final meta = _status[s]!;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(color: meta.bg(a), borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          AIcon(meta.icon, size: 11, strokeWidth: 2.2, color: meta.ink(a)),
          const SizedBox(width: 4),
          Text(meta.label(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: meta.ink(a), height: 1.5)),
        ]),
      );
    }

    Widget card(_Item item) {
      final color = _hex(item.row.vaccine.colorHex) ?? a.peach2;
      return Padding(
        key: ValueKey('vaccine-card-${item.row.id}'),
        padding: const EdgeInsets.only(bottom: 10),
        child: PressScale(
          scale: 0.98,
          onTap: () => unawaited(_openDetail(item.row, selected, effectiveCountry, logs, lang)),
          child: ACard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: color.withValues(alpha: 0x1f / 255), borderRadius: BorderRadius.circular(13)),
                child: AIcon(AIcons.syringe, size: 17, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Row(children: [
                    Flexible(child: Text(vaccineDisplayName(item.row, lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle)),
                    if (item.row.timing == null && !item.row.vaccine.isMandatory) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                        child: Text(tr('vaccinecalendar_konullu_6b1c0e', 'könüllü'), style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5)),
                      ),
                    ],
                  ]),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('${vaccineAgeLabel(item.row, lang)} · ${vaccineDoseLabel(item.row, lang)}', style: x.aListSub),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      statusBadge(item.status),
                      if ((item.log?.administeredAt ?? '').isNotEmpty)
                        Text(formatVaccineDate(item.log!.administeredAt!, lang), style: x.aListTime),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      );
    }

    Widget flag(VaccineCountry? c, {double w = 15, double h = 11}) {
      final f = c?.flagEmoji;
      if (f != null && !f.startsWith('data:') && f.length > 10) {
        try {
          return ClipRRect(borderRadius: BorderRadius.circular(2), child: Image.memory(UriData.parse('data:image/png;base64,$f').contentAsBytes(), width: w, height: h, fit: BoxFit.cover));
        } catch (_) {}
      }
      return Text(f == null || f.isEmpty ? '🌍' : f);
    }

    Future<void> pickCountry(BuildContext anchor) async {
      final box = anchor.findRenderObject() as RenderBox?;
      if (box == null) return;
      final origin = box.localToGlobal(Offset(0, box.size.height));
      final code = await showMenu<String>(
        context: context,
        position: RelativeRect.fromLTRB(origin.dx, origin.dy + 4, 16, 0),
        constraints: const BoxConstraints(minWidth: 224, maxWidth: 224),
        items: [
          for (final c in ordered)
            PopupMenuItem<String>(
              key: ValueKey('vaccine-country-option-${c.code}'),
              value: c.code,
              enabled: !_savingCountry,
              child: Row(children: [flag(c, w: 16, h: 12), const SizedBox(width: 8), Flexible(child: Text(c.name ?? c.code, style: Tw.sm))]),
            ),
        ],
      );
      if (code != null) await _changeCountry(code, selected, countries);
    }

    Future<void> pickChild(BuildContext anchor) async {
      final box = anchor.findRenderObject() as RenderBox?;
      if (box == null) return;
      final origin = box.localToGlobal(Offset(0, box.size.height));
      final id = await showMenu<String>(
        context: context,
        position: RelativeRect.fromLTRB(origin.dx, origin.dy + 4, origin.dx + 1, 0),
        items: [for (final c in children) PopupMenuItem<String>(value: c.id, child: Text('${c.avatarEmoji} ${c.name}', style: Tw.sm))],
      );
      if (id == null) return;
      for (final c in children) {
        if (c.id == id) ref.read(childrenActionsProvider).setSelectedChild(c);
      }
    }

    Widget stat(String label, int value, Color color) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              Text('$value', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, height: 1, color: color)),
              const SizedBox(height: 2),
              Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
            ]),
          ),
        );

    final note = country?.note(lang);
    final sourceUrl = country?.sourceUrl;

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        header,
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
                child: Text(selected.avatarEmoji, style: const TextStyle(fontSize: 19)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  if (children.length > 1)
                    Builder(
                      builder: (anchor) => GestureDetector(
                        key: const ValueKey('vaccine-child'),
                        onTap: () => unawaited(pickChild(anchor)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Flexible(child: Text(selected.name, style: x.aListTitle)),
                          const SizedBox(width: 4),
                          const AIcon(AIcons.chevronDown, size: 12),
                        ]),
                      ),
                    )
                  else
                    Text(selected.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
                  Padding(padding: const EdgeInsets.only(top: 2), child: Text(age.displayText, style: x.aListSub)),
                ]),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Builder(
                  builder: (anchor) => Semantics(
                    button: true,
                    enabled: !_savingCountry,
                    child: GestureDetector(
                      key: const ValueKey('vaccine-country'),
                      onTap: _savingCountry ? null : () => unawaited(pickCountry(anchor)),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                        child: DefaultTextStyle.merge(
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            flag(country),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                country?.name ?? localizedCountryName(effectiveCountry, lang),
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                            const SizedBox(width: 6),
                            const AIcon(AIcons.chevronDown, size: 11),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Row(children: [
                stat(tr('vaccinecalendar_cemi_84214a', 'Cəmi'), total, a.ink),
                const SizedBox(width: 6),
                stat(tr('vaccine_stat_done', 'Tamam'), done, a.greenInk),
                const SizedBox(width: 6),
                stat(tr('vaccine_stat_pending', 'Qalan'), upcoming, a.warnInk),
                const SizedBox(width: 6),
                stat(tr('vaccinecalendar_geciken_c7adb0', 'Gecikən'), overdue, a.pinkInk),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(tr('vaccinecalendar_tereqqi_9cf2fe', 'Tərəqqi'), style: x.aListSub),
                    Text('$pct%', style: x.aListValue.copyWith(color: a.accentInk)),
                  ]),
                ),
                Container(
                  height: 6,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
                  alignment: AlignmentDirectional.centerStart,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: pct / 100),
                    duration: const Duration(milliseconds: 600),
                    builder: (context, v, _) => FractionallySizedBox(
                      widthFactor: v,
                      child: Container(decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(999))),
                    ),
                  ),
                ),
              ]),
            ),
            if (age.isPremature)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                child: Text(
                  'ℹ️ ${tr('vaccine_preemie_note', 'Vaxtından əvvəl doğulan körpələrdə peyvəndlər korreksiya olunmuş yaşa görə DEYİL, real doğum tarixinə görə vurulur (beynəlxalq standart). Təqvim dəyişməz qalır.')}',
                  style: TextStyle(fontSize: 11, color: a.inkSoft, height: 1.5),
                ),
              ),
            if (note != null)
              Padding(
                key: const ValueKey('vaccine-programme-note'),
                padding: const EdgeInsets.only(top: 10),
                child: Text(note, style: x.aListSub),
              ),
          ]),
        ),
        if (remindersSupported)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(
              toggled: _remindersOn,
              button: true,
              child: GestureDetector(
                key: const ValueKey('vaccine-reminders'),
                behavior: HitTestBehavior.opaque,
                onTap: _toggleReminders,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
                  child: Row(children: [
                    ExcludeSemantics(child: AIcon(AIcons.bell, size: 18, strokeWidth: 2.2, color: a.peach2)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text(tr('sleepvax_vax_reminders_title', 'Peyvənd xatırlatmaları'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink, height: 1.5)),
                        const SizedBox(height: 2),
                        Text(
                          _remindersOn && _reminderResult == 'denied'
                              ? tr('sleepvax_vax_reminders_denied', 'Bildirişlər telefonun ayarlarında bağlıdır.')
                              : tr('sleepvax_vax_reminders_sub', 'Doza tarixindən 3 gün əvvəl və həmin gün, saat 10:00-da'),
                          style: x.aListSub,
                        ),
                      ]),
                    ),
                    const SizedBox(width: 12),
                    A3SwitchView(on: _remindersOn),
                  ]),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
            child: Row(children: [
              for (final t in [
                (k: 'upcoming', l: tr('vaccinecalendar_yaxinlasan_773e16', 'Yaxınlaşan')),
                (k: 'all', l: tr('vaccinecalendar_tam_qrafik', 'Tam qrafik')),
                (k: 'done', l: tr('vaccinecalendar_tamamlanmis_e36252', 'Tamamlanmış')),
              ])
                Expanded(
                  child: GestureDetector(
                    key: ValueKey('vaccine-tab-${t.k}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _tab = t.k),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: _tab == t.k ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                      child: Text(t.l, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aTab.copyWith(color: _tab == t.k ? a.accentInk : a.inkSoft)),
                    ),
                  ),
                ),
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (scheduleQ.isLoading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(tr('vaccinecalendar_yuklenir_5557de', 'Yüklənir...'), textAlign: TextAlign.center, style: x.aListSub),
              ),
            if (scheduleQ.isError)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Semantics(
                  liveRegion: true,
                  child: ACard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(regionalText('scheduleError', lang), style: x.aListSub),
                      const SizedBox(height: 8),
                      ShadButton(
                        variant: ShadButtonVariant.outline,
                        onPressed: () => unawaited(ref.read(vaccineScheduleQuery(effectiveCountry).notifier).refetch()),
                        child: Text(regionalText('retry', lang)),
                      ),
                    ]),
                  ),
                ),
              ),
            if (!scheduleQ.isLoading && !scheduleQ.isError && schedule.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ACard(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.globe, size: 36, color: a.inkFaint)),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(tr('vaccinecalendar_bu_olke_ucun_qrafik_hele_hazir_726119', 'Bu ölkə üçün qrafik hələ hazırlanmayıb'), textAlign: TextAlign.center, style: x.aListTitle),
                    ),
                    Text(tr('vaccinecalendar_tezlikle_elave_olunacaq_da1414', 'Tezliklə əlavə olunacaq.'), textAlign: TextAlign.center, style: x.aListSub),
                  ]),
                ),
              ),
            if (_tab == 'upcoming') ...upcomingRows.map(card),
            if (_tab == 'done')
              if (doneRows.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(tr('vaccinecalendar_hele_tamamlanmis_peyvend_yoxdu_c76148', 'Hələ tamamlanmış peyvənd yoxdur.'), textAlign: TextAlign.center, style: x.aListSub),
                )
              else
                ...doneRows.map(card),
            if (_tab == 'all')
              for (var gi = 0; gi < grouped.length; gi++)
                Padding(
                  key: ValueKey('vaccine-age-group-${grouped[gi].days}'),
                  padding: EdgeInsets.only(top: gi == 0 ? 0 : 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                      child: Row(children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999))),
                        const SizedBox(width: 8),
                        Text(cssUpperVaccine(grouped[gi].label), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.05, color: a.inkSoft, height: 1.5)),
                        const SizedBox(width: 8),
                        Expanded(child: Container(height: 1, color: a.lineStrong)),
                      ]),
                    ),
                    ...grouped[gi].items.map(card),
                  ]),
                ),
          ]),
        ),
        SafetyStrip(signs: tr('safety_vaccine_signs', 'Peyvənddən sonra zəng edin: nəfəs çətinliyi, üzdə şişkinlik, yüksək hərarət, qıcolma')),
        if (sourceUrl != null && sourceUrl.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: GestureDetector(
              key: const ValueKey('vaccine-source'),
              onTap: () {
                final uri = Uri.tryParse(sourceUrl);
                if (uri != null) unawaited(ref.read(vaccineLinkLauncherProvider)(uri));
              },
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                AIcon(AIcons.info, size: 11, color: a.inkSoft),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    '${tr('vaccinecalendar_menbe_87d8be', 'Mənbə:')} '
                    '${lang == 'en' && (country?.sourceLabel ?? '').contains('Səhiyyə Nazirliyi') ? 'Ministry of Health of the Republic of Azerbaijan — National Immunization Schedule' : ((country?.sourceLabel ?? '').isNotEmpty ? country!.sourceLabel! : sourceUrl)}',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5),
                  ),
                ),
                const SizedBox(width: 6),
                AIcon(AIcons.externalLink, size: 9, color: a.inkSoft),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// `.a-today-info-eyebrow` text-transform (dotted İ for az/tr).
String cssUpperVaccine(String s) {
  final lang = currentLanguage();
  return (lang == 'az' || lang == 'tr' ? s.replaceAll('i', 'İ') : s).toUpperCase();
}

/// `.a3-switch` (46×28 pill, 22px knob; on: coral-strong, knob +18).
class A3SwitchView extends StatelessWidget {
  const A3SwitchView({super.key, required this.on});
  final bool on;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 46,
      height: 28,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: on ? a.coralStrong : a.lineStrong, borderRadius: BorderRadius.circular(999)),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 200),
        alignment: on ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: Container(
          width: 22,
          height: 22,
          // background #fff; box-shadow 0 1px 3px rgba(0,0,0,.2) (anacan-design.css .a3-switch::after)
          decoration: const BoxDecoration(color: Color(0xFFFFFFFF), shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x33000000), offset: Offset(0, 1), blurRadius: 3)]),
        ),
      ),
    );
  }
}

/// Detail sheet (shadcn Sheet, bottom, 85vh). Pops 'done' | 'skip' | 'reset' or null.
class _DetailSheet extends StatelessWidget {
  const _DetailSheet({required this.row, required this.hasLog, required this.language});
  final VaccineScheduleRow row;
  final bool hasLog;
  final String language;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final color = _hex(row.vaccine.colorHex) ?? const Color(0xFFFF5A5F); // '#FF5A5F' (VaccineCalendar.tsx:448)
    final v = row.vaccine;
    Widget detail(String label, String value) => Container(
          decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: a.peach2, width: 2))),
          padding: const EdgeInsetsDirectional.only(start: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(cssUpperVaccine(label), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.05, color: a.inkSoft, height: 1.5)),
            Padding(padding: const EdgeInsets.only(top: 2), child: Text(value, style: TextStyle(fontSize: 13, height: 1.6, color: a.ink))),
          ]),
        );
    final children = <Widget>[
      if ((v.shortDescription ?? '').isNotEmpty) Text(v.shortDescription!, style: TextStyle(fontSize: 13, height: 1.625, color: s.foreground)),
      if ((v.fullDescription ?? '').isNotEmpty)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
          child: Text(v.fullDescription!, style: TextStyle(fontSize: 12, height: 1.625, color: a.ink)),
        ),
      if ((v.disease ?? '').isNotEmpty) detail(tr('vaccinecalendar_qarsisi_alinan_xestelik_862a71', 'Qarşısı alınan xəstəlik'), v.disease!),
      if ((v.route ?? '').isNotEmpty) detail(tr('vaccinecalendar_vurma_usulu_689cd3', 'Vurma üsulu'), vaccineRouteLabel(row, language)),
      if ((v.sideEffects ?? '').isNotEmpty) detail(tr('vaccinecalendar_mumkun_yan_tesirler_fc6796', 'Mümkün yan təsirlər'), v.sideEffects!),
      if ((v.contraindications ?? '').isNotEmpty) detail(tr('vaccinecalendar_eks_gosterisler_f34875', 'Əks-göstərişlər'), v.contraindications!),
      if ((row.notes ?? '').isNotEmpty) detail(tr('untranslated_qeyd_z0999u', 'Qeyd'), row.notes!),
      if ((row.timingSourceUrl ?? '').isNotEmpty)
        Consumer(
          builder: (context, ref, _) => GestureDetector(
            onTap: () {
              final uri = Uri.tryParse(row.timingSourceUrl!);
              if (uri != null) unawaited(ref.read(vaccineLinkLauncherProvider)(uri));
            },
            child: Row(children: [
              AIcon(AIcons.externalLink, size: 12, color: a.inkSoft),
              const SizedBox(width: 6),
              Flexible(child: Text('${regionalText('source', language)}: ${row.timingSourceLabel ?? ''}', style: context.aText.aListSub)),
            ]),
          ),
        ),
      Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(children: [
          Expanded(
            child: ACtaButton(
              key: const ValueKey('vaccine-done'),
              background: a.green2,
              icon: AIcons.circleCheck,
              label: tr('vaccinecalendar_vuruldu', 'Vuruldu'),
              onPressed: () => Navigator.of(context).pop('done'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ACtaButton(
              key: const ValueKey('vaccine-skip'),
              soft: true,
              icon: AIcons.ban,
              label: tr('vaccinecalendar_buraxildi_61c6a0', 'Buraxıldı'),
              onPressed: () => Navigator.of(context).pop('skip'),
            ),
          ),
        ]),
      ),
      if (hasLog)
        ShadButton(
          key: const ValueKey('vaccine-reset'),
          variant: ShadButtonVariant.ghost,
          expand: true,
          height: 36,
          foreground: TwColors.red500,
          onPressed: () => Navigator.of(context).pop('reset'),
          child: Text(tr('vaccinecalendar_statusu_sifirla_dce807', 'Statusu sıfırla')),
        ),
    ];
    return AScope(
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.85,
        decoration: BoxDecoration(color: s.background, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
        child: Stack(children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: color.withValues(alpha: 0x1a / 255), borderRadius: BorderRadius.circular(16)),
                  child: AIcon(AIcons.syringe, size: 24, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(vaccineDisplayName(row, language), style: Tw.base.copyWith(fontWeight: FontWeight.w600, color: s.foreground)),
                    Text('${vaccineAgeLabel(row, language)} • ${vaccineDoseLabel(row, language)}', style: TextStyle(fontSize: 11, color: s.mutedForeground, height: 1.5)),
                  ]),
                ),
                const SizedBox(width: 24),
              ]),
              const SizedBox(height: 16),
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 12), children[i]],
            ]),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Opacity(opacity: 0.7, child: AIcon(AIcons.x, size: 16, color: s.foreground)),
            ),
          ),
        ]),
      ),
    );
  }
}

/// "Done" / "skipped" dialog. [onSubmit] returns true when the dialog should close.
class _ActionDialog extends StatefulWidget {
  const _ActionDialog({required this.mode, required this.row, required this.onSubmit});
  final String mode;
  final VaccineScheduleRow row;
  final Future<bool> Function(Map<String, Object?> payload) onSubmit;
  @override
  State<_ActionDialog> createState() => _ActionDialogState();
}

class _ActionDialogState extends State<_ActionDialog> {
  final String _today = formatYmd(DomainClock.now());
  late String _date = _today;
  final _location = TextEditingController();
  final _batch = TextEditingController();
  final _notes = TextEditingController();
  final _reason = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _location.dispose();
    _batch.dispose();
    _notes.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit(Map<String, Object?> payload) async {
    if (_saving) return;
    setState(() => _saving = true);
    var close = false;
    try {
      close = await widget.onSubmit(payload);
    } catch (_) {
      if (mounted) AToastHost.of(context).show(title: tr('usecommunity_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
    if (close && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final lang = currentLanguage();
    final s = context.tokens.shadcn;
    final label = Tw.xs.copyWith(fontWeight: FontWeight.w500, color: s.foreground);
    Widget field(String l, Widget input) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(l, style: label), const SizedBox(height: 8), input]);
    final done = widget.mode == 'done';
    return ShadDialogFrame(
      radius: 8,
      maxWidth: 384,
      inset: 16,
      children: [
        Text(done ? tr('vaccinecalendar_peyvend_vuruldu_22c2e5', 'Peyvənd vuruldu') : tr('vaccinecalendar_peyvendi_buraxildi_kimi_qeyd_e_64265a', 'Peyvəndi buraxıldı kimi qeyd et'),
            style: shadTitle(context)),
        Transform.translate(
          offset: const Offset(0, -8),
          child: Text('${vaccineDisplayName(widget.row, lang)} • ${vaccineDoseLabel(widget.row, lang)}', style: Tw.xs.copyWith(color: s.mutedForeground)),
        ),
        if (done) ...[
          field(tr('untranslated_tarix_6hhkyx', 'Tarix'),
              DateFieldBox(fieldKey: const ValueKey('vaccine-date'), value: _date, max: DomainClock.now(), height: 40, radius: 6, onChanged: (v) => setState(() => _date = v))),
          field(tr('vaccinecalendar_yer_xestexana_klinika_d8c111', 'Yer (xəstəxana/klinika)'),
              ShadInput(controller: _location, placeholder: tr('vaccinecalendar_yer_ph', 'məs. Bakı Uşaq Klinik Xəstəxanası'))),
          field(tr('vaccinecalendar_partiya_nomresi_isteye_bagli_4b290a', 'Partiya nömrəsi (istəyə bağlı)'), ShadInput(controller: _batch)),
          field(tr('untranslated_qeyd_z0999u', 'Qeyd'), ShadInput(controller: _notes, maxLines: 2)),
          ShadButton(
            key: const ValueKey('vaccine-save'),
            expand: true,
            background: TwColors.emerald500,
            onPressed: _saving || _date.isEmpty || _date.compareTo(_today) > 0
                ? null
                : () => unawaited(_submit({
                      'administered_at': _date,
                      'is_skipped': false,
                      'skip_reason': null,
                      'location_az': _location.text.isEmpty ? null : _location.text,
                      'batch_number': _batch.text.isEmpty ? null : _batch.text,
                      'notes': _notes.text.isEmpty ? null : _notes.text,
                    })),
            child: Text(tr('untranslated_yadda_saxla_bpdu9v', 'Yadda saxla')),
          ),
        ] else ...[
          field(tr('vaccinecalendar_sebeb_7b51f1', 'Səbəb'), ShadInput(controller: _reason, maxLines: 3, placeholder: tr('vaccinecalendar_sebeb_ph', 'məs. Tibbi əks-göstəriş'))),
          ShadButton(
            key: const ValueKey('vaccine-confirm-skip'),
            variant: ShadButtonVariant.outline,
            expand: true,
            onPressed: _saving ? null : () => unawaited(_submit({'administered_at': null, 'is_skipped': true, 'skip_reason': _reason.text.isEmpty ? null : _reason.text})),
            child: Text(tr('vaccinecalendar_tesdiq_et_87b1a4', 'Təsdiq et')),
          ),
        ],
      ],
    );
  }
}
