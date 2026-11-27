// Ported from: Tailwind `border-dashed` (src/components/flow/FlowPeriodCalendar.tsx predicted days, legend),
//              sonner `toast` call sites of src/components/flow/*.tsx, Tailwind `dark:` colour pairs
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart' show I18nRuntime, formatDatePattern;
import '../../../design/design.dart';

/// `border border-dashed` around a rounded rect (CSS dashes ≈ 3× the width, gaps the same).
class DashedRRectBorder extends StatelessWidget {
  const DashedRRectBorder({super.key, required this.child, required this.color, required this.radius, this.width = 1, this.dash = 3, this.gap = 3});
  final Widget child;
  final Color color;
  final double radius;
  final double width;
  final double dash;
  final double gap;
  @override
  Widget build(BuildContext context) =>
      CustomPaint(foregroundPainter: _DashedPainter(color, radius, width, dash, gap), child: child);
}

class _DashedPainter extends CustomPainter {
  _DashedPainter(this.color, this.radius, this.width, this.dash, this.gap);
  final Color color;
  final double radius;
  final double width;
  final double dash;
  final double gap;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(width / 2);
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(radius)));
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..color = color;
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, (d + dash).clamp(0, m.length)), paint);
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedPainter old) => old.color != color || old.radius != radius || old.width != width;
}

/// sonner `toast` (null when no [AToastHost] is mounted, e.g. isolated widget tests).
AToastController? flowToast(BuildContext context) {
  try {
    return AToastHost.of(context);
  } catch (_) {
    return null;
  }
}

/// Picks the `dark:` value of a Tailwind pair.
T dk<T>(BuildContext context, T light, T dark) => AnacanTokens.of(context).isDark ? dark : light;

/// Tailwind `bg-x/NN` opacity helper.
Color op(Color c, double alpha) => c.withValues(alpha: alpha);

/// CSS `text-transform: uppercase` under `<html lang>`: Turkic languages map i → İ (and ı → I).
String cssUpper(String text, [String? language]) {
  final lang = language ?? I18nRuntime.instance.language;
  if (lang == 'az' || lang == 'tr') {
    text = text.replaceAll('i', 'İ');
  }
  return text.toUpperCase();
}

// date-fns `az` locale values (node_modules/date-fns/locale/az/_lib/localize.js): capitalised months, unlike intl's az.
const _azMonths = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const _azMonthsShort = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyun', 'İyul', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const _azDays = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];

/// date-fns `az` short weekday names, Sunday first (react-day-picker `cccccc`).
const List<String> azWeekdayShort = ['B.', 'B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.'];

/// `format(date, pattern, { locale: getCurrentDateLocale() })`. For `az` the date-fns tables are used (intl's az data
/// is lower-case); other languages go through [formatDatePattern]. Supported tokens: d, MMM, MMMM, y, yyyy, EEEE.
String flowFormat(DateTime date, String pattern, {String? language}) {
  final lang = language ?? I18nRuntime.instance.language;
  if (lang != 'az') return formatDatePattern(date, pattern, language: lang);
  return pattern.replaceAllMapped(RegExp(r'EEEE|MMMM|MMM|yyyy|y|d'), (m) => switch (m[0]) {
        'EEEE' => _azDays[date.weekday % 7],
        'MMMM' => _azMonths[date.month - 1],
        'MMM' => _azMonthsShort[date.month - 1],
        'yyyy' || 'y' => '${date.year}',
        _ => '${date.day}',
      });
}
