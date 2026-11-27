// Ported from: src/components/dashboard/RedFlagBanner.tsx, src/hooks/useBloodPressure.ts (useBloodPressureLogs)
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/row.dart' hide Row;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/blood_pressure.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../../state/user_store.dart';
import '../data/home_repository.dart';
import '../home_inputs.dart';
import '../widgets/home_widgets.dart';

/// `useBloodPressureLogs()` — key `['bp-logs']`, newest 90, [] when unavailable.
final bloodPressureLogsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(homeUserIdProvider);
  return QueryOptions<Rows>(
    queryKey: const ['bp-logs'],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Map<String, dynamic>>[];
      try {
        return await ref.read(homeRepositoryProvider).bloodPressureLogs(userId);
      } catch (_) {
        return <Map<String, dynamic>>[];
      }
    },
  );
});

/// `toDateString()` equality in local time.
bool _isSameLocalDay(DateTime a, DateTime b) {
  final x = a.toLocal(), y = b.toLocal();
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

/// Automatic warning on the bump dashboard when today's latest reading is ≥140/90.
class RedFlagBanner extends ConsumerWidget {
  const RedFlagBanner({super.key, this.onOpenTool, this.now});
  final void Function(String toolId)? onOpenTool;
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final logs = ref.watch(bloodPressureLogsQuery).data ?? const <Map<String, dynamic>>[];
    if (logs.isEmpty) return const SizedBox.shrink();
    final latest = logs.first;
    final measured = latest.date('measured_at');
    if (measured == null || !_isSameLocalDay(measured, (now ?? DomainClock.now)())) return const SizedBox.shrink();
    final sys = latest.number('systolic') ?? 0;
    final dia = latest.number('diastolic') ?? 0;
    final a = classifyBp(sys, dia, lifeStage == 'bump', tr: tr);
    final urgent = a.category == 'crisis' || a.pregnancyAlert == 'urgent';
    final warning = a.pregnancyAlert == 'warning' || a.category == 'stage2';
    if (!urgent && !warning) return const SizedBox.shrink();
    final t = context.a;
    String n(num v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: FramerEnter(
        y: -8,
        child: GestureDetector(
          key: const ValueKey('red-flag-banner'),
          behavior: HitTestBehavior.opaque,
          onTap: () => onOpenTool?.call('blood-pressure'),
          child: PressScale(
            scale: 0.98,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: t.alertBg,
                borderRadius: BorderRadius.circular(t.radiusMd),
                border: Border.all(color: const Color(0x59B1275B), width: 1.5), // RedFlagBanner.tsx literal
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: urgent ? t.pinkInk : t.chipOverlay),
                    child: AIcon(AIcons.heartPulse, size: 19, color: urgent ? const Color(0xFFFFFFFF) : t.alertInk),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${urgent ? tr('rfb_urgent_title', 'Təzyiq təhlükəli səviyyədədir!') : tr('rfb_warning_title', 'Təzyiqiniz yüksəkdir')} (${n(sys)}/${n(dia)})',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: t.alertInk, height: 1.5),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Text(
                            urgent
                                ? tr('rfb_urgent_sub', 'Dərhal həkimə müraciət edin — ətraflı üçün toxunun')
                                : tr('rfb_warning_sub', 'Preeklampsiya riski — bu gün həkiminizlə danışın'),
                            style: TextStyle(fontSize: 11.5, color: t.alertSoft, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  AIcon(AIcons.chevronRight, size: 16, color: t.alertInk, mirrorInRtl: true),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
