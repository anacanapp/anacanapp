// Ported from: src/components/flow/DailyStoryCards.tsx
import 'dart:ui' as ui;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_utils.dart';
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'data/phase_info.dart';
import 'widgets/flow_ui.dart';

/// `seededShuffle(arr, seed)` with JS number semantics (int32 `&`, double products before `& 0x7fffffff`).
List<T> seededShuffle<T>(List<T> arr, String seed) {
  var h = 0;
  for (final c in seed.codeUnits) {
    h = (h * 31 + c).toSigned(32);
  }
  final copy = [...arr];
  for (var i = copy.length - 1; i > 0; i--) {
    final product = h.toDouble() * 1103515245.0 + 12345.0; // may exceed 2^53: rounded like JS
    h = (BigInt.from(product) & BigInt.from(0x7fffffff)).toInt();
    final j = h % (i + 1);
    final t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy;
}

String _cardText(Map<String, dynamic> card, String field, String lang) {
  final base = (card[field] as String?) ?? '';
  final az = card['${field}_az'] as String?;
  if (lang == 'az') return (az != null && az.isNotEmpty) ? az : base;
  if (lang == 'en') {
    final en = card['${field}_en'] as String?;
    return (en != null && en.isNotEmpty) ? en : base;
  }
  final localized = card['${field}_$lang'];
  if (localized is String && localized.isNotEmpty) return localized;
  final translated = getTranslatedTip(base, lang);
  if (translated != base) return translated;
  return getTranslatedTip((az != null && az.isNotEmpty) ? az : base, lang);
}

class DailyStoryCards extends ConsumerWidget {
  const DailyStoryCards({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final cycleLength = ref.watch(effectiveCycleLengthProvider);
    final user = ref.watch(userStoreProvider);
    final today = flowNow();
    final lpd = user.lastPeriodDate;
    final phase = lpd != null ? getPhaseInfoForDate(today, lpd, cycleLength == 0 ? 28 : cycleLength, user.periodLength).phase : null;
    final insights = ref.watch(flowInsightsQuery(phase)).data ?? const [];
    if (insights.isEmpty) return const SizedBox.shrink();
    final cards = seededShuffle(insights, '${user.userId ?? 'anon'}-${ymd(today)}').take(5).toList();
    final lang = user.language;

    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: FramerEnter(
        fadeOnly: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ASectionHead(
            title: tr('dailystorycards_bu_gun_ucun_def36c', 'Bu Gün Üçün'),
            // format(today, 'd MMM') without a locale → date-fns English.
            trailing: Text(formatDatePattern(today, 'd MMM', language: 'en'), style: context.aText.aSectionLink),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.fromLTRB(2, 2, 2, 6),
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (var i = 0; i < cards.length; i++) ...[
                  if (i > 0) const SizedBox(width: 12),
                  FramerEnter(
                    dy: 10,
                    delay: Duration(milliseconds: 40 * i),
                    child: PressScale(
                      scale: 0.96,
                      onTap: () => _open(context, cards[i], lang),
                      child: Container(
                        width: 196,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(a.radiusMd)),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Container(
                            width: 40,
                            height: 40,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
                            child: Text((cards[i]['emoji'] as String?)?.isNotEmpty == true ? cards[i]['emoji'] as String : '✨', style: const TextStyle(fontSize: 18)),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 10, bottom: 4),
                            child: Text(_cardText(cards[i], 'title', lang), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink, height: 1.5)),
                          ),
                          Text(_cardText(cards[i], 'content', lang),
                              maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, height: 1.5, color: a.inkSoft)),
                        ]),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  void _open(BuildContext context, Map<String, dynamic> card, String lang) {
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'close',
      barrierColor: const Color(0x00000000),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, _) => _StorySheet(card: card, lang: lang),
      transitionBuilder: (ctx, anim, _, child) => _StorySheetTransition(animation: anim, child: child),
    );
  }
}

class _StorySheetTransition extends AnimatedWidget {
  const _StorySheetTransition({required Animation<double> animation, required this.child}) : super(listenable: animation);
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final v = ACurves.framerDefault.transform((listenable as Animation<double>).value);
    return Stack(children: [
      // bg-black/60 backdrop-blur-sm (opacity animates)
      Positioned.fill(
        child: IgnorePointer(
          child: Opacity(
            opacity: v,
            child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4), child: const ColoredBox(color: Color(0x99000000))),
          ),
        ),
      ),
      Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 100 * (1 - ACurves.spring.transform((listenable as Animation<double>).value))), child: child)),
    ]);
  }
}

class _StorySheet extends StatelessWidget {
  const _StorySheet({required this.card, required this.lang});
  final Map<String, dynamic> card;
  final String lang;
  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final mq = MediaQuery.of(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(),
      child: AScope(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: GestureDetector(
            onTap: () {},
            child: Container(
              width: double.infinity,
              constraints: BoxConstraints(maxWidth: 448, maxHeight: mq.size.height * 0.8),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(TwRadius.r2xl))),
              child: SingleChildScrollView(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text((card['emoji'] as String?)?.isNotEmpty == true ? card['emoji'] as String : '✨', style: const TextStyle(fontSize: 36, height: 40 / 36)),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                        child: AIcon(AIcons.x, size: 16, color: s.foreground),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_cardText(card, 'title', lang), style: TextStyle(fontSize: 20, height: 28 / 20, fontWeight: FontWeight.w700, color: s.foreground)),
                  ),
                  Text(_cardText(card, 'content', lang), style: TextStyle(fontSize: 14, height: 1.625, color: s.mutedForeground)),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
