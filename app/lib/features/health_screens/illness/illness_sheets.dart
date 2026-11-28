// Ported from: src/components/illness/IllnessSheets.tsx (TempSheet, MedSheet, SymptomSheet, FlagsSheet,
//              TempUnitToggle, WhenField, SaveBar), src/styles/care.css (.cx-dial, .cx-dial-value, .cx-step, .cx-range,
//              .cx-scale, .cx-stack)
//
// The `<input type="datetime-local">` becomes a field that opens the date then the time picker (max now + 5 min).
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ShadSwitch, px;
import '../../tools/health_common/health_common.dart' show healthLinkLauncherProvider;
import '../../tools/pregnancy_common/pregnancy_ports.dart' show pregnancyHapticsProvider;
import '../common/care_ui.dart';
import '../common/feature_text.dart';
import '../common/health_format.dart';
import '../common/health_ports.dart';
import 'illness.dart';
import 'illness_data.dart';

const Map<String, String> symptomEmoji = {
  'cough': '😮‍💨', 'runny_nose': '🤧', 'vomit': '🤮', 'diarrhea': '🚽', 'poor_feeding': '🍼', 'fewer_diapers': '🧷',
  'rash': '🔴', 'sleepy': '😴', 'irritable': '😣', 'breathing': '🫁', 'ear_pull': '👂',
};

/// Opens a care sheet (`<Sheet open onClose full={false}>`) built by a stateful body.
Future<T?> showCareSheet<T>(BuildContext context, WidgetBuilder builder) =>
    Navigator.of(context, rootNavigator: true).push<T>(ASheetRoute<T>(builder: builder));

/// `.a3-btn.accent.cx-wide` save button.
class SaveBar extends StatelessWidget {
  const SaveBar({super.key, required this.label, required this.busy, required this.onTap, this.disabled = false});
  final String label;
  final bool busy;
  final VoidCallback onTap;
  final bool disabled;
  @override
  Widget build(BuildContext context) =>
      AButton(variant: AButtonVariant.accent, block: true, onPressed: busy || disabled ? null : onTap, child: Text(label));
}

/// °C / °F switch; the choice is remembered on this device.
class TempUnitToggle extends ConsumerWidget {
  const TempUnitToggle({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unit = ref.watch(tempUnitProvider);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: SizedBox(
        width: 120,
        child: CxSeg(
          semanticLabel: tr('p3b_temp_unit', 'Temperatur vahidi'),
          items: [
            for (final u in const ['C', 'F']) (label: '°$u', pressed: unit == u, onTap: () => ref.read(tempUnitProvider.notifier).set(u), color: null),
          ],
        ),
      ),
    );
  }
}

/// `<input type="datetime-local">` + "now" chip.
class WhenField extends StatelessWidget {
  const WhenField({super.key, required this.t, required this.value, required this.onChanged, required this.language});
  final FeatureText t;
  final DateTime value;
  final ValueChanged<DateTime> onChanged;
  final String language;

  Future<void> _pick(BuildContext context) async {
    final max = DateTime.now().add(const Duration(minutes: 5));
    final date = await showDatePicker(context: context, initialDate: value.isAfter(max) ? max : value, firstDate: DateTime(2020), lastDate: max);
    if (date == null || !context.mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(value));
    if (time == null) return;
    var picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    if (picked.isAfter(max)) picked = max;
    onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      CxField(t.s('time')),
      Row(children: [
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _pick(context),
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: AlignmentDirectional.centerStart,
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: a.lineStrong, width: 2)),
              child: Text(fmtDayMonthShortTime(value, language), style: px(15, color: a.ink, height: 1.4)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        CxChip(label: t.s('now'), pressed: false, onTap: () => onChanged(DateTime.now())),
      ]),
    ]);
  }
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children, this.footer, this.full = false});
  final String title;
  final List<Widget> children;
  final Widget? footer;
  final bool full;
  @override
  Widget build(BuildContext context) => ASheet(
        title: Text(title),
        full: full,
        footer: footer,
        onClose: () => Navigator.of(context).maybePop(),
        closeLabel: tr('common_close', 'Bağla'),
        children: [Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _stack(children))],
      );

  /// `.cx-stack` (grid, gap 16).
  static List<Widget> _stack(List<Widget> c) => [
        for (var i = 0; i < c.length; i++) ...[if (i > 0) const SizedBox(height: 16), c[i]],
      ];
}

