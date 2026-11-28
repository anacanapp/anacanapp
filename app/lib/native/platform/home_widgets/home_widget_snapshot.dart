// Ported from: src/lib/home-widgets.ts (snapshot model, WIDGET_LINKS, sampleCare, dailyWord, compactDuration,
//              babyAgeText, widgetLabels, buildWidgetSnapshot), src/hooks/useHomeWidgetSync.ts (lastFeed, sleepPlan,
//              the mommy journey and care data)
//
// Pure snapshot building for the native home-screen widgets. The JSON is read by Android `AnacanWidgets.kt` and the iOS
// widget extension (`AnacanHomeWidgets.swift` HWSnapshot), so field names and shapes must stay as in React.
import 'dart:convert';

import '../../../domain/baby/baby_logs_range.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/sleep/sleep_predict.dart';
import '../../../domain/sleep/sleep_training.dart';
import '../../../features/home/home_slots.dart' show HomeWidgetJourney;
import '../../../features/settings/copy/feature_copy.dart' show FeatureText, fill;
import '../../../features/settings/widget_settings_screen.dart' show WidgetSettings;
import '../../../features/tools/sleep_training/sleep_training_sync.dart' show parseStored, planStorageKeyV2;

/// `WIDGET_LINKS`.
const Map<String, String> kWidgetLinks = {
  'home': 'anacan:///',
  'premium': 'anacan://premium',
  'feed': 'anacan://tool/baby-tracker?widget_action=feed',
  'sleep': 'anacan://tool/sleep-training?widget_action=sleep',
  'diaper': 'anacan://tool/baby-tracker?widget_action=diaper',
  'sleepTool': 'anacan://tool/sleep-training',
  'tracker': 'anacan://tool/baby-tracker',
};

/// `WidgetCare` (times are epoch ms).
class WidgetCare {
  const WidgetCare({
    required this.name,
    required this.age,
    required this.emoji,
    required this.lastFeedAt,
    required this.lastFeedText,
    required this.nextNapStart,
    required this.nextNapEnd,
    required this.nextNapIsBedtime,
    required this.sleepingSince,
    required this.todayFeeds,
    required this.todaySleep,
    required this.todayDiapers,
    this.dayStart,
  });

  final String name, age, emoji, lastFeedText, todaySleep;
  final int? lastFeedAt, nextNapStart, nextNapEnd, sleepingSince;
  final bool nextNapIsBedtime;
  final int todayFeeds, todayDiapers;

  /// Local midnight (epoch ms) of the day the today* totals belong to; native widgets show 0 once that day is over.
  final int? dayStart;

  Map<String, Object?> toJson() => {
        'name': name,
        'age': age,
        'emoji': emoji,
        'lastFeedAt': lastFeedAt,
        'lastFeedText': lastFeedText,
        'nextNapStart': nextNapStart,
        'nextNapEnd': nextNapEnd,
        'nextNapIsBedtime': nextNapIsBedtime,
        'sleepingSince': sleepingSince,
        'todayFeeds': todayFeeds,
        'todaySleep': todaySleep,
        'todayDiapers': todayDiapers,
        if (dayStart != null) 'dayStart': dayStart,
      };

  /// `applySettings` of buildWidgetSnapshot.
  WidgetCare withSettings(WidgetSettings settings, int dayStart) => WidgetCare(
        name: name,
        age: age,
        emoji: emoji,
        lastFeedAt: settings.showFeed ? lastFeedAt : null,
        lastFeedText: settings.showFeed ? lastFeedText : '',
        nextNapStart: settings.showNap ? nextNapStart : null,
        nextNapEnd: settings.showNap ? nextNapEnd : null,
        nextNapIsBedtime: nextNapIsBedtime,
        sleepingSince: sleepingSince,
        todayFeeds: todayFeeds,
        todaySleep: todaySleep,
        todayDiapers: todayDiapers,
        dayStart: dayStart,
      );
}

/// `WidgetWord`.
class WidgetWord {
  const WidgetWord({required this.eyebrow, required this.text});
  final String eyebrow, text;
  Map<String, Object?> toJson() => {'eyebrow': eyebrow, 'text': text};
}

/// `WidgetSnapshot`.
class WidgetSnapshot {
  const WidgetSnapshot({
    required this.updatedAt,
    this.locale,
    required this.premium,
    required this.privacy,
    required this.showActions,
    required this.journey,
    required this.care,
    required this.careLocked,
    required this.word,
    required this.labels,
    this.links = kWidgetLinks,
  });

  final int updatedAt;
  final String? locale;
  final bool premium, privacy, showActions, careLocked;
  final HomeWidgetJourney? journey;
  final WidgetCare? care;
  final WidgetWord? word;
  final Map<String, String> labels;
  final Map<String, String> links;

