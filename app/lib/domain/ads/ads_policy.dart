// Ported from: src/lib/ads/policy.ts
//
// AdMob delivery policy: whether a placement may show now, and the per-device ledger of shown ads (session,
// UTC day, cooldowns, rewarded pause). The ledger JSON keeps the TypeScript field names.

import 'dart:math' as math;

import '../js_compat.dart';
import 'ads_config.dart';

/// Reason codes (see [adReasonLabels]).
typedef AdBlockReason = String;

/// Admin diagnostics labels (Azerbaijani, admin-only copy in the TypeScript too).
const Map<AdBlockReason, String> adReasonLabels = {
  'ready': 'Göstərilməyə hazırdır', 'configuration': 'Konfiqurasiya alınmayıb və ya köhnəlib', 'disabled': 'Ümumi reklam açarı bağlıdır',
  'placement_disabled': 'Bu placement deaktivdir', 'platform': 'Bu platforma üçün bağlıdır', 'premium': 'Premium / ailə Premium-u reklamsızdır',
  'entitlement_loading': 'Abunəlik vəziyyəti dəqiqləşdirilir', 'signed_out': 'İstifadəçi hesabına daxil olmayıb', 'background': 'Tətbiq arxa plandadır',
  'offline': 'Şəbəkə yoxdur', 'blocked_screen': 'Modal, klaviatura və ya qorunan ekran açıqdır', 'paused': 'Reklamsız fasilə aktivdir',
  'schedule': 'Placement-in vaxt cədvəli uyğun deyil', 'startup_delay': 'Sessiyanın başlanğıc fasiləsi gözlənilir',
  'screen_time': 'Ekranda minimum vaxt tamamlanmayıb', 'placement_cooldown': 'Bu placement-in fasiləsi bitməyib',
  'global_cooldown': 'Tam ekran reklamları arasındakı ümumi fasilə bitməyib', 'session_cap': 'Sessiya limiti dolub', 'daily_cap': 'Günlük limit dolub',
  'unsupported': 'Bu build-də native AdMob SDK-sı yoxdur', 'update_required': 'Yeni native build tələb olunur',
  'app_id_mismatch': 'Build-dəki App ID ilə idarəetmədəki App ID fərqlidir', 'unit_id': 'Uyğun reklam ID-si yoxdur',
  'consent': 'Reklam sorğusu üçün UMP icazəsi yoxdur', 'demo_only': 'Vebdə yalnız admin demo önizləməsi işləyir', 'busy': 'Başqa reklam açıqdır',
  'not_ready': 'Reklam əvvəlcədən yüklənməyib',
};

class AdCounts {
  AdCounts({this.session = 0, this.day = 0, this.last = 0});
  int session;
  int day;
  int last;

  AdCounts clone() => AdCounts(session: session, day: day, last: last);
  factory AdCounts.fromJson(Map<String, Object?> j) =>
      AdCounts(session: (j['session'] as num).toInt(), day: (j['day'] as num).toInt(), last: (j['last'] as num).toInt());
  Map<String, Object?> toJson() => {'session': session, 'day': day, 'last': last};
}

class AdLedger {
  AdLedger({required this.date, required this.sessionId, Map<String, AdCounts>? placements, AdCounts? fullscreen, this.lastBanner = 0, this.pauseUntil = 0})
      : placements = placements ?? {},
        fullscreen = fullscreen ?? AdCounts();
  String date;
  String sessionId;
  Map<String, AdCounts> placements;
  AdCounts fullscreen;
  int lastBanner;
  int pauseUntil;

  /// structuredClone.
  AdLedger clone() => AdLedger(
        date: date,
        sessionId: sessionId,
        placements: {for (final e in placements.entries) e.key: e.value.clone()},
        fullscreen: fullscreen.clone(),
        lastBanner: lastBanner,
        pauseUntil: pauseUntil,
      );

  factory AdLedger.fromJson(Map<String, Object?> j) => AdLedger(
        date: j['date'] as String,
        sessionId: j['session_id'] as String,
        placements: {
          for (final e in (j['placements'] as Map).entries) e.key as String: AdCounts.fromJson((e.value as Map).cast<String, Object?>()),
        },
        fullscreen: AdCounts.fromJson((j['fullscreen'] as Map).cast<String, Object?>()),
        lastBanner: (j['last_banner'] as num).toInt(),
        pauseUntil: (j['pause_until'] as num).toInt(),
      );