const List<int> _scaleC = [35, 37, 38, 39, 40, 42];

/// The `.cx-range` slider (gradient track 10px, white 30px thumb with a 3px `--a-ink` border).
class _TempRange extends StatelessWidget {
  const _TempRange({required this.value, required this.min, required this.max, required this.onChanged, required this.label});
  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      slider: true,
      label: label,
      value: value.toStringAsFixed(1),
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth;
        void at(double dx) {
          final p = ((dx - 15) / (w - 30)).clamp(0.0, 1.0);
          onChanged(min + p * (max - min));
        }

        final p = ((value - min) / (max - min)).clamp(0.0, 1.0);
        final rtl = Directionality.of(context) == TextDirection.rtl;
        final thumbX = 15 + p * (w - 30);
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => at(rtl ? w - d.localPosition.dx : d.localPosition.dx),
          onHorizontalDragUpdate: (d) => at(rtl ? w - d.localPosition.dx : d.localPosition.dx),
          child: SizedBox(
            height: 34,
            child: Stack(alignment: Alignment.centerLeft, children: [
              Container(
                height: 10,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  // care.css .cx-range track
                  gradient: LinearGradient(
                    begin: rtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: rtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: const [Color(0xFF74C0FC), Color(0xFF63BD8B), Color(0xFFFFD43B), Color(0xFFFF922B), Color(0xFFE03131)],
                    stops: const [0, 0.22, 0.42, 0.62, 1],
                  ),
                ),
              ),
              PositionedDirectional(
                start: thumbX - 15,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    shape: BoxShape.circle,
                    border: Border.all(color: a.ink, width: 3),
                    boxShadow: const [BoxShadow(color: Color(0x33000000), offset: Offset(0, 4), blurRadius: 10)],
                  ),
                ),
              ),
            ]),
          ),
        );
      }),
    );
  }
}

/// Temperature: the dial works in the chosen unit; the reading is saved in °C (rounded to 0.1).
class TempSheet extends ConsumerStatefulWidget {
  const TempSheet({super.key, required this.t, required this.onSave, required this.language, required this.locale});
  final FeatureText t;
  final Future<void> Function(Map<String, Object?> entry) onSave;
  final String language;
  final String locale;
  @override
  ConsumerState<TempSheet> createState() => _TempSheetState();
}

class _TempSheetState extends ConsumerState<TempSheet> {
  late TempUnit _valueUnit = ref.read(tempUnitProvider);
  late double _value = toUnit(37.5, _valueUnit);
  String _method = 'armpit';
  DateTime _when = DateTime.now();
  bool _busy = false;

  double _clamp(double v, TempUnit unit) {
    final min = toUnit(tempMinC, unit), max = toUnit(tempMaxC, unit);
    return (v.clamp(min, max) * 10).roundToDouble() / 10;
  }

  void _set(double v, TempUnit unit) {
    setState(() => _value = _clamp(v, unit));
    ref.read(pregnancyHapticsProvider).light();
  }

