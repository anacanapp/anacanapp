// Ported from: src/hooks/useAppRating.ts, src/components/AppRatingPrompt.tsx
//
// Store-rating prompt: counts sessions (`anacan_app_usage_count`) per signed-in mount, from the 3rd one shows the
// prompt once per day (shared prompt-day marker) unless `anacan_rating_done` or the server says rated/never.
// 5★ → native in-app review (in_app_review), else store link.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth.dart';
import '../../core/data/data.dart' hide Row;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/state.dart';
import '../settings/ui/settings_ui.dart';
import 'data/app_feedback.dart';

const String kUsageCountKey = 'anacan_app_usage_count';
const String kRatingDoneKey = 'anacan_rating_done';

/// `app_rating_prompts` access.
abstract interface class RatingRepository {
  Future<Map<String, dynamic>?> current(String userId);
  Future<void> update(String userId, Map<String, dynamic> values);
  Future<void> insert(Map<String, dynamic> row);
}

class SupabaseRatingRepository implements RatingRepository {
  SupabaseRatingRepository(this._db);
  final Db _db;
  @override
  Future<Map<String, dynamic>?> current(String userId) async =>
      asRow(await _db.from('app_rating_prompts').select('id, show_count, last_action').eq('user_id', userId).maybeSingle());
  @override
  Future<void> update(String userId, Map<String, dynamic> values) async => _db.from('app_rating_prompts').update(values).eq('user_id', userId);
  @override
  Future<void> insert(Map<String, dynamic> row) async => _db.from('app_rating_prompts').insert(row);
}

final ratingRepositoryProvider = Provider<RatingRepository>((ref) => SupabaseRatingRepository(ref.watch(dbProvider)));

/// Native review + store links (`requestNativeReview` / `openAppStore`).
abstract interface class StoreReview {
  /// true = the request reached the OS.
  Future<bool> requestNativeReview();
  Future<void> openAppStore();
  String get platform;
}

