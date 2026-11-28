// Ported from: src/lib/migration-export.ts (MIGRATION_EXPORT_RULES, MIGRATION_EXPORT_EXCLUDED,
// isMigrationExportKey, collectMigrationEntries).
//
// The same key selection the 53.0 bridge export applies, used by the Flutter side when it reads the
// WebView localStorage itself (hidden-WebView fallback for users who skip 53.0, and the `skipped` keys of a
// 53.0 export). `test/core/storage/migration_export_rules_test.dart` fails when this list drifts from the
// TypeScript one.

import 'dart:convert';

class MigrationKeyRule {
  const MigrationKeyRule.exact(this.area, this.key) : prefix = false;
  const MigrationKeyRule.prefix(this.area, this.key) : prefix = true;

  final String area;
  final String key;
  final bool prefix;

  bool matches(String candidate) => prefix ? candidate.startsWith(key) : candidate == key;
}

List<MigrationKeyRule> _exact(String area, List<String> keys) => [for (final k in keys) MigrationKeyRule.exact(area, k)];
List<MigrationKeyRule> _prefix(String area, List<String> keys) =>
    [for (final k in keys) MigrationKeyRule.prefix(area, k)];

/// `MIGRATION_EXPORT_RULES`, in priority order.
final List<MigrationKeyRule> migrationExportRules = List.unmodifiable([
  ..._exact('app-lock', ['anacan_lock_enabled', 'anacan_lock_hash', 'anacan_lock_salt', 'anacan_lock_bio']),
  ..._exact('user', ['anacan-user-store', 'selected-child-storage', 'language']),
  ..._exact('timers', ['anacan-timers', 'anacan_tool_live_timer_v1']),
  ..._prefix('timers', ['anacan_contraction_timer_v1:', 'anacan_kick_active_v1:']),
  ..._prefix('outbox', [
    'anacan_outbox_v1:', 'anacan_contraction_queue_v1:', 'anacan_consent_pending_v1:',
    'anacan-moderator-warning-acks-v1:',
  ]),
  ..._prefix('plans', [
    'anacan.sleepTraining.', 'anacan.parenting.v1.', 'anacan.weaning.v1.', 'anacan_kid_exercises_v1:',
    'anacan.play-together.v1.', 'anacan:weight-tracker:height-cm',
  ]),
  ..._prefix('drafts', ['anacan-onboarding-v3:', 'anacan_loss_letter_v1:', 'anacan_loss_todo_v1:', 'anacan_baby_chat_v1:']),
  ..._exact('drafts', [
    'anacan_pending_funnel', 'anacan_iep_pending_v1', 'anacan:promo-code', 'anacan_books_cart_v1',
    'anacan_books_pending_v1', 'anacan_partner_basket_v1', 'anacan_olivia_basket_v1', 'anacan-aptek-checkout',
    'anacan-aptek-recent', 'cake-cart',
  ]),
  ..._exact('games', [
    'anacan_colorsort_round_v1', 'anacan_colorsort_level_count_v1', 'anacan_colorsort_markers_v1',
    'anacan:qabarciq:best:v1', 'anacan:qabarciq:sound:v1', 'anacan_two_friends_preferences_v1',
    'anacan_word_garden_preferences_v1',
  ]),
  ..._prefix('games', ['anacan_word_garden_v1:', 'anacan_two_friends_v1:', 'anacan_casual_v1:', 'anacan_minigame_progress_']),
  ..._exact('health', ['anacan_health_connected', 'anacan_health_cycle_write', 'anacan_glucose_unit', 'anacan.illness.temp-unit']),
  ..._prefix('health', ['anacan_health_vitals_', 'anacan.mommyPeriod.endedOn.']),
  ..._exact('notifications', [
    'anacan_water_reminder_enabled', 'anacan.vaccineReminders.v1', 'anacan.vaccineReminders.childSlots.v1',
    'anacan.localNotifications.v1', 'anacan.napAlerts.v1', 'anacan.parenting.reminders.v1',
    'anacan_kick_ten_notified_day', 'last_push_prompt_date',
  ]),
  ..._prefix('notifications', ['silent_hours_']),
  ..._exact('settings', ['anacan.widgets.settings.v1', 'anacan.sleepCues.v1', 'anacan_recent_stickers_v1']),
  ..._prefix('settings', ['anacan_ai_consent_v1:', 'anacan.hospital-bag.hidden.']),
  ..._exact('counters', [
    'anacan_app_usage_count', 'anacan_rating_done', 'anacan.review.firstOpenAt', 'anacan.feedback.sentAt',
    'anacan.feedback.dismissedAt', 'anacan_referral_converted_synced',
  ]),
  ..._prefix('counters', ['anacan.ads.ledger.v1:', 'anacan_app_update_later_']),
  ..._exact('seen', ['anacan_ai_warn_dismissed', 'anacan_partner_tour_v2', 'anacan.lockOffer.seenAt', 'anacan.prompt.lastShownDay']),
  ..._prefix('seen', [
    'anacan_tour_v', 'anacan.parenting.intro.v1.', 'anacan.weaning.homecard.v1.', 'preemie-backfill-dismissed-',
    'anacan_qc_intro_dismissed_v1:', 'anacan-ad-free-offer-seen-v1:', 'community_seen_', 'anacan-stories-seen:',
    'anacan.market.inbox.seen.v1:',
  ]),
]);

