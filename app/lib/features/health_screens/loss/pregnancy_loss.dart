// Ported from: src/data/pregnancy-loss/index.ts (LOSS_RECOVERY_WEEKS, lossDays, lossWeek, lossPhase,
//              usePregnancyLossText, emergencyNumber), src/lib/pregnancy-loss.ts (isoDay, beginPregnancyLoss,
//              endPregnancyLossRecovery, the private letter and the weekly checklist kept on this device)
//
// Pregnancy loss: the server switches the mother's own 'bump' profile to 'flow' without cycle dates and turns the
// recovery mode on (Duzelis72, pregnancy_loss_begin_v1). Nothing is deleted.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../domain/js_compat.dart';
import '../../../state/local_store.dart';
import '../../baby_chat/baby_chat_notifications.dart' show babyChatNotificationPlannerProvider, cancelBabyChatNotifications;
import '../../partner/partner_ports.dart' show partnerChatSenderProvider;
import '../common/feature_text.dart';
import '../common/health_ports.dart';
import 'pregnancy_loss_text.g.dart';

const int lossRecoveryWeeks = 8;

/// `usePregnancyLossText(language)`: the language's file, else en, else az.
FeatureText pregnancyLossText(String language) => FeatureText.of(kPregnancyLossText, language);

final pregnancyLossTextProvider = Provider<FeatureText>((ref) => pregnancyLossText(ref.watch(appLanguageProvider)));

DateTime _localDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime _parseDay(String value) {
  final parts = value.substring(0, value.length >= 10 ? 10 : value.length).split('-').map((p) => int.tryParse(p) ?? 0).toList();
  final y = parts.isNotEmpty ? parts[0] : 0;
  final m = parts.length > 1 && parts[1] != 0 ? parts[1] : 1;
  final d = parts.length > 2 && parts[2] != 0 ? parts[2] : 1;
  return DateTime(y, m, d);
}

/// Days since the loss date (0 on the day itself), or null without a valid date.
int? lossDays(String? lossDate, [DateTime? now]) {
  if (lossDate == null || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(lossDate)) return null;
  final n = _localDay(now ?? DomainClock.now());
  final days = jsRoundInt((n.millisecondsSinceEpoch - _localDay(_parseDay(lossDate)).millisecondsSinceEpoch) / 86400000);
  return days < 0 ? 0 : days;
}

/// Recovery week 1..8, or null once the eight weeks are over (or without a date).
int? lossWeek(String? lossDate, [DateTime? now]) {
  final days = lossDays(lossDate, now);
  if (days == null || days >= lossRecoveryWeeks * 7) return null;
  return days ~/ 7 + 1;
}

/// The partner guide groups the eight weeks into four phases of two weeks.
int lossPhase(int week) {
  final p = ((week - 1) / 2).floor();
  return p < 0 ? 0 : (p > 3 ? 3 : p);
}

/// The local emergency number is part of the translated text (112, 119, 120, ...).
String lossEmergencyNumber(FeatureText text) => RegExp(r'\b\d{3}\b').firstMatch(text.sub('ui').s('signs_urgent'))?[0] ?? '112';

/// Local calendar date as yyyy-mm-dd (no UTC shift).
String isoDay(DateTime date) => '${date.year}-${pad2(date.month)}-${pad2(date.day)}';

/// The server calls of the loss flow.
class PregnancyLossActions {
  PregnancyLossActions(this._ref);
  final Ref _ref;

  /// `beginPregnancyLoss(...)`: the RPC, then the baby's daily notifications are cancelled; the partner gets the
  /// message only when shared and linked (failures there are ignored: he still sees the guide on his home).
  Future<void> begin({
    required String date,
    required bool sharePartner,
    required String userId,
    required String? linkedPartnerProfileId,
    required String partnerMessage,
  }) async {
    final backend = _ref.read(healthScreensBackendProvider);
    await backend.rpc('pregnancy_loss_begin_v1', {'p_date': date, 'p_share_partner': sharePartner});
    try {
      await cancelBabyChatNotifications(_ref.read(babyChatNotificationPlannerProvider));
    } catch (_) {}
    if (sharePartner && linkedPartnerProfileId != null && linkedPartnerProfileId.isNotEmpty) {
      try {
        final partnerUserId = await backend.profileUserId(linkedPartnerProfileId);
        if (partnerUserId != null && partnerUserId.isNotEmpty) await _ref.read(partnerChatSenderProvider)(userId, partnerUserId, partnerMessage);
      } catch (_) {
        // the partner still sees the guide on their home screen
      }
    }
  }

  /// Ends the recovery mode. [trackCycle] starts the cycle from the loss date when no period date is known.
  Future<void> end(bool trackCycle) async {
    await _ref.read(healthScreensBackendProvider).rpc('pregnancy_loss_end_v1', {'p_track_cycle': trackCycle});
  }
}

final pregnancyLossActionsProvider = Provider<PregnancyLossActions>(PregnancyLossActions.new);

// ── A private letter, kept only on this device ───────────────────────────────

String _letterKey(String userId) => 'anacan_loss_letter_v1:$userId';

String loadLossLetter(LocalStore store, String userId) {
  try {
    return store.getItem(_letterKey(userId)) ?? '';
  } catch (_) {
    return '';
  }
}

bool saveLossLetter(LocalStore store, String userId, String text) {
  try {
    if (text.trim().isNotEmpty) {
      store.setItem(_letterKey(userId), text.length > 5000 ? text.substring(0, 5000) : text);
    } else {
      store.removeItem(_letterKey(userId));
    }
    return true;
  } catch (_) {
    return false;
  }
}

// ── The weekly self-care checklist, per user and week, on this device ────────

String _todoKey(String userId) => 'anacan_loss_todo_v1:$userId';

Map<String, bool> loadLossTodos(LocalStore store, String userId) {
  try {
    final parsed = jsonDecode(store.getItem(_todoKey(userId)) ?? '{}');
    return parsed is Map ? {for (final e in parsed.entries) '${e.key}': e.value == true} : {};
  } catch (_) {
    return {};
  }
}

void saveLossTodos(LocalStore store, String userId, Map<String, bool> todos) {
  try {
    store.setItem(_todoKey(userId), jsonEncode(todos));
  } catch (_) {
    // storage blocked
  }
}
