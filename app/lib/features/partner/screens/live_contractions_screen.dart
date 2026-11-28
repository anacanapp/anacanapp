// Ported from: src/components/partner/v2/LiveContractionsScreen.tsx
//
// The partner follows her contraction timer live (RLS: like daily_logs he may read her contractions). The 5-1-1
// rule: interval ≤ 5 min, duration ≥ 1 min, lasting ≥ 1 hour (≥ 3 contractions in the last hour).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../baby/locale_format.dart' show localeTimeHm;
import '../../settings/ui/settings_ui.dart' show FadeRise;
import '../data/partner_data.dart';
import '../ui/partner_ui.dart';
import 'data/partner_live_rows.dart';
import 'screens_ui.dart';

typedef ContractionStats = ({int count, double avgDuration, double avgInterval, bool is511});

/// The last hour's statistics (null without a contraction in the last hour).
ContractionStats? contractionStats(List<Map<String, dynamic>> contractions, [DateTime? now]) {
  final hourAgo = (now ?? DomainClock.now()).subtract(const Duration(hours: 1));
  final recent = contractions.where((c) {
    final t = DateTime.tryParse('${c['start_time'] ?? ''}');
    return t != null && !t.isBefore(hourAgo);
  }).toList();
  if (recent.isEmpty) return null;
  num n(Object? v) => v is num ? v : 0;
  final durations = recent.map((c) => n(c['duration_seconds'])).where((d) => d > 0).toList();
  final intervals = recent.map((c) => n(c['interval_seconds'])).where((i) => i > 0).toList();
  final avgDuration = durations.isEmpty ? 0.0 : durations.fold<num>(0, (a, b) => a + b) / durations.length;
  final avgInterval = intervals.isEmpty ? 0.0 : intervals.fold<num>(0, (a, b) => a + b) / intervals.length;
  final is511 = recent.length >= 3 && avgInterval > 0 && avgInterval <= 300 && avgDuration >= 60;
  return (count: recent.length, avgDuration: avgDuration.toDouble(), avgInterval: avgInterval.toDouble(), is511: is511);
}

/// `fmtDur(s)`: `m:ss`.
String fmtContractionDuration(num s) => '${(s / 60).floor()}:${(s % 60).round().toString().padLeft(2, '0')}';

class LiveContractionsScreen extends ConsumerWidget {
  const LiveContractionsScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final data = ref.watch(partnerDataProvider);
    final userId = data.partnerProfile?.userId ?? '';
    final share = data.sharing.shareContractions;
    final live = userId.isNotEmpty && share ? ref.watch(partnerLiveRowsProvider((kind: 'contractions', userId: userId))) : const LiveRowsState(loading: false);
    final contractions = live.rows;
    final now = DomainClock.now();
    final stats = contractionStats(contractions, now);
    final last = contractions.firstOrNull;
    final lastAt = last == null ? null : DateTime.tryParse('${last['start_time'] ?? ''}');
    final minutesSinceLast = lastAt == null ? null : (now.difference(lastAt).inMilliseconds / 60000).floor();

    String fmtTime(Object? iso) {
      final d = DateTime.tryParse('${iso ?? ''}');
      return d == null ? '' : localeTimeHm(d);
    }

    Widget statCard(String value, String label) => PartnerCard(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(children: [
            Text(value, textAlign: TextAlign.center, style: pText(20, weight: FontWeight.w900, color: a.ink)),
            Text(label, textAlign: TextAlign.center, style: pText(9.5, weight: FontWeight.w600, color: a.inkSoft)),
          ]),
        );

