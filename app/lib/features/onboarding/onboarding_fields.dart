// Ported from: src/components/onboarding/OnboardingFields.tsx, src/styles/onboarding.css (.onb-field*, .onb-chips,
// .onb-child, .onb-counter)
//
// `<input type="date">` opens the platform date picker (min/max as in the web field); `<select>` is a dropdown.

import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import 'onboarding_frame.dart';
import 'onboarding_i18n.dart';
import 'onboarding_model.dart';

class OnboardingFields extends StatelessWidget {
  const OnboardingFields({super.key, required this.draft, required this.language, required this.onChange, this.disabled = false, this.today});
  final OnboardingDraft draft;
  final String language;
  final void Function(OnboardingDraft draft) onChange;
  final bool disabled;

  /// Test hook for `todayCalendarDate()`.
  final String? today;

  String t(String key, [Map<String, Object?> params = const {}]) => onboardingText(language, key, params);

  void _update(OnboardingDraft next) => onChange(next);

  void _updateChild(int index, OnboardingChild child) =>
      _update(draft.copyWith(children: [for (final (i, c) in draft.children.indexed) i == index ? child : c]));

  @override
  Widget build(BuildContext context) {
    final now = today ?? todayCalendarDate();
    final children = <Widget>[];
    if (draft.stage != 'flow') {
      children.add(OnbFieldset(
        legend: t(draft.stage == 'bump' ? 'count_bump' : 'count_mommy'),
        child: OnbChips(children: [
          for (final count in const [1, 2, 3, 4])
            OnbChip(
              key: ValueKey('baby-count-$count'),
              label: onboardingNumber(language, count),
              pressed: draft.babyCount == count,
              disabled: disabled || (draft.saveStarted && count != draft.babyCount),
              onTap: () => _update(draft.copyWith(
                babyCount: count,
                children: [for (var i = 0; i < count; i++) i < draft.children.length ? draft.children[i] : newOnboardingChild()],
              )),
            ),
        ]),
      ));
    }
    if (draft.stage == 'bump') {
      children.add(OnbFieldset(
        legend: t('data_bump_title'),
        child: OnbChips(children: [
          for (final mode in const ['lmp', 'due'])
            OnbChip(
              key: ValueKey('date-mode-$mode'),
              label: t(mode == 'lmp' ? 'date_lmp' : 'date_due'),
              pressed: draft.dateMode == mode,
              disabled: disabled,
              onTap: () => _update(draft.copyWith(dateMode: mode, pregnancyDate: '')),
            ),
        ]),
      ));
      final lmp = draft.dateMode == 'lmp';
      children.add(OnbDateField(
        fieldKey: const ValueKey('onb-pregnancy-date'),
        label: t(draft.dateMode == 'due' ? 'due' : 'lmp'),
        value: draft.pregnancyDate,
        language: language,
        min: addCalendarDays(now, lmp ? -308 : -28),
        max: lmp ? now : addCalendarDays(now, 280),
        disabled: disabled,
        onChange: (v) => _update(draft.copyWith(pregnancyDate: v)),
      ));
      final summary = <Widget>[];
      if (draft.pregnancyDate.isNotEmpty && onboardingDataError(draft, now) == null) {
        final dates = pregnancyDates(pregnancyDate: draft.pregnancyDate, dateMode: draft.dateMode);
        final week = ((calendarDay(now)! - calendarDay(dates.lastPeriod)!) / 7).floor();
        summary.add(OnbFeedback(t('bump_summary', {'week': onboardingNumber(language, week), 'date': onboardingDate(language, dates.due)})));
      }
      children.add(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...summary, OnbNote(t('date_estimate'))]));
    }
    if (draft.stage == 'mommy') {
      for (final (index, child) in draft.children.indexed) {
        children.add(_childCard(context, index, child, now));
      }
      children.add(_DeliverySelect(
        label: t('delivery'),
        value: draft.deliveryType,
        options: [for (final v in const ['', 'natural', 'cesarean', 'assisted']) (v, t(v.isEmpty ? 'unknown' : v))],
        disabled: disabled,
        onChange: (v) => _update(draft.copyWith(deliveryType: v)),
      ));
    }
    if (draft.stage == 'flow') {
      children.add(OnbDateField(
        fieldKey: const ValueKey('onb-last-period'),
        label: t('lmp'),
        value: draft.lastPeriodDate,
        language: language,
        max: now,
        disabled: disabled,
        onChange: (v) => _update(draft.copyWith(lastPeriodDate: v)),
      ));
      children.add(OnbCounter(
        id: 'onb-cycle-length',
        label: t('cycle_length'),
        value: draft.cycleLength,
        min: 10,
        max: 50,
        language: language,
        disabled: disabled,
        onChange: (v) => _update(draft.copyWith(cycleLength: v)),
      ));
      children.add(OnbCounter(
        id: 'onb-period-length',
        label: t('period_length'),
        value: draft.periodLength,
        min: 2,
        max: draft.cycleLength < 10 ? draft.cycleLength : 10,
        language: language,
        disabled: disabled,
        onChange: (v) => _update(draft.copyWith(periodLength: v)),
      ));
      children.add(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [OnbNote(t('cycle_note')), OnbNote(t('date_estimate'))]));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, w) in children.indexed) ...[if (i > 0) const SizedBox(height: 18), w],
      ],
    );
  }

  Widget _childCard(BuildContext context, int index, OnboardingChild child, String now) {
    final o = OnbStyle.of(context);
    return Container(
      key: ValueKey('child-$index'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border.all(color: o.line), borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(t('child_number', {'n': onboardingNumber(language, index + 1)}), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 16),
          OnbTextField(
            fieldKey: ValueKey('onb-child-name-$index'),
            label: t('child_name'),
            value: child.name,
            maxLength: 80,
            disabled: disabled,
            onChanged: (v) => _updateChild(index, child.copyWith(name: v)),
          ),
          const SizedBox(height: 16),
          OnbDateField(
            fieldKey: ValueKey('onb-birth-$index'),
            label: t('birth_date'),
            value: child.birthDate,
            language: language,
            max: now,
            disabled: disabled,
            onChange: (v) => _updateChild(index, child.copyWith(birthDate: v)),
          ),
          const SizedBox(height: 16),
          OnbFieldset(
            legend: t('gender'),
            child: OnbChips(children: [
              for (final gender in const ['girl', 'boy'])
                OnbChip(
                  key: ValueKey('child-$index-gender-$gender'),
                  label: t(gender),
                  pressed: child.gender == gender,
                  disabled: disabled,
                  trailingCheck: child.gender == gender,
                  onTap: () => _updateChild(index, child.copyWith(gender: gender)),
                ),
            ]),
          ),
          const SizedBox(height: 16),
          OnbFieldset(
            legend: t('term_question'),
            child: OnbChips(children: [
              for (final term in const ['term', 'preterm', ''])
                OnbChip(
                  key: ValueKey('child-$index-term-${term.isEmpty ? 'unknown' : term}'),
                  label: t(term.isEmpty ? 'unknown' : term),
                  pressed: child.term == term,
                  disabled: disabled,
                  onTap: () => _updateChild(index, child.copyWith(term: term)),
                ),
            ]),
          ),
          if (child.term == 'preterm') ...[
            const SizedBox(height: 16),
            OnbCounter(
              id: 'onb-gestation-$index',
              label: t('gestation'),
              value: child.gestationalWeeks,
              min: 22,
              max: 36,
              language: language,
              disabled: disabled,
              onChange: (v) => _updateChild(index, child.copyWith(gestationalWeeks: v)),
            ),
          ],
        ],
      ),
    );
  }
}