  Map<String, Object?> toJson() => {
        'v': 1,
        'updatedAt': updatedAt,
        if (locale != null) 'locale': locale,
        'premium': premium,
        'privacy': privacy,
        'showActions': showActions,
        'journey': journey?.toJson(),
        'care': care?.toJson(),
        'careLocked': careLocked,
        'word': word?.toJson(),
        'labels': labels,
        'links': links,
      };

  /// The JSON sent to the native side.
  String encode() => jsonEncode(toJson());

  /// The snapshot without `updatedAt` (`pushWidgetSnapshot` sends only when this changed).
  String stableKey() => jsonEncode(toJson()..remove('updatedAt'));
}

int _jsRound(num x) => jsRoundInt(x);

/// `sampleCare(t, now)`: a realistic preview so a non-Premium user sees the full (locked) care widget.
WidgetCare sampleCare(FeatureText t, DateTime now) {
  final ms = now.millisecondsSinceEpoch;
  return WidgetCare(
    name: 'Nuray',
    age: fill(t('baby_months'), {'m': 3, 'd': 12}),
    emoji: '👶',
    lastFeedAt: ms - 2 * 3600000,
    lastFeedText: '${t('sides.left')} · ${fill(t('minutes'), {'n': 14})}',
    nextNapStart: ms + 45 * 60000,
    nextNapEnd: ms + 105 * 60000,
    nextNapIsBedtime: false,
    sleepingSince: null,
    todayFeeds: 6,
    todaySleep: fill(t('hours_minutes'), {'h': 4, 'm': 20}),
    todayDiapers: 5,
  );
}

/// `dailyWord(t, now)`: rotated by the day of the year.
WidgetWord? dailyWord(FeatureText t, DateTime now) {
  final words = t.list('words');
  if (words.isEmpty) return null;
  // new Date(now.getFullYear(), 0, 0): 31 December of the previous year, local midnight.
  final day = ((now.millisecondsSinceEpoch - DateTime(now.year, 1, 0).millisecondsSinceEpoch) / 86400000).floor();
  return WidgetWord(eyebrow: t('word_eyebrow'), text: words[day % words.length]);
}

/// `compactDuration(t, minutes)`.
String compactDuration(FeatureText t, num minutes) {
  final m = _jsRound(minutes) < 0 ? 0 : _jsRound(minutes);
  return m >= 60 ? fill(t('hours_minutes'), {'h': m ~/ 60, 'm': m % 60}) : fill(t('minutes'), {'n': m});
}

/// `babyAgeText(t, birth, now)`: "3 ay 12 gün", "12 gün", "1 yaş 3 ay".
String babyAgeText(FeatureText t, DateTime birth, DateTime now) {
  var months = (now.year - birth.year) * 12 + now.month - birth.month;
  if (now.day < birth.day) months -= 1;
  if (months < 0) months = 0;
  final anchor = DateTime(birth.year, birth.month + months, birth.day);
  final today = DateTime(now.year, now.month, now.day);
  final diff = ((today.millisecondsSinceEpoch - anchor.millisecondsSinceEpoch) / 86400000).floor();
  final days = diff < 0 ? 0 : diff;
  if (months >= 12) return fill(t('baby_years'), {'y': months ~/ 12, 'm': months % 12});
  if (months == 0) return fill(t('baby_days'), {'d': days});
  return fill(t('baby_months'), {'m': months, 'd': days});
}

/// `widgetLabels(t)`.
Map<String, String> widgetLabels(FeatureText t) => {
      'lastFeed': t('last_feed'),
      'nextNap': t('next_nap'),
      'bedtime': t('bedtime'),
      'sleeping': t('sleeping'),
      'awake': t('awake'),
      'today': t('today'),
      'feeds': t('feeds'),
      'sleep': t('sleep'),
      'diapers': t('diapers'),
      'btnFeed': t('btn_feed'),
      'btnSleep': t('btn_sleep'),
      'btnDiaper': t('btn_diaper'),
      'btnWoke': t('btn_woke'),
      'premiumTitle': t('premium_title'),
      'premiumBody': t('premium_body'),
      'noData': t('no_data'),
      'openApp': t('open_app'),
      'hidden': t('hidden'),
      'hoursMinutes': t('hours_minutes'),
      'minutes': t('minutes'),
      'premiumBadge': t('premium_badge'),
      'premiumLocked': t('premium_locked_title'),
      'wordEyebrow': t('word_eyebrow'),
      'timerIdle': t('timer_idle'),
      'sideLeft': t('sides.left'),
      'sideRight': t('sides.right'),
      'todayZeroSleep': fill(t('minutes'), {'n': 0}),
    };