    return PartnerSubScreen(
      onBack: onBack,
      eyebrow: tr('partnerv2_realtime', 'Realtime'),
      title: tr('partnerv2_canli_sancilar', 'Canlı sancılar'),
      children: [
        if (!share)
          PartnerEmptyCard(
            icon: AIcons.heartPulse,
            title: tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır'),
            sub: tr('partnerv2_sanci_paylasimi_bagli_izah', 'Həyat yoldaşınız sancı paylaşımını hazırda bağlayıb.'),
          )
        else if (live.loading)
          PartnerRingLoader(color: a.pink2)
        else ...[
          if (stats?.is511 ?? false) ...[
            FadeRise(
              dy: 0,
              scaleFrom: 0.95,
              child: Container(
                key: const ValueKey('lc-511'),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: a.alertBg,
                  borderRadius: BorderRadius.circular(a.radiusMd),
                  // 1.5px solid rgba(177,39,91,0.4) (LiveContractionsScreen.tsx:131)
                  border: Border.all(color: const Color(0x66B1275B), width: 1.5),
                ),
                child: Row(children: [
                  _Pulse(
                    child: Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.pinkInk, shape: BoxShape.circle),
                      child: const AIcon(AIcons.triangleAlert, size: 20, color: Color(0xFFFFFFFF)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('usepartnernotifications_5_1_1_qaydasi_976061', '⚠️ 5-1-1 Qaydası!'), style: pText(14.5, weight: FontWeight.w800, color: a.alertInk)),
                      Text(tr('partnerv2_511_izah', 'Sancılar sıxlaşıb — xəstəxanaya hazırlaş!'), style: pText(11.5, color: a.alertSoft)),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Row(children: [
            Expanded(child: statCard('${stats?.count ?? 0}', tr('partnerv2_son_1_saat', 'son 1 saat'))),
            const SizedBox(width: 10),
            Expanded(child: statCard(stats == null ? '—' : fmtContractionDuration(stats.avgDuration), tr('partnerv2_orta_muddet', 'orta müddət'))),
            const SizedBox(width: 10),
            Expanded(
              child: statCard(stats != null && stats.avgInterval > 0 ? '${(stats.avgInterval / 60).round()}d' : '—', tr('partnerv2_orta_interval', 'orta interval')),
            ),
          ]),
          if (minutesSinceLast != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
              child: Text(
                '${tr('partnerv2_son_sanci', 'Son sancı')}: ${minutesSinceLast < 1 ? tr('partnerv2_indice', 'İndicə') : '$minutesSinceLast ${tr('partnerv2_deq_evvel', 'dəq əvvəl')}'}',
                textAlign: TextAlign.center,
                style: pText(12, weight: FontWeight.w700, color: a.alertInk),
              ),
            ),
          ],
          const SizedBox(height: 14),
          PartnerCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr('partnerv2_son_24_saat', 'Son 24 saat'), style: context.aText.aCardTitle)),
              if (contractions.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(tr('partnerv2_sanci_yoxdur', 'Sancı qeyd olunmayıb — hər şey sakitdir 💚'), textAlign: TextAlign.center, style: pText(12.5, color: a.inkSoft)),
                )
              else
                for (final (i, c) in contractions.take(15).indexed) ...[
                  if (i > 0) const SizedBox(height: 6),
                  FadeRise(
                    key: ValueKey('lc-${c['id']}'),
                    dy: 0,
                    dx: -8,
                    delay: Duration(milliseconds: i * 20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                      decoration: BoxDecoration(color: i == 0 ? a.surfaceSoft : const Color(0x00000000), borderRadius: BorderRadius.circular(13)),
                      child: Row(children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
                          child: AIcon(AIcons.heartPulse, size: 14, color: a.pinkInk),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(fmtTime(c['start_time']), style: pText(12.5, weight: FontWeight.w600, color: a.ink))),
                        if (c['duration_seconds'] is num && (c['duration_seconds'] as num) > 0) ...[
                          const SizedBox(width: 10),
                          Text(fmtContractionDuration(c['duration_seconds'] as num), style: pText(11, weight: FontWeight.w700, color: a.inkSoft)),
                        ],
                        if (c['interval_seconds'] is num && (c['interval_seconds'] as num) > 0) ...[
                          const SizedBox(width: 10),
                          Text(
                            '· ${((c['interval_seconds'] as num) / 60).round()}${tr('partnerv2_d_short', 'd')} ${tr('partnerv2_interval_short', 'interval')}',
                            style: pText(10.5, color: a.inkFaint),
                          ),
                        ],
                      ]),
                    ),
                  ),
                ],
            ]),
          ),
        ],
      ],
    );
  }
}

/// framer `animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1, repeat: Infinity }}`.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final v = _c.value;
          final scale = 1 + 0.12 * (v < 0.5 ? v * 2 : (1 - v) * 2);
          return Transform.scale(scale: scale, child: child);
        },
        child: widget.child,
      );
}