/// `.onb-fieldset` with its legend.
class OnbFieldset extends StatelessWidget {
  const OnbFieldset({super.key, required this.legend, required this.child});
  final String legend;
  final Widget child;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(padding: const EdgeInsets.only(bottom: 9), child: Text(legend, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
          child,
        ],
      );
}

class OnbChips extends StatelessWidget {
  const OnbChips({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: children);
}

/// `.onb-chips button` (aria-pressed → ink background).
class OnbChip extends StatelessWidget {
  const OnbChip({super.key, required this.label, required this.pressed, required this.onTap, this.disabled = false, this.trailingCheck = false});
  final String label;
  final bool pressed;
  final VoidCallback onTap;
  final bool disabled;
  final bool trailingCheck;
  @override
  Widget build(BuildContext context) {
    final o = OnbStyle.of(context);
    final fg = pressed ? o.surface : o.ink;
    Widget body = Container(
      constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: pressed ? o.ink : null,
        border: Border.all(color: pressed ? o.ink : o.line, width: 1.5),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(label, style: TextStyle(fontSize: 13, color: fg)),
        if (trailingCheck) ...[const SizedBox(width: 7), AIcon(AIcons.check, size: 14, color: fg)],
      ]),
    );
    if (disabled) body = Opacity(opacity: 0.5, child: body);
    return Semantics(
      button: true,
      toggled: pressed,
      enabled: !disabled,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: disabled ? null : onTap, child: body),
    );
  }
}

InputDecoration _inputDecoration(BuildContext context) {
  final o = OnbStyle.of(context);
  OutlineInputBorder border(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c, width: 1.5));
  return InputDecoration(
    isDense: true,
    filled: true,
    fillColor: o.bg,
    counterText: '',
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    enabledBorder: border(o.line),
    disabledBorder: border(o.line),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: o.ink, width: 3)),
    border: border(o.line),
  );
}

/// `.onb-field` label + `<input>`.
class OnbTextField extends StatefulWidget {
  const OnbTextField({super.key, required this.fieldKey, required this.label, required this.value, required this.onChanged, this.maxLength, this.disabled = false, this.onSubmitted, this.autofillHints});
  final Key fieldKey;
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final int? maxLength;
  final bool disabled;
  final VoidCallback? onSubmitted;
  final Iterable<String>? autofillHints;
  @override
  State<OnbTextField> createState() => _OnbTextFieldState();
}