/// `buildWidgetSnapshot(o)`.
WidgetSnapshot buildWidgetSnapshot({
  required FeatureText text,
  required bool premium,
  required WidgetSettings settings,
  required HomeWidgetJourney? journey,
  required WidgetCare? care,
  required DateTime now,
  String? locale,
}) {
  final dayStart = DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;
  // Premium: real data. Non-Premium: a sample preview (native renders it with a "Premium required" overlay), so no
  // real feeding / sleep data leaves the app.
  final careOut = premium ? care?.withSettings(settings, dayStart) : sampleCare(text, now).withSettings(settings, dayStart);
  return WidgetSnapshot(
    updatedAt: now.millisecondsSinceEpoch,
    locale: locale,
    premium: premium,
    privacy: settings.privacy,
    showActions: settings.showActions,
    journey: journey,
    care: careOut,
    careLocked: !premium,
    word: dailyWord(text, now),
    labels: widgetLabels(text),
  );
}

// ── useHomeWidgetSync.ts ─────────────────────────────────────────────────────────────────────────────────────────

/// `lastFeed(t, logs)`: the latest feeding as widget text ("Sol sinə · 14 dəq").
({int at, String text})? lastFeed(FeatureText t, List<BabyLogRow> logs) {
  final feeds = logs.where((l) => l.logType == 'feeding' && feedKind(l.feedType) != null).toList()
    ..sort((a, b) => b.startTime.compareTo(a.startTime));
  if (feeds.isEmpty) return null;
  final f = feeds.first;
  final kind = feedKind(f.feedType)!;
  final start = jsParseDate(f.startTime)?.millisecondsSinceEpoch;
  if (start == null) return null;
  final end = f.endTime == null ? null : jsParseDate(f.endTime!)?.millisecondsSinceEpoch;
  final minutes = end != null && end > start ? _jsRound((end - start) / 60000) : null;
  final suffix = minutes != null && minutes != 0 ? ' · ${fill(t('minutes'), {'n': minutes})}' : '';
  return (at: end ?? start, text: '${t('sides.$kind')}$suffix');
}

/// `sleepPlan(userId)`: the running sleep (pending start) and the morning wake time of the sleep-training plan.
///
/// React read the per-account v1 key, which the sleep-training tool stopped updating when plans moved to one copy per
/// child (v2); the widget then showed a stale "sleeping since". The v2 copy of the selected child is read first and the
/// v1 key stays as the fallback (docs/flutter/PARITY_FIXES.md).
({DateTime? sleepingSince, String? wakeTime}) sleepPlan(
  String? Function(String key) getItem,
  String? userId,
  String? childId,
  DateTime now,
) {
  if (userId == null) return (sleepingSince: null, wakeTime: null);
  try {
    PlanState? plan = parseStored(getItem(planStorageKeyV2(userId, childId)), localDateKey(now))?.plan;
    if (plan == null) {
      final raw = getItem(planStorageKey(userId));
      plan = parsePlanState(raw == null ? null : jsonDecode(raw));
    }
    final pending = plan.pendingSleepStart;
    return (sleepingSince: pending == null ? null : jsParseDate(pending), wakeTime: plan.wakeTime);
  } catch (_) {
    return (sleepingSince: null, wakeTime: null);
  }
}

/// The mommy journey + care data of useHomeWidgetSync for the selected child ([birthIso] = child birth date or the
/// profile's `baby_birth_date`).
({HomeWidgetJourney journey, WidgetCare care}) mommyWidgetData({
  required FeatureText text,
  required String birthIso,
  required String name,
  required String emoji,
  required List<BabyLogRow> logs,
  required ({DateTime? sleepingSince, String? wakeTime}) plan,
  required DateTime now,
}) {
  final birth = jsParseDate(birthIso) ?? now;
  final age = babyAgeText(text, birth, now);
  final journey = HomeWidgetJourney(eyebrow: name, title: age, subtitle: '', badge: '', progress: 0, emoji: emoji);
  final today = logsOfDay(logs, now);
  final feed = lastFeed(text, logs);
  final band = ageBand(monthsOld(birth, now));
  final wake = plan.wakeTime == null ? null : parseClock(plan.wakeTime!);
  final morningWake = wake == null ? null : DateTime(now.year, now.month, now.day, wake ~/ 60, wake % 60);
  final next = band == null
      ? null
      : predictNextNap(entries: sleepEntries(logs), band: band, now: now, sleepingSince: plan.sleepingSince, morningWake: morningWake);
  final care = WidgetCare(
    name: name,
    age: age,
    emoji: emoji,
    lastFeedAt: feed?.at,
    lastFeedText: feed?.text ?? '',
    nextNapStart: next?.windowStart?.millisecondsSinceEpoch,
    nextNapEnd: next?.windowEnd?.millisecondsSinceEpoch,
    nextNapIsBedtime: next?.isBedtime ?? false,
    sleepingSince: plan.sleepingSince?.millisecondsSinceEpoch,
    todayFeeds: feedingStats(today).total,
    todaySleep: compactDuration(text, sleepStats(today).totalMinutes),
    todayDiapers: diaperStats(today).total,
  );
  return (journey: journey, care: care);
}