  Future<void> _save(TempUnit unit) async {
    setState(() => _busy = true);
    try {
      await widget.onSave(newTempEntry(at: _when.toUtc().toIso8601String(), tempC: fromUnit(_value, unit), method: _method));
      if (mounted) Navigator.of(context).maybePop();
    } catch (_) {
      // toast upstream
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final unit = ref.watch(tempUnitProvider);
    // Switching the unit (here or on another screen) converts the value on the dial.
    if (_valueUnit != unit) {
      _value = ((unit == 'F' ? cToF(_value) : fToC(_value)) * 10).roundToDouble() / 10;
      _valueUnit = unit;
    }
    final a = context.a;
    final celsius = unit == 'F' ? fToC(_value) : _value;
    final band = tempBand(celsius);
    final color = bandColor[band]!;
    Widget step(String label, String aria, double delta) => Semantics(
          button: true,
          label: aria,
          child: PressScale(
            scale: 0.95,
            onTap: () => _set(_value + delta, unit),
            child: Container(
              width: 52,
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
              child: Text(label, style: px(26, weight: FontWeight.w700, color: a.ink, height: 1)),
            ),
          ),
        );
    return _SheetFrame(
      title: t.s('temp_title'),
      footer: SaveBar(label: t.s('save'), busy: _busy, onTap: () => _save(unit)),
      children: [
        Column(children: [
          const TempUnitToggle(),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            step('−', '-0.1', -0.1),
            const SizedBox(width: 18),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 170),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text('${formatOneDecimal(_value, widget.locale)}°',
                      textAlign: TextAlign.center, style: px(54, weight: FontWeight.w800, color: color, ls: -0.03, height: 1.2)),
                ),
              ),
            ),
            const SizedBox(width: 18),
            step('+', '+0.1', 0.1),
          ]),
          const SizedBox(height: 6),
          CxPill(label: t.at('bands', band) ?? band, background: color.withValues(alpha: 0x1F / 255), color: color),
          const SizedBox(height: 10),
          _TempRange(
            value: _value,
            min: toUnit(tempMinC, unit),
            max: toUnit(tempMaxC, unit),
            label: t.s('temp_title'),
            onChanged: (v) => setState(() => _value = _clamp(v, unit)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              for (final c in _scaleC) Text('${unit == 'F' ? cToF(c).round() : c}°', style: px(11, color: a.inkFaint)),
            ]),
          ),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(t.s('temp_hint'), textAlign: TextAlign.center, style: cxSub(context))),
        ]),
        CxChips(children: [
          for (final m in tempMethods) CxChip(label: t.at('methods', m) ?? m, pressed: m == _method, onTap: () => setState(() => _method = m)),
        ]),
        WhenField(t: t, value: _when, language: widget.language, onChanged: (v) => setState(() => _when = v)),
      ],
    );
  }
}

/// Medicine: presets (recent names first), dose / interval as the doctor said, reminder, early-dose check.
class MedSheet extends ConsumerStatefulWidget {
  const MedSheet({super.key, required this.t, required this.entries, required this.onSave, required this.language});
  final FeatureText t;
  final List<IllnessEntry> entries;
  final Future<void> Function(Map<String, Object?> entry) onSave;
  final String language;
  @override
  ConsumerState<MedSheet> createState() => _MedSheetState();
}