  Map<String, Object?> toJson() => {
        'date': date,
        'session_id': sessionId,
        'placements': {for (final e in placements.entries) e.key: e.value.toJson()},
        'fullscreen': fullscreen.toJson(),
        'last_banner': lastBanner,
        'pause_until': pauseUntil,
      };
}

class AdEvaluationContext {
  const AdEvaluationContext({
    required this.now,
    required this.sessionStartedAt,
    required this.screenStartedAt,
    required this.platform,
    required this.signedIn,
    required this.entitlementReady,
    required this.premium,
    required this.foreground,
    required this.online,
    required this.blocked,
    required this.native,
    required this.sdkAvailable,
    required this.nativeVersion,
    required this.compiledAppId,
    required this.consent,
    required this.demo,
    this.busy = false,
    this.fastPreview = false,
    this.alreadyShowingBanner = false,
  });
  final int now;
  final int sessionStartedAt;
  final int screenStartedAt;
  final AdPlatform platform;
  final bool signedIn;
  final bool entitlementReady;
  final bool premium;
  final bool foreground;
  final bool online;
  final bool blocked;
  final bool native;
  final bool sdkAvailable;
  final String nativeVersion;
  final String compiledAppId;
  final bool consent;
  final bool demo;
  final bool busy;
  final bool fastPreview;
  final bool alreadyShowingBanner;

  AdEvaluationContext copyWith({
    int? now,
    int? sessionStartedAt,
    bool? signedIn,
    bool? entitlementReady,
    bool? premium,
    bool? foreground,
    bool? online,
    bool? blocked,
    bool? native,
    bool? sdkAvailable,
    String? nativeVersion,
    String? compiledAppId,
    bool? consent,
    bool? demo,
    bool? alreadyShowingBanner,
  }) =>
      AdEvaluationContext(
        now: now ?? this.now,
        sessionStartedAt: sessionStartedAt ?? this.sessionStartedAt,
        screenStartedAt: screenStartedAt,
        platform: platform,
        signedIn: signedIn ?? this.signedIn,
        entitlementReady: entitlementReady ?? this.entitlementReady,
        premium: premium ?? this.premium,
        foreground: foreground ?? this.foreground,
        online: online ?? this.online,
        blocked: blocked ?? this.blocked,
        native: native ?? this.native,
        sdkAvailable: sdkAvailable ?? this.sdkAvailable,
        nativeVersion: nativeVersion ?? this.nativeVersion,
        compiledAppId: compiledAppId ?? this.compiledAppId,
        consent: consent ?? this.consent,
        demo: demo ?? this.demo,
        busy: busy,
        fastPreview: fastPreview,
        alreadyShowingBanner: alreadyShowingBanner ?? this.alreadyShowingBanner,
      );
}

class AdDecision {
  const AdDecision({required this.allowed, required this.reason, required this.waitSeconds, required this.mode, required this.adUnitId});
  final bool allowed;
  final AdBlockReason reason;
  final int waitSeconds;
  final AdMode mode;
  final String? adUnitId;
}

String _utcDay(int ms) => jsToIsoString(DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true)).substring(0, 10);

AdLedger emptyAdLedger([int? now, String sessionId = '']) => AdLedger(date: _utcDay(now ?? DomainClock.nowMs()), sessionId: sessionId);

/// New UTC day resets daily counts; a new session resets session counts. Pause and cooldowns are kept.
AdLedger normalizeAdLedger(AdLedger input, int now, String sessionId) {
  final next = input.clone(), day = _utcDay(now);
  if (next.date != day) {
    next.date = day;
    next.fullscreen.day = 0;
    for (final c in next.placements.values) {
      c.day = 0;
    }
  }
  if (next.sessionId != sessionId) {
    next.sessionId = sessionId;
    next.fullscreen.session = 0;
    for (final c in next.placements.values) {
      c.session = 0;
    }
  }
  return next;
}