class _OnbTextFieldState extends State<OnbTextField> {
  late final TextEditingController _c = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(OnbTextField old) {
    super.didUpdateWidget(old);
    if (widget.value != _c.text) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final o = OnbStyle.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 7),
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: TextField(
            key: widget.fieldKey,
            controller: _c,
            enabled: !widget.disabled,
            maxLength: widget.maxLength,
            autofillHints: widget.autofillHints,
            style: TextStyle(fontSize: 16, color: o.ink),
            cursorColor: o.ink,
            decoration: _inputDecoration(context),
            onChanged: widget.onChanged,
            onSubmitted: (_) => widget.onSubmitted?.call(),
          ),
        ),
      ],
    );
  }
}

/// `<input type="date">` (value `YYYY-MM-DD`, `dir="ltr"`).
class OnbDateField extends StatelessWidget {
  const OnbDateField({super.key, required this.fieldKey, required this.label, required this.value, required this.language, required this.onChange, this.min, this.max, this.disabled = false});
  final Key fieldKey;
  final String label;
  final String value;
  final String language;
  final ValueChanged<String> onChange;
  final String? min;
  final String? max;
  final bool disabled;

  static DateTime? _parse(String? v) {
    final day = v == null ? null : calendarDay(v);
    if (day == null) return null;
    final t = DateTime.fromMillisecondsSinceEpoch(day * 86400000, isUtc: true);
    return DateTime(t.year, t.month, t.day);
  }

  Future<void> _pick(BuildContext context) async {
    final first = _parse(min) ?? DateTime(1900);
    final last = _parse(max) ?? DateTime(2100);
    var initial = _parse(value) ?? last;
    if (initial.isBefore(first)) initial = first;
    if (initial.isAfter(last)) initial = last;
    final picked = await showDatePicker(context: context, initialDate: initial, firstDate: first, lastDate: last);
    if (picked != null) onChange(todayCalendarDate(picked));
  }

  @override
  Widget build(BuildContext context) {
    final o = OnbStyle.of(context);
    Widget field = Container(
      key: fieldKey,
      constraints: const BoxConstraints(minHeight: 52),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(color: o.bg, border: Border.all(color: o.line, width: 1.5), borderRadius: BorderRadius.circular(14)),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Text(value.isEmpty ? '' : onboardingDate(language, value), style: TextStyle(fontSize: 16, color: o.ink)),
      ),
    );
    if (disabled) field = Opacity(opacity: 0.5, child: field);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 7),
        Semantics(
          textField: true,
          label: label,
          value: value,
          child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: disabled ? null : () => _pick(context), child: field),
        ),
      ],
    );
  }
}

/// `.onb-counter` (− output +).
class OnbCounter extends StatelessWidget {
  const OnbCounter({super.key, required this.id, required this.label, required this.value, required this.min, required this.max, required this.language, required this.onChange, this.disabled = false});
  final String id;
  final String label;
  final int value;
  final int min;
  final int max;
  final String language;
  final ValueChanged<int> onChange;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final o = OnbStyle.of(context);
    Widget button(AIconData icon, String semantic, bool off, VoidCallback onTap) {
      Widget b = Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(border: Border.all(color: o.line), borderRadius: BorderRadius.circular(12)),
        child: AIcon(icon, size: 17, color: o.ink),
      );
      if (off) b = Opacity(opacity: 0.5, child: b);
      return Semantics(button: true, enabled: !off, label: semantic, child: GestureDetector(onTap: off ? null : onTap, child: b));
    }

    final controls = Row(mainAxisSize: MainAxisSize.min, children: [
      button(AIcons.minus, onboardingText(language, 'decrease', {'field': label}), disabled || value <= min, () => onChange(value - 1)),
      const SizedBox(width: 8),
      ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 28),
        child: Text(onboardingNumber(language, value),
            key: ValueKey(id),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
      ),
      const SizedBox(width: 8),
      button(AIcons.plus, onboardingText(language, 'increase', {'field': label}), disabled || value >= max, () => onChange(value + 1)),
    ]);
    final text = Text(label, style: const TextStyle(fontSize: 13));
    if (OnbStyle.narrow(context)) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [text, const SizedBox(height: 12), controls]);
    }
    return Row(children: [Expanded(child: text), const SizedBox(width: 12), controls]);
  }
}

class _DeliverySelect extends StatelessWidget {
  const _DeliverySelect({required this.label, required this.value, required this.options, required this.onChange, this.disabled = false});
  final String label;
  final String value;
  final List<(String, String)> options;
  final ValueChanged<String> onChange;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final o = OnbStyle.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 7),
        Container(
          key: const ValueKey('onb-delivery'),
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(color: o.bg, border: Border.all(color: o.line, width: 1.5), borderRadius: BorderRadius.circular(14)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              dropdownColor: o.surface,
              icon: const SizedBox.shrink(),
              style: TextStyle(fontSize: 16, color: o.ink, fontFamily: OnbStyle.base(context).fontFamily),
              onChanged: disabled ? null : (v) => onChange(v ?? ''),
              items: [for (final (v, text) in options) DropdownMenuItem(value: v, child: Text(text))],
            ),
          ),
        ),
      ],
    );
  }
}