/// `MIGRATION_EXPORT_EXCLUDED` as (JavaScript source, flags) pairs; never copied even if a rule matches.
const List<(String, String)> migrationExportExcludedSources = [
  (r'^sb-.*-auth-token', ''),
  (r'auth-token', 'i'),
  (r'^anacan\.auth[.-]', ''),
  (r'^anacan\.backend-admission', ''),
  (r'^anacan-rq-', ''),
  (r'refresh_token|access_token', 'i'),
];

final List<RegExp> _excluded = [
  for (final (source, flags) in migrationExportExcludedSources) RegExp(source, caseSensitive: !flags.contains('i')),
];

/// Rule priority (index into [migrationExportRules]) for an exported key, or -1.
int migrationRulePriority(String key) {
  if (_excluded.any((pattern) => pattern.hasMatch(key))) return -1;
  for (var i = 0; i < migrationExportRules.length; i++) {
    final rule = migrationExportRules[i];
    if (!rule.prefix && rule.key == key) return i;
  }
  for (var i = 0; i < migrationExportRules.length; i++) {
    final rule = migrationExportRules[i];
    if (rule.prefix && key.startsWith(rule.key)) return i;
  }
  return -1;
}

/// `isMigrationExportKey`.
bool isMigrationExportKey(String key) => migrationRulePriority(key) >= 0;

/// The exportable subset of a raw localStorage snapshot. Unlike the 53.0 exporter there is no size cap:
/// the Flutter LocalStore has no 5 MB quota and the values never pass through Capacitor Preferences.
Map<String, String> selectMigrationEntries(Map<String, String> localStorage) => {
      for (final MapEntry(:key, :value) in localStorage.entries)
        if (isMigrationExportKey(key)) key: value,
    };

/// JavaScript run inside the hidden WebView on the legacy origin. It applies the same rules there, so
/// credentials and the react-query cache never leave the WebView, and evaluates to a JSON string
/// `{"length":<localStorage.length>,"entries":{key: value}}`. Read-only: it never writes localStorage.
String buildLegacyWebStorageScript() {
  final exact = [for (final r in migrationExportRules) if (!r.prefix) r.key];
  final prefixes = [for (final r in migrationExportRules) if (r.prefix) r.key];
  final excluded = [for (final (s, f) in migrationExportExcludedSources) {'s': s, 'f': f}];
  final rules = jsonEncode({'exact': exact, 'prefixes': prefixes, 'excluded': excluded});
  return '(function(r){'
      'var ls=window.localStorage,out={},n=ls?ls.length:0,ex=r.excluded.map(function(x){return new RegExp(x.s,x.f);});'
      'for(var i=0;i<n;i++){var k=ls.key(i);if(k===null)continue;'
      'if(ex.some(function(p){return p.test(k);}))continue;'
      'if(r.exact.indexOf(k)<0&&!r.prefixes.some(function(p){return k.indexOf(p)===0;}))continue;'
      'var v=ls.getItem(k);if(v!==null)out[k]=v;}'
      'return JSON.stringify({length:n,entries:out});'
      '})($rules)';
}
