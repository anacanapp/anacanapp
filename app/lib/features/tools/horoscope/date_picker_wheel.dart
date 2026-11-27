// Ported from: src/components/ui/date-picker-wheel.tsx
//
// `<DatePickerWheel value onChange minYear maxYear disabled placeholder />`: a 56px outline trigger (calendar badge,
// "birth date" label, `d MMMM yyyy` or the placeholder, a green check when set) that opens a centred popup with a
// month calendar (Monday first), a 16-per-page year grid and a month grid, plus Clear / Today.
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;

List<String> _months() => [
  tr('month_january', 'Yanvar'),
  tr('month_february', 'Fevral'),
  tr('month_march', 'Mart'),
  tr('month_april', 'Aprel'),
  tr('month_may', 'May'),
  tr('month_june', 'Iyun'),
  tr('month_july', 'Iyul'),
  tr('month_august', 'Avqust'),
  tr('month_september', 'Sentyabr'),
  tr('month_october', 'Oktyabr'),
  tr('month_november', 'Noyabr'),
  tr('month_december', 'Dekabr'),
];

List<String> _weekDays() => [
  tr('datepickerwheel_mon', 'Baz.e.'),
  tr('datepickerwheel_c_ax_6cdba6', 'Ç.ax.'),
  tr('datepickerwheel_cer_879279', 'Çər.'),
  tr('datepickerwheel_thu', 'C.ax.'),
  tr('datepickerwheel_cum_a58b1a', 'Cüm.'),
  tr('datepickerwheel_sen_60edd8', 'Şən.'),
  tr('datepickerwheel_sun', 'Baz.'),
];

class DatePickerWheel extends StatelessWidget {
  const DatePickerWheel({super.key, this.value, required this.onChanged, this.minYear = 1940, this.maxYear, this.disabled, this.placeholder, this.fieldKey});
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final int minYear;

  /// Defaults to the current year.
  final int? maxYear;
  final bool Function(DateTime date)? disabled;
  final String? placeholder;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final value = this.value;
    return GestureDetector(
      key: fieldKey,
      behavior: HitTestBehavior.opaque,
      onTap: () => showGeneralDialog<void>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'date',
        barrierColor: const Color(0x80000000),
        transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 200),
        pageBuilder: (ctx, _, _) =>
            _DatePopup(value: value, onChanged: onChanged, minYear: minYear, maxYear: maxYear ?? DateTime.now().year, disabled: disabled),
      ),
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: s.input, width: 2),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [s.muted.withValues(alpha: 0.3), s.muted.withValues(alpha: 0.5)],
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [s.primary.withValues(alpha: 0.2), s.primary.withValues(alpha: 0.1)],
                ),
              ),
              child: AIcon(AIcons.calendar, size: 20, color: s.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr('date-picker-wheel_dogum_tarixi_d96907', 'Doğum tarixi'), style: px(12, color: s.mutedForeground)),
                  Text(
                    value != null ? formatDatePattern(value, 'd MMMM yyyy') : (placeholder ?? tr('datepickerwheel_tarix_secin_3377b4', 'Tarix seçin')),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: px(14, weight: FontWeight.w500, color: value != null ? s.foreground : s.mutedForeground),
                  ),
                ],
              ),
            ),
            if (value != null)
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: Color(0x3322C55E), shape: BoxShape.circle), // bg-green-500/20
                child: const AIcon(AIcons.check, size: 16, color: Color(0xFF16A34A)), // text-green-600
              ),
          ],
        ),
      ),
    );
  }
}

class _DatePopup extends StatefulWidget {
  const _DatePopup({required this.value, required this.onChanged, required this.minYear, required this.maxYear, this.disabled});
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final int minYear;
  final int maxYear;
  final bool Function(DateTime date)? disabled;

  @override
  State<_DatePopup> createState() => _DatePopupState();
}

class _DatePopupState extends State<_DatePopup> {
  String _view = 'calendar';
  late int _year = widget.value?.year ?? 1990;
  late int _month = (widget.value?.month ?? 1) - 1;
  late DateTime? _selected = widget.value;
  int _yearPage = 0;

  List<int> get _years => [for (var y = widget.maxYear; y >= widget.minYear; y--) y];