class _MedSheetState extends ConsumerState<MedSheet> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _dose = TextEditingController();
  final TextEditingController _interval = TextEditingController(text: '6');
  bool _custom = false;
  double _hours = 6;
  bool _customInterval = false;
  bool _remind = true;
  DateTime _when = DateTime.now();
  bool _busy = false;
  bool _confirmEarly = false;

  @override
  void dispose() {
    _name.dispose();
    _dose.dispose();
    _interval.dispose();
    super.dispose();
  }

  List<String> get _presets {
    final seen = <String>{};
    final out = <String>[];
    for (final e in widget.entries) {
      if (e.kind == 'med' && e.medName != null && e.medName!.isNotEmpty && seen.add(e.medName!)) out.add(e.medName!);
    }
    for (final p in widget.t.list('med_presets')) {
      if (seen.add(p)) out.add(p);
    }
    return out.take(7).toList();
  }

  IllnessEntry? _lastOf(String name) {
    for (final e in widget.entries) {
      if (e.kind == 'med' && e.medName?.toLowerCase() == name.toLowerCase()) return e;
    }
    return null;
  }

  void _pick(String preset) {
    setState(() {
      _name.text = preset;
      _custom = false;
      _confirmEarly = false;
      final last = _lastOf(preset);
      if (last != null) {
        _dose.text = last.dose ?? '';
        if (last.intervalHours != null && last.intervalHours != 0) {
          _hours = last.intervalHours!;
          _interval.text = _numText(_hours);
        }
      }
    });
  }

  Future<void> _save(({MedStatus last, int minutesAgo})? early, bool valid) async {
    if (!valid) return;
    if (early != null && !_confirmEarly) {
      setState(() => _confirmEarly = true);
      ref.read(pregnancyHapticsProvider).heavy();
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.onSave(newMedEntry(
        at: _when.toUtc().toIso8601String(),
        medName: _name.text.trim(),
        dose: _dose.text.trim(),
        intervalHours: _hours,
        remind: _remind,
      ));
      if (_remind) {
        try {
          await ref.read(illnessNotificationPermissionProvider)();
        } catch (_) {}
      }
      _name.clear();
      _dose.clear();
      if (mounted) Navigator.of(context).maybePop();
    } catch (_) {
      // toast upstream
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final a = context.a;
    final name = _name.text;
    final early = name.isNotEmpty ? earlyDose(widget.entries, name, _when) : null;
    final ago = early == null
        ? ''
        : early.minutesAgo < 60
            ? fill(t.s('ago_min'), {'n': early.minutesAgo})
            : fill(t.s('ago_h'), {'h': early.minutesAgo ~/ 60, 'm': early.minutesAgo % 60});
    final valid = name.trim().isNotEmpty && _dose.text.trim().isNotEmpty && _hours >= 1 && _hours <= 48;
    return _SheetFrame(
      title: t.s('med_title'),
      footer: SaveBar(label: early != null && _confirmEarly ? t.s('save_anyway') : t.s('save'), busy: _busy, disabled: !valid, onTap: () => _save(early, valid)),
      children: [
        CxChips(children: [
          for (final p in _presets) CxChip(label: p, pressed: !_custom && name == p, onTap: () => _pick(p)),
          CxChip(label: '+ ${t.s('med_other')}', pressed: _custom, onTap: () => setState(() {
                _custom = true;
                _name.clear();
              })),
        ]),
        if (_custom) CxInput(controller: _name, maxLength: 60, placeholder: t.s('med_name_ph'), autofocus: true, onChanged: (_) => setState(() => _confirmEarly = false)),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CxField(t.s('dose_label')),
          CxInput(controller: _dose, maxLength: 40, placeholder: t.s('dose_ph'), onChanged: (_) => setState(() {})),
        ]),
        WhenField(t: t, value: _when, language: widget.language, onChanged: (v) => setState(() {
              _when = v;
              _confirmEarly = false;
            })),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CxField(t.s('interval_label')),
          CxSeg(items: [
            for (final h in const [4, 6, 8, 12])
              (
                label: fill(t.s('hours'), {'h': h}),
                pressed: !_customInterval && _hours == h,
                onTap: () => setState(() {
                      _customInterval = false;
                      _hours = h.toDouble();
                      _interval.text = '$h';
                    }),
                color: null,
              ),
            (label: t.s('med_other'), pressed: _customInterval, onTap: () => setState(() => _customInterval = true), color: null),
          ]),
          if (_customInterval)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: CxInput(
                controller: _interval,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                onChanged: (v) => setState(() => _hours = double.tryParse(v.replaceFirst(',', '.')) ?? 0),
              ),
            ),
        ]),
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t.s('remind_title'), style: px(14, weight: FontWeight.w700, color: a.ink)),
              Text(
                '${_remind ? '${fmtTime(_when.add(Duration(milliseconds: (_hours * 3600000).round())), widget.language)} · ' : ''}${t.s('remind_desc')}',
                style: cxSub(context),
              ),
            ]),
          ),
          const SizedBox(width: 12),
          ShadSwitch(checked: _remind, onChanged: (v) => setState(() => _remind = v), checkedColor: a.peach2, semanticLabel: t.s('remind_title')),
        ]),
        if (early != null)
          CxAlert(
            title: '⏱️ ${t.s('too_early_title')}',
            children: [Text(fill(t.s('too_early'), {'med': early.last.name, 'ago': ago, 'h': _numText(early.last.intervalHours)}))],
          )
        else
          CxWarn(child: Text('⚠️ ${t.s('no_dose_calc')}')),
      ],
    );
  }
}

