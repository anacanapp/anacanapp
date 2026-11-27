// Ported from: src/components/home/AppointmentSheet.tsx (add / edit / delete one appointment; used from the home
//              "Upcoming" list and the calendar), src/styles/anacan-design.css (.a3-form, .a3-form-row, .a3-field,
//              .a3-appt-types, .a3-chip-btn, .a3-appt-bar, .a3-switch-row, .a3-switch)
//
// Reminders are pushed by the server (day before at 10:00 and 2 hours before); this only stores the switch.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../data/appointments.dart';

String rd(String key, [Map<String, Object?>? vars]) => copyText('redesign', key, vars: vars);

/// `APPOINTMENT_TYPES`.
const List<({String id, String key, String icon})> appointmentTypes = [
  (id: 'appointment', key: 'appt_type_doctor', icon: '🩺'),
  (id: 'ultrasound', key: 'appt_type_ultrasound', icon: '🫄'),
  (id: 'test', key: 'appt_type_test', icon: '🧪'),
  (id: 'pill', key: 'appt_type_pill', icon: '💊'),
  (id: 'reminder', key: 'appt_type_other', icon: '🔔'),
];

/// `appointmentIcon(type)`.
String appointmentIcon(String? type) => appointmentTypes.where((t) => t.id == type).firstOrNull?.icon ?? appointmentTypes.first.icon;

/// Opens the sheet (`<AppointmentSheet open … />`). Completes when it closes.
Future<void> showAppointmentSheet(BuildContext context, {Appointment? appointment, DateTime? defaultDate}) {
  return Navigator.of(context, rootNavigator: true).push<void>(ASheetRoute<void>(
    builder: (ctx) => AppointmentSheet(
      appointment: appointment,
      defaultDate: defaultDate,
      onClose: () => Navigator.of(ctx).maybePop(),
    ),
  ));
}

class AppointmentSheet extends ConsumerStatefulWidget {
  const AppointmentSheet({super.key, required this.onClose, this.appointment, this.defaultDate, this.now});
  final VoidCallback onClose;

  /// Edit this appointment; null adds a new one.
  final Appointment? appointment;

  /// Prefilled date for a new appointment (defaults to today).
  final DateTime? defaultDate;
  final DateTime Function()? now;

  @override
  ConsumerState<AppointmentSheet> createState() => AppointmentSheetState();
}