  void _close() => Navigator.of(context).pop();

  void _selectDay(int day) {
    final date = DateTime(_year, _month + 1, day);
    if (widget.disabled?.call(date) ?? false) return;
    setState(() => _selected = date);
    widget.onChanged(date);
    _close();
  }

  void _prevMonth() => setState(() {
    if (_month == 0) {
      _month = 11;
      _year--;
    } else {
      _month--;
    }
  });

  void _nextMonth() => setState(() {
    if (_month == 11) {
      _month = 0;
      _year++;
    } else {
      _month++;
    }
  });

  Widget _ghostIcon(AIconData icon, VoidCallback? onTap, {double size = 36}) {
    final s = context.tokens.shadcn;
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(child: AIcon(icon, size: 16, color: s.foreground, mirrorInRtl: true)),
        ),
      ),
    );
  }

  Widget _ghostText(String text, VoidCallback onTap, {Key? key}) {
    final s = context.tokens.shadcn;
    return GestureDetector(
      key: key,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        child: Text(
          text,
          style: px(16, weight: FontWeight.w600, color: s.foreground),
        ),
      ),
    );
  }

  BoxDecoration _selectedDeco(BuildContext context) {
    final p = context.tokens.shadcn.primary;
    return BoxDecoration(
      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [p, p.withValues(alpha: 0.8)]),
      boxShadow: [BoxShadow(color: p.withValues(alpha: 0.3), offset: const Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
    );
  }

  Widget _calendar(BuildContext context) {
    final s = context.tokens.shadcn;
    final months = _months();
    final days = DateTime(_year, _month + 2, 0).day;
    final first = DateTime(_year, _month + 1, 1).weekday - 1; // Monday first
    final now = DateTime.now();
    final cells = <Widget>[
      for (var i = 0; i < first; i++) const SizedBox(),
      for (var d = 1; d <= days; d++)
        () {
          final date = DateTime(_year, _month + 1, d);
          final selected = _selected != null && _selected!.year == _year && _selected!.month == _month + 1 && _selected!.day == d;
          final today = now.year == _year && now.month == _month + 1 && now.day == d;
          final off = widget.disabled?.call(date) ?? false;
          Widget cell = Container(
            alignment: Alignment.center,
            decoration: selected
                ? _selectedDeco(context).copyWith(shape: BoxShape.circle)
                : today
                ? BoxDecoration(
                    shape: BoxShape.circle,
                    color: s.primary.withValues(alpha: 0.1),
                    border: Border.all(color: s.primary.withValues(alpha: 0.5), width: 2),
                  )
                : const BoxDecoration(shape: BoxShape.circle),
            child: Text(
              '$d',
              style: px(14, weight: FontWeight.w500, color: selected ? s.primaryForeground : s.foreground),
            ),
          );
          if (off) cell = Opacity(opacity: 0.3, child: cell);
          return GestureDetector(
            key: ValueKey('day-$d'),
            behavior: HitTestBehavior.opaque,
            onTap: off ? null : () => _selectDay(d),
            child: AspectRatio(aspectRatio: 1, child: cell),
          );
        }(),
    ];
    final weekDays = _weekDays();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            _ghostIcon(AIcons.chevronLeft, _prevMonth),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _ghostText(months[_month], () => setState(() => _view = 'month')),
                  const SizedBox(width: 8),
                  _ghostText('$_year', () => setState(() => _view = 'year'), key: const ValueKey('date-year')),
                ],
              ),
            ),
            _ghostIcon(AIcons.chevronRight, _nextMonth),
          ],
        ),
        const SizedBox(height: 12),
        _grid(7, 4, [
          for (final w in weekDays)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                w,
                textAlign: TextAlign.center,
                style: px(12, weight: FontWeight.w500, color: s.mutedForeground),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        _grid(7, 4, cells),
      ],
    );
  }

  Widget _grid(int columns, double gap, List<Widget> children) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      if (i > 0) rows.add(SizedBox(height: gap));
      rows.add(
        Row(
          children: [
            for (var c = 0; c < columns; c++) ...[
              if (c > 0) SizedBox(width: gap),
              Expanded(child: i + c < children.length ? children[i + c] : const SizedBox()),
            ],
          ],
        ),
      );
    }
    return Column(mainAxisSize: MainAxisSize.min, children: rows);
  }

  Widget _yearView(BuildContext context) {
    final s = context.tokens.shadcn;
    final years = _years;
    final pages = (years.length / 16).ceil();
    final visible = years.skip(_yearPage * 16).take(16).toList();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              _ghostIcon(AIcons.chevronLeft, _yearPage == 0 ? null : () => setState(() => _yearPage--)),
              Expanded(
                child: Text(
                  tr('datepickerwheel_i_l_secin_5fe2b5', 'İl seçin'),
                  textAlign: TextAlign.center,
                  style: px(14, weight: FontWeight.w600, color: s.mutedForeground),
                ),
              ),
              _ghostIcon(AIcons.chevronRight, _yearPage >= pages - 1 ? null : () => setState(() => _yearPage++)),
            ],
          ),
        ),
        _grid(4, 8, [
          for (final y in visible)
            GestureDetector(
              key: ValueKey('year-$y'),
              onTap: () => setState(() {
                _year = y;
                _view = 'month';
              }),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                alignment: Alignment.center,
                decoration: y == _year
                    ? _selectedDeco(context).copyWith(borderRadius: BorderRadius.circular(12))
                    : BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
                child: Text(
                  '$y',
                  style: px(14, weight: FontWeight.w500, color: y == _year ? s.primaryForeground : s.foreground),
                ),
              ),
            ),
        ]),
      ],
    );
  }

  Widget _monthView(BuildContext context) {
    final s = context.tokens.shadcn;
    final months = _months();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Center(child: _ghostText('$_year', () => setState(() => _view = 'year'))),
        ),
        _grid(3, 8, [
          for (var i = 0; i < 12; i++)
            () {
              final on = i == _month && _year == widget.value?.year;
              return GestureDetector(
                key: ValueKey('month-$i'),
                onTap: () => setState(() {
                  _month = i;
                  _view = 'calendar';
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  alignment: Alignment.center,
                  decoration: on
                      ? _selectedDeco(context).copyWith(borderRadius: BorderRadius.circular(12))
                      : BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
                  child: Text(
                    months[i],
                    style: px(14, weight: FontWeight.w500, color: on ? s.primaryForeground : s.foreground),
                  ),
                ),
              );
            }(),
        ]),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Material(
            type: MaterialType.transparency,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: s.background,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: s.border),
                  boxShadow: const [BoxShadow(color: Color(0x40000000), offset: Offset(0, 25), blurRadius: 50, spreadRadius: -12)],
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: s.border)),
                          gradient: LinearGradient(
                            colors: [s.primary.withValues(alpha: 0.1), s.primary.withValues(alpha: 0.05), s.primary.withValues(alpha: 0)],
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                              child: AIcon(AIcons.calendar, size: 16, color: s.primary),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                tr('date-picker-wheel_tarix_secin_3377b4', 'Tarix seçin'),
                                style: px(16, weight: FontWeight.w600, color: s.foreground),
                              ),
                            ),
                            _ghostIcon(AIcons.x, _close, size: 32),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: switch (_view) {
                          'year' => _yearView(context),
                          'month' => _monthView(context),
                          _ => _calendar(context),
                        },
                      ),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: s.muted.withValues(alpha: 0.3),
                          border: Border(top: BorderSide(color: s.border)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  setState(() => _selected = null);
                                  widget.onChanged(null);
                                  _close();
                                },
                                child: Container(
                                  height: 44,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: s.background,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: s.input),
                                  ),
                                  child: Text(
                                    tr('datepickerwheel_temizle_1c3651', 'Təmizlə'),
                                    style: px(14, weight: FontWeight.w500, color: s.foreground),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  final today = DateTime.now();
                                  _year = today.year;
                                  _month = today.month - 1;
                                  _view = 'calendar';
                                }),
                                child: Container(
                                  height: 44,
                                  alignment: Alignment.center,
                                  child: Text(
                                    tr('datepickerwheel_bu_gun_786fd4', 'Bu gün'),
                                    style: px(14, weight: FontWeight.w500, color: s.primary),
                                  ),
                                ),
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
          ),
        ),
      ),
    );
  }
}