String _numText(double v) => v == v.truncateToDouble() ? '${v.toInt()}' : '$v';

/// Symptoms: tiles (breathing highlighted pink) and an optional note.
class SymptomSheet extends ConsumerStatefulWidget {
  const SymptomSheet({super.key, required this.t, required this.onSave});
  final FeatureText t;
  final Future<void> Function(Map<String, Object?> entry) onSave;
  @override
  ConsumerState<SymptomSheet> createState() => _SymptomSheetState();
}

class _SymptomSheetState extends ConsumerState<SymptomSheet> {
  final List<String> _picked = [];
  final TextEditingController _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final note = _note.text.trim();
      await widget.onSave(newSymptomEntry(at: DateTime.now().toUtc().toIso8601String(), symptoms: [..._picked], note: note.isEmpty ? null : note));
      if (mounted) Navigator.of(context).maybePop();
    } catch (_) {
      // upstream
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final a = context.a;
    return _SheetFrame(
      title: t.s('symptom_title'),
      footer: SaveBar(label: t.s('save'), busy: _busy, disabled: _picked.isEmpty && _note.text.trim().isEmpty, onTap: _save),
      children: [
        CxGrid(columns: 3, children: [
          for (final s in illnessSymptoms)
            CxTile(
              emoji: symptomEmoji[s]!,
              label: t.at('symptoms', s) ?? s,
              minHeight: 76,
              pressed: _picked.contains(s),
              background: _picked.contains(s) ? (s == 'breathing' ? a.pink1 : a.blue1) : a.surfaceSoft,
              onTap: () {
                setState(() => _picked.contains(s) ? _picked.remove(s) : _picked.add(s));
                ref.read(pregnancyHapticsProvider).light();
              },
            ),
        ]),
        CxInput(controller: _note, maxLength: 280, minLines: 3, maxLines: 6, placeholder: t.s('note_ph'), onChanged: (_) => setState(() {})),
      ],
    );
  }
}

/// "When is it urgent?": emergency signs with the call button, doctor-today signs, disclaimer.
class FlagsSheet extends ConsumerWidget {
  const FlagsSheet({super.key, required this.t, required this.emergency, required this.locale});
  final FeatureText t;
  final String emergency;
  final String locale;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unit = ref.watch(tempUnitProvider);
    String temp(String line) => localizeTempText(line, unit, locale);
    final a = context.a;
    Widget bullet(String line, TextStyle style) => Padding(
          padding: const EdgeInsetsDirectional.only(top: 4, start: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('•  ', style: style),
            Expanded(child: Text(line, style: style)),
          ]),
        );
    return _SheetFrame(
      title: t.s('flags_title'),
      full: true,
      children: [
        CxAlert(title: '🚨 ${fill(t.s('emergency_title'), {'number': emergency})}', children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final line in t.list('emergency')) bullet(temp(line), px(13, color: a.alertInk, height: 1.45)),
            ]),
          ),
          CxCallButton(
            label: fill(t.s('call'), {'number': emergency}),
            onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
          ),
        ]),
        CxCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('🩺 ${t.s('doctor_title')}', style: px(14.5, weight: FontWeight.w700, color: a.ink)),
            const SizedBox(height: 4),
            for (final line in t.list('doctor')) bullet(temp(line), cxSub(context, 13.5)),
          ]),
        ),
        CxDisc(t.s('disclaimer'), top: 0),
      ],
    );
  }
}
