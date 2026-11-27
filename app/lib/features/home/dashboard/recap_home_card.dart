// Ported from: src/components/recap/RecapEntry.tsx (RecapHomeCard), src/hooks/useRecap.ts (availability only),
//              src/lib/recap/copy.ts (recap_home_* copy, fillRecap)
//
// The Recap screen itself is not ported here: the card opens ScreenId `recap` through the shell.
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../data/home_repository.dart';
import '../home_inputs.dart';

const int recapYear = 2026;

/// The year whose recap is available for this person (`useRecap().recap?.year`), else null. Uses its own key
/// (`['anacan-recap-home', uid, year]`) until the recap feature exposes `useRecap`.
final recapHomeYearQuery = queryProvider<int?>((ref) {
  final uid = ref.watch(homeUserIdProvider);
  return QueryOptions<int?>(
    queryKey: ['anacan-recap-home', uid, recapYear],
    enabled: uid != null,
    staleTime: const Duration(minutes: 10),
    retry: retryTimes(1),
    queryFn: (_) async {
      final data = await ref.read(homeRepositoryProvider).recap(recapYear);
      if (data is Map && data['available'] == true) {
        final y = data['year'];
        return y is num ? y.toInt() : recapYear;
      }
      return null;
    },
  );
});

/// Dashboard: "Your 2026 is ready ✨" — only while the server says the recap is available.
class RecapHomeCard extends ConsumerWidget {
  const RecapHomeCard({super.key, this.onOpen, this.year});
  final VoidCallback? onOpen;

  /// Overrides the query (tests, previews).
  final int? year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final y = year ?? ref.watch(recapHomeYearQuery).data;
    if (y == null || onOpen == null) return const SizedBox.shrink();
    String fill(String s) => s.replaceAll('{year}', '$y');
    const white = Color(0xFFFFFFFF);
    // Literal colours: RecapEntry.tsx inline styles.
    return Padding(
      key: const ValueKey('recap-home-card'),
      padding: const EdgeInsets.only(top: 22),
      child: GestureDetector(
        onTap: onOpen,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF3A0F23), Color(0xFFB92B4B), Color(0xFFFF5A5F)],
              stops: [0, 0.55, 1],
            ),
            boxShadow: const [BoxShadow(offset: Offset(0, 10), blurRadius: 28, color: Color(0x47B92B4B))],
          ),
          child: Stack(children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.3,
                    colors: [Color(0xFFFFC977), Color(0x00FFC977)],
                    stops: [0, 0.45],
                  ),
                ),
              ),
            ),
            PositionedDirectional(
              end: 14,
              bottom: 6,
              child: Text('$y', style: const TextStyle(fontSize: 64, fontWeight: FontWeight.w900, height: 1, color: Color(0x24FFFFFF))),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Opacity(
                  opacity: 0.9,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AIcon(AIcons.sparkles, size: 14, color: white),
                    const SizedBox(width: 6),
                    Text('ANACAN RECAP $y', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: white)),
                  ]),
                ),
                const SizedBox(height: 8),
                Text(fill(tr('recap_home_title', 'Sənin {year}-n hazırdır ✨')),
                    style: const TextStyle(fontSize: 21, height: 1.2, fontWeight: FontWeight.w700, color: white)),
                const SizedBox(height: 4),
                Opacity(
                  opacity: 0.9,
                  child: Text(tr('recap_home_text', 'Bu ilin ən gözəl anları bir videoda. İzlə və paylaş.'),
                      style: const TextStyle(fontSize: 13, height: 1.4, color: white)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                  decoration: BoxDecoration(color: white, borderRadius: BorderRadius.circular(999)),
                  child: Text(tr('recap_home_cta', 'İzlə'),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFE63E4B))),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