class InAppStoreReview implements StoreReview {
  const InAppStoreReview();
  @override
  String get platform => switch (defaultTargetPlatform) { TargetPlatform.iOS => 'ios', TargetPlatform.android => 'android', _ => 'web' };
  @override
  Future<bool> requestNativeReview() async {
    if (platform == 'web') return false;
    try {
      await InAppReview.instance.requestReview();
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> openAppStore() async {
    final url = switch (platform) {
      'ios' => 'https://apps.apple.com/app/id6745406124?action=write-review',
      'android' => 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan',
      _ => null,
    };
    if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}

final storeReviewProvider = Provider<StoreReview>((ref) => const InAppStoreReview());

/// `useAppRating()` state.
class AppRatingController extends Notifier<bool> {
  String? _counted;

  @override
  bool build() {
    final user = ref.watch(authUserProvider);
    if (user != null && _counted != user.id) {
      _counted = user.id;
      Future<void>.microtask(() => _check(user.id));
    }
    return false;
  }

  Future<void> _check(String userId) async {
    final store = ref.read(localStoreProvider);
    if (store.getItem(kRatingDoneKey) == 'true') return;
    final count = (int.tryParse(store.getItem(kUsageCountKey) ?? '0') ?? 0) + 1;
    store.setItem(kUsageCountKey, '$count');
    if (count < 3) return;
    void showOnce() {
      final day = ref.read(feedbackStoreProvider);
      if (day.promptShownToday()) return;
      day.markPromptShown();
      state = true;
    }

    try {
      final row = await ref.read(ratingRepositoryProvider).current(userId);
      final last = row?['last_action'];
      if (last == 'rated' || last == 'never') {
        store.setItem(kRatingDoneKey, 'true');
        return;
      }
      showOnce();
    } catch (_) {
      showOnce();
    }
  }

  /// `recordAction(action)`.
  Future<void> recordAction(String action) async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    try {
      final repo = ref.read(ratingRepositoryProvider);
      final now = DateTime.now().toUtc().toIso8601String();
      final platform = ref.read(storeReviewProvider).platform;
      final existing = await repo.current(user.id);
      if (existing != null) {
        await repo.update(user.id, {
          'last_action': action,
          'last_shown_at': now,
          'show_count': ((existing['show_count'] as num?) ?? 1) + 1,
          'rated_at': action == 'rated' ? now : null,
          'platform': platform,
          'updated_at': now,
        });
      } else {
        await repo.insert({'user_id': user.id, 'last_action': action, 'platform': platform, 'rated_at': action == 'rated' ? now : null});
      }
      if (action == 'rated' || action == 'never') ref.read(localStoreProvider).setItem(kRatingDoneKey, 'true');
      state = false;
    } catch (_) {}
  }
}

final appRatingProvider = NotifierProvider<AppRatingController, bool>(AppRatingController.new);

/// `<AppRatingPrompt />` — register as a frame overlay.
class AppRatingPrompt extends ConsumerStatefulWidget {
  const AppRatingPrompt({super.key});
  @override
  ConsumerState<AppRatingPrompt> createState() => _AppRatingPromptState();
}

class _AppRatingPromptState extends ConsumerState<AppRatingPrompt> {
  int _stars = 0;

  Future<void> _submit() async {
    unawaited(HapticFeedback.mediumImpact());
    await ref.read(appRatingProvider.notifier).recordAction('rated');
    if (_stars == 5) {
      final store = ref.read(storeReviewProvider);
      if (!await store.requestNativeReview()) await store.openAppStore();
    }
  }

  Future<void> _later() async {
    unawaited(HapticFeedback.lightImpact());
    await ref.read(appRatingProvider.notifier).recordAction('later');
  }

  Future<void> _never() async {
    unawaited(HapticFeedback.lightImpact());
    await ref.read(appRatingProvider.notifier).recordAction('never');
  }

  @override
  Widget build(BuildContext context) {
    final show = ref.watch(appRatingProvider);
    if (!show) return const SizedBox.shrink();
    final s = context.tokens.shadcn;
    const amber = Color(0xFFFBBF24); // amber-400
    return SizedBox.expand(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _later,
        child: FadeRise(
          dy: 0,
          child: ColoredBox(
            color: const Color(0x99000000),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: GestureDetector(
                  onTap: () {},
                  child: FadeRise(
                    dy: 20,
                    scaleFrom: 0.8,
                    child: Material(
                      type: MaterialType.transparency,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 384),
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: s.card,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: s.border.withValues(alpha: 0.5)),
                          boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x40000000), offset: Offset(0, 25), blurRadius: 50, spreadRadius: -12)],
                        ),
                        child: Stack(clipBehavior: Clip.none, children: <Widget>[
                          Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                            Padding(
                              padding: const EdgeInsets.only(top: 8, bottom: 8),
                              child: Text(tr('appratingprompt_anacan_i_beyendiniz_34b6fc', 'Anacan-ı bəyəndiniz?'), textAlign: TextAlign.center, style: px(20, weight: FontWeight.w700, color: s.foreground, height: 1.4)),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 20),
                              child: Text(
                                tr('appratingprompt_tetbiqimizi_deyerlendirerek_di_885a35', 'Tətbiqimizi dəyərləndirərək digər analara kömək edə bilərsiniz. \n              Rəyiniz bizim üçün çox dəyərlidir! 💕').replaceAll(RegExp(r'\s+'), ' '),
                                textAlign: TextAlign.center,
                                style: Tw.sm.copyWith(color: s.mutedForeground),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 24),
                              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                                for (var i = 1; i <= 5; i++) ...<Widget>[
                                  if (i > 1) const SizedBox(width: 8),
                                  GestureDetector(
                                    key: ValueKey<String>('rating-star-$i'),
                                    onTap: () {
                                      unawaited(HapticFeedback.lightImpact());
                                      setState(() => _stars = i);
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.all(4),
                                      child: AIcon(AIcons.star, size: 40, color: i <= _stars ? amber : s.mutedForeground.withValues(alpha: 0.3)),
                                    ),
                                  ),
                                ],
                              ]),
                            ),
                            if (_stars > 0)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: GestureDetector(
                                  key: const ValueKey<String>('rating-submit'),
                                  onTap: _submit,
                                  child: Container(
                                    height: 48,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(colors: <Color>[Color(0xFFF59E0B), Color(0xFFF97316)]), // amber-500 → orange-500
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x4DF59E0B), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                                    ),
                                    child: Text(_stars == 5 ? tr('appratingprompt_deyerlendirin_8f0efc', '⭐ Dəyərləndirin') : tr('appratingprompt_gonder_3f11bd', 'Göndər'),
                                        style: Tw.sm.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFFFFFFFF))),
                                  ),
                                ),
                              ),
                            GestureDetector(
                              key: const ValueKey<String>('rating-later'),
                              onTap: _later,
                              child: SizedBox(
                                height: 40,
                                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                                  AIcon(AIcons.clock, size: 16, color: s.mutedForeground),
                                  const SizedBox(width: 8),
                                  Text(tr('appratingprompt_daha_sonra', 'Daha sonra'), style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.mutedForeground)),
                                ]),
                              ),
                            ),
                            GestureDetector(
                              key: const ValueKey<String>('rating-never'),
                              onTap: _never,
                              child: Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: SizedBox(
                                  height: 32,
                                  child: Center(child: Text(tr('appratingprompt_bir_daha_gosterme_7beb65', 'Bir daha göstərmə'), style: Tw.xs.copyWith(color: s.mutedForeground.withValues(alpha: 0.6)))),
                                ),
                              ),
                            ),
                          ]),
                          PositionedDirectional(
                            top: -8,
                            end: -8,
                            child: GestureDetector(
                              onTap: _later,
                              child: Container(
                                width: 32,
                                height: 32,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.5), shape: BoxShape.circle),
                                child: AIcon(AIcons.x, size: 16, color: s.mutedForeground),
                              ),
                            ),
                          ),
                        ]),
                      ),
                    ),
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