AdDecision evaluateAd(AdsConfiguration? config, String id, AdEvaluationContext context, AdLedger ledger) {
  final AdMode mode = context.demo ? 'demo' : (config?.settings.mode ?? 'demo');
  AdDecision deny(AdBlockReason reason, [int until = 0]) => AdDecision(
        allowed: false,
        reason: reason,
        waitSeconds: math.max(0, ((until - context.now) / 1000).ceil()),
        mode: mode,
        adUnitId: null,
      );
  if (config == null) return deny('configuration');
  final settings = config.settings;
  final placementList = config.placements.where((p) => p.id == id);
  final placement = placementList.isEmpty ? null : placementList.first;
  final format = placementDefinition(id)['format']!;
  if (!context.signedIn) return deny('signed_out');
  if (!context.entitlementReady) return deny('entitlement_loading');
  if (context.premium) return deny('premium');
  if (!settings.enabled) return deny('disabled');
  if (placement == null || !placement.enabled) return deny('placement_disabled');
  if (!placement.platforms.contains(context.platform)) return deny('platform');
  if (!context.foreground) return deny('background');
  if (!context.online) return deny('offline');
  if (context.blocked) return deny('blocked_screen');
  if (context.busy) return deny('busy');
  if (ledger.pauseUntil > context.now) return deny('paused', ledger.pauseUntil);
  final startMs = placement.startAt != null && placement.startAt!.isNotEmpty ? jsDateParseMs(placement.startAt!) : null;
  final endMs = placement.endAt != null && placement.endAt!.isNotEmpty ? jsDateParseMs(placement.endAt!) : null;
  // `now < Date.parse(bad)` is false in JS, so an unparsable date never blocks.
  if ((startMs != null && context.now < startMs) || (endMs != null && context.now >= endMs)) return deny('schedule');
  if (mode == 'demo' && !context.demo) return deny('demo_only');
  if (mode != 'demo') {
    if (!context.native || !context.sdkAvailable) return deny('unsupported');
    final version = compareNativeVersions(context.nativeVersion, settings.minNativeVersion);
    if (version == null || version < 0) return deny('update_required');
    final appId = settings.appIdFor(context.platform);
    final matchesBuild = mode == 'test'
        ? isAppId(context.compiledAppId) && (context.compiledAppId == testAppIds[context.platform] || context.compiledAppId == appId)
        : isAppId(appId) && appId == context.compiledAppId;
    if (!matchesBuild) return deny('app_id_mismatch');
    if (!context.consent) return deny('consent');
  }
  final unit = mode == 'test'
      ? (format == 'native_story' && placement.storyFormat == 'video'
          ? testStoryVideoIds[context.platform]!
          : testUnitIds[context.platform]![format]!)
      : placement.adUnitIdFor(context.platform);
  if (mode == 'live' && (!isAdUnitId(unit) || isTestId(unit))) return deny('unit_id');
  if (format == 'banner' && context.alreadyShowingBanner) {
    return AdDecision(allowed: true, reason: 'ready', waitSeconds: 0, mode: mode, adUnitId: mode == 'demo' ? null : unit);
  }
  final startupUntil = context.sessionStartedAt + settings.startupDelaySeconds * 1000;
  if (!context.fastPreview && format != 'rewarded' && context.now < startupUntil) return deny('startup_delay', startupUntil);
  final screenUntil = context.screenStartedAt + placement.minScreenSeconds * 1000;
  if (!context.fastPreview && context.now < screenUntil) return deny('screen_time', screenUntil);
  final count = ledger.placements[id] ?? AdCounts();
  if (count.session >= placement.sessionCap) return deny('session_cap');
  if (count.day >= placement.dailyCap) return deny('daily_cap');
  if (count.last != 0 && context.now < count.last + placement.cooldownSeconds * 1000) {
    return deny('placement_cooldown', count.last + placement.cooldownSeconds * 1000);
  }
  if (format != 'banner') {
    if (ledger.fullscreen.session >= settings.fullscreenSessionCap) return deny('session_cap');
    if (ledger.fullscreen.day >= settings.fullscreenDailyCap) return deny('daily_cap');
    final until = ledger.fullscreen.last + settings.fullscreenCooldownSeconds * 1000;
    if (placement.respectGlobalCooldown && ledger.fullscreen.last != 0 && context.now < until) return deny('global_cooldown', until);
  } else if (ledger.lastBanner != 0 && context.now < ledger.lastBanner + settings.bannerChangeIntervalSeconds * 1000) {
    return deny('global_cooldown', ledger.lastBanner + settings.bannerChangeIntervalSeconds * 1000);
  }
  return AdDecision(allowed: true, reason: 'ready', waitSeconds: 0, mode: mode, adUnitId: mode == 'demo' ? null : unit);
}

AdLedger recordAdShown(AdLedger ledger, String id, int now) {
  final next = ledger.clone();
  final count = next.placements[id] ?? AdCounts();
  next.placements[id] = AdCounts(session: count.session + 1, day: count.day + 1, last: now);
  if (placementDefinition(id)['format'] != 'banner') {
    next.fullscreen = AdCounts(session: next.fullscreen.session + 1, day: next.fullscreen.day + 1, last: now);
  } else {
    next.lastBanner = now;
  }
  return next;
}