class AppointmentSheetState extends ConsumerState<AppointmentSheet> {
  final TextEditingController _title = TextEditingController();
  final TextEditingController _note = TextEditingController();
  String _type = 'appointment';
  String _date = '';
  String _time = '';
  bool _remind = true;
  bool _touched = false;
  bool _confirmDelete = false;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    final a = widget.appointment;
    _title.text = a?.title ?? '';
    _type = a?.eventType ?? 'appointment';
    _date = a?.eventDate ?? localDateKey(widget.defaultDate ?? _now());
    final et = a?.eventTime;
    _time = et == null ? '' : (et.length > 5 ? et.substring(0, 5) : et);
    _note.text = a?.description ?? '';
    _remind = a == null ? true : a.reminderEnabled;
  }

  @override
  void dispose() {
    _title.dispose();
    _note.dispose();
    super.dispose();
  }

  /// `<input type="date">` change (YYYY-MM-DD).
  void setDate(String value) => setState(() => _date = value);

  /// `<input type="time">` change (HH:mm, '' clears).
  void setTime(String value) => setState(() => _time = value);

  bool get _titleOk => _title.text.trim().isNotEmpty;
  bool get _isPast => _date.isNotEmpty && _date.compareTo(localDateKey(_now())) < 0;

  Future<void> _save() async {
    setState(() => _touched = true);
    final saving = ref.read(appointmentsSavingProvider) > 0;
    if (!_titleOk || _date.isEmpty || saving) return;
    final title = _title.text.trim();
    final note = _note.text.trim();
    final fields = <String, Object?>{
      'title': title.length > 120 ? title.substring(0, 120) : title,
      'event_type': _type,
      'event_date': _date,
      'event_time': _time.isEmpty ? null : _time,
      'description': note.isEmpty ? null : (note.length > 500 ? note.substring(0, 500) : note),
      'reminder_enabled': _remind,
    };
    final api = ref.read(appointmentsApiProvider);
    final toast = _toast();
    final a = widget.appointment;
    final row = a != null ? await api.update(a.id, fields, toast: toast) : await api.add(fields, toast: toast);
    if (row == null || !mounted) return;
    unawaited(HapticFeedback.lightImpact());
    if (a != null) toast?.show(title: rd('appt_updated'), description: row.title);
    widget.onClose();
  }

  Future<void> _remove() async {
    final a = widget.appointment;
    if (a == null || ref.read(appointmentsSavingProvider) > 0) return;
    if (!_confirmDelete) {
      setState(() => _confirmDelete = true);
      unawaited(HapticFeedback.lightImpact());
      return;
    }
    if (await ref.read(appointmentsApiProvider).delete(a.id, toast: _toast())) {
      if (mounted) widget.onClose();
    }
  }

  AToastController? _toast() {
    try {
      return AToastHost.of(context);
    } catch (_) {
      return null;
    }
  }

  Future<void> _pickDate() async {
    final initial = storedCalendarDate(_date) ?? _now();
    final picked = await showDatePicker(context: context, initialDate: initial, firstDate: DateTime(1990), lastDate: DateTime(2100));
    if (picked != null) setDate(localDateKey(picked));
  }

  Future<void> _pickTime() async {
    final parts = _time.split(':');
    final initial = parts.length == 2 ? TimeOfDay(hour: int.tryParse(parts[0]) ?? 9, minute: int.tryParse(parts[1]) ?? 0) : TimeOfDay.now();
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) setTime('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final x = context.aText;
    final saving = ref.watch(appointmentsSavingProvider) > 0;
    final a = widget.appointment;

    Widget field(String label, Widget input) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: x.a3FieldLabel),
          const SizedBox(height: 6),
          input,
        ]);

    BoxDecoration inputBox({bool invalid = false}) => BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: invalid ? t.bad : t.line, spreadRadius: invalid ? 2 : 1)],
        );

    Widget textInput(TextEditingController c, String placeholder, {int maxLength = 120, bool multiline = false, bool invalid = false, Key? key}) =>
        Container(
          constraints: BoxConstraints(minHeight: multiline ? 76 : 48),
          decoration: inputBox(invalid: invalid),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: TextField(
            key: key,
            controller: c,
            maxLength: maxLength,
            maxLines: multiline ? null : 1,
            minLines: multiline ? 2 : 1,
            textInputAction: multiline ? TextInputAction.newline : TextInputAction.done,
            onChanged: (_) => setState(() {}),
            style: x.a3FieldInput,
            decoration: InputDecoration.collapsed(hintText: placeholder, hintStyle: x.a3FieldInput.copyWith(color: t.inkFaint)).copyWith(counterText: ''),
          ),
        );

    Widget pickerInput(String value, VoidCallback onTap, {Key? key}) => GestureDetector(
          key: key,
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            height: 48,
            alignment: AlignmentDirectional.centerStart,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: inputBox(),
            child: Text(value.isEmpty ? '--:--' : value, style: x.a3FieldInput.copyWith(color: value.isEmpty ? t.inkFaint : t.ink)),
          ),
        );

    final remindHint = _isPast ? rd('appt_past') : (_time.isNotEmpty ? rd('appt_remind_hint_time') : rd('appt_remind_hint'));

    final footer = Row(children: [
      if (a != null)
        _confirmDelete
            ? Expanded(
                child: Semantics(
                  label: rd('appt_delete_confirm'),
                  child: AButton(
                    key: const ValueKey('appt-delete'),
                    variant: AButtonVariant.danger,
                    block: true,
                    onPressed: saving ? null : _remove,
                    leading: const AIcon(AIcons.trash2, size: 18),
                    child: Text(rd('appt_delete_confirm')),
                  ),
                ),
              )
            : Semantics(
                label: rd('appt_delete'),
                child: GestureDetector(
                  key: const ValueKey('appt-delete'),
                  onTap: saving ? null : _remove,
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 48),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(999), boxShadow: [BoxShadow(color: t.lineStrong, spreadRadius: 1)]),
                    child: AIcon(AIcons.trash2, size: 18, color: t.ink),
                  ),
                ),
              ),
      if (a != null && !_confirmDelete) const SizedBox(width: 10),
      if (!_confirmDelete)
        Expanded(
          child: AButton(
            key: const ValueKey('appt-save'),
            variant: AButtonVariant.accent,
            block: true,
            onPressed: saving ? null : _save,
            child: Text(rd('appt_save')),
          ),
        ),
    ]);

    final form = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      field(rd('appt_what'), textInput(_title, rd('appt_what_ph'), invalid: _touched && !_titleOk, key: const ValueKey('appt-title'))),
      if (_touched && !_titleOk)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Semantics(
            liveRegion: true,
            child: Text(rd('appt_err_title'), key: const ValueKey('appt-error'), style: x.a3Meta.copyWith(color: t.bad)),
          ),
        ),
      const SizedBox(height: 16),
      field(
        rd('appt_type'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final type in appointmentTypes)
            Semantics(
              inMutuallyExclusiveGroup: true,
              checked: _type == type.id,
              child: GestureDetector(
                key: ValueKey('appt-type-${type.id}'),
                onTap: () => setState(() => _type = type.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: ACurves.ease,
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: _type == type.id ? t.ink : t.surface,
                    border: Border.all(color: _type == type.id ? t.ink : t.line),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('${type.icon} ${rd(type.key)}',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _type == type.id ? t.bg : t.inkSoft)),
                  ]),
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 16),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: field(rd('appt_date'), pickerInput(_date, _pickDate, key: const ValueKey('appt-date')))),
        const SizedBox(width: 10),
        Expanded(child: field(rd('appt_time'), pickerInput(_time, _pickTime, key: const ValueKey('appt-time')))),
      ]),
      const SizedBox(height: 16),
      field(rd('appt_note'), textInput(_note, rd('appt_note_ph'), maxLength: 500, multiline: true, key: const ValueKey('appt-note'))),
      const SizedBox(height: 16),
      Semantics(
        toggled: _remind,
        child: GestureDetector(
          key: const ValueKey('appt-remind'),
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _remind = !_remind),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(18), boxShadow: t.cardShadow),
            child: Row(children: [
              AListIcon(small: true, background: t.yellow1, foreground: t.yellowInk, child: const AIcon(AIcons.bell, size: 16)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(rd('appt_remind'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: t.ink)),
                  const SizedBox(height: 2),
                  Text(remindHint, key: const ValueKey('appt-remind-hint'), style: x.a3Meta),
                ]),
              ),
              const SizedBox(width: 12),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: ACurves.ease,
                width: 46,
                height: 28,
                padding: const EdgeInsets.all(3),
                alignment: _remind ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                decoration: BoxDecoration(color: _remind ? t.coralStrong : t.lineStrong, borderRadius: BorderRadius.circular(999)),
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFFFFF),
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(offset: Offset(0, 1), blurRadius: 3, color: Color(0x33000000))],
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    ]);

    return Material(
      type: MaterialType.transparency,
      child: ASheet(
        full: false,
        onClose: widget.onClose,
        closeLabel: rd('close'),
        title: Text(a != null ? rd('appt_edit') : rd('appt_new')),
        footer: footer,
        children: [form],
      ),
    );
  }
}
