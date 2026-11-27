// Ported from: src/lib/marketSafety.ts
//
// Second-hand market safety (App Store 1.2): report a listing / user / conversation and block a user.
// Tables: public.market_reports and public.market_blocks (supabase/migrations/20261108120000_market_reports_and_height.sql).
// The server refuses messages between blocked users (MARKET_BLOCKED); the app additionally hides the blocked user's
// listings and messages for the blocker. Until the migration is applied every call here fails quietly (no blocks,
// report reported as unavailable).
import 'market_db.dart';

/// 'listing' | 'user' | 'conversation'
typedef MarketReportTarget = String;

/// 'spam' | 'scam' | 'inappropriate' | 'harassment' | 'prohibited' | 'other'
typedef MarketReportReason = String;

const List<MarketReportReason> marketReportReasons = ['spam', 'scam', 'inappropriate', 'harassment', 'prohibited', 'other'];
const int marketReportNoteMax = 500;

class MarketReportInput {
  const MarketReportInput({required this.target, this.listingId, this.reportedUserId, required this.reason, this.note});
  final MarketReportTarget target;
  final String? listingId;
  final String? reportedUserId;
  final MarketReportReason reason;
  final String? note;
}

String? _orNull(String? v) => v == null || v.isEmpty ? null : v;

/// Row for market_reports, or null when the input is incomplete. reporter_id is fixed by RLS + trigger.
Map<String, Object?>? buildMarketReport(String reporterId, MarketReportInput input) {
  if (reporterId.isEmpty || !marketReportReasons.contains(input.reason)) return null;
  final trimmed = (input.note ?? '').trim();
  final note = trimmed.length > marketReportNoteMax ? trimmed.substring(0, marketReportNoteMax) : trimmed;
  final listingId = _orNull(input.listingId);
  final reportedUserId = input.target == 'listing' ? null : _orNull(input.reportedUserId);
  if (input.target == 'listing' && listingId == null) return null;
  if (input.target == 'user' && reportedUserId == null) return null;
  if (input.target == 'conversation' && (listingId == null || reportedUserId == null)) return null;
  if (reportedUserId != null && reportedUserId == reporterId) return null;
  return {
    'reporter_id': reporterId,
    'target_type': input.target,
    'listing_id': listingId,
    'reported_user_id': reportedUserId,
    'reason': input.reason,
    'note': note.isEmpty ? null : note,
  };
}

/// The conversation is reportable only once there is at least one message; before that the user is reported.
MarketReportTarget reportTargetForContact(int messageCount) => messageCount > 0 ? 'conversation' : 'user';

/// 'sent' | 'duplicate' | 'unavailable' | 'failed'
typedef MarketReportOutcome = String;

Future<MarketReportOutcome> submitMarketReport(MarketDb client, String reporterId, MarketReportInput input) async {
  final row = buildMarketReport(reporterId, input);
  if (row == null) return 'failed';
  try {
    final error = (await client.insert('market_reports', row)).error;
    if (error == null) return 'sent';
    if (error.code == '23505') return 'duplicate';
    if (isMissingRelation(error)) return 'unavailable';
    return 'failed';
  } catch (_) {
    return 'failed';
  }
}

Future<Set<String>> loadMarketBlocks(MarketDb client, String? userId) async {
  if (userId == null || userId.isEmpty) return {};
  try {
    final r = await client.select(MarketQuery('market_blocks', columns: 'blocked_id', filters: [eqF('blocker_id', userId)]));
    final data = r.data;
    if (r.error != null || data is! List) return {};
    return {
      for (final row in data)
        if (row is Map && row['blocked_id'] is String && (row['blocked_id'] as String).isNotEmpty) row['blocked_id'] as String,
    };
  } catch (_) {
    return {};
  }
}

Future<bool> blockMarketUser(MarketDb client, String userId, String blockedId) async {
  if (userId.isEmpty || blockedId.isEmpty || userId == blockedId) return false;
  try {
    final error = (await client.insert('market_blocks', {'blocker_id': userId, 'blocked_id': blockedId})).error;
    return error == null || error.code == '23505';
  } catch (_) {
    return false;
  }
}

Future<bool> unblockMarketUser(MarketDb client, String userId, String blockedId) async {
  try {
    final error = (await client.delete('market_blocks', [eqF('blocker_id', userId), eqF('blocked_id', blockedId)])).error;
    return error == null;
  } catch (_) {
    return false;
  }
}

/// Listings of blocked users are hidden for the blocker (her own listings always stay).
List<T> visibleListings<T>(List<T> listings, Set<String> blocked, String? myId, String Function(T l) userIdOf) {
  if (blocked.isEmpty) return listings;
  return listings.where((l) => userIdOf(l) == myId || !blocked.contains(userIdOf(l))).toList();
}

/// Messages sent by a blocked user are hidden for the blocker.
List<T> visibleMessages<T>(List<T> messages, Set<String> blocked, String Function(T m) senderIdOf) {
  if (blocked.isEmpty) return messages;
  return messages.where((m) => !blocked.contains(senderIdOf(m))).toList();
}

/// The server refused the message because one side blocked the other.
bool isMarketBlockedError(MarketDbError? error) => error != null && RegExp('MARKET_BLOCKED').hasMatch(error.message ?? '');

bool isMissingRelation(MarketDbError? error) =>
    error != null && (error.code == '42P01' || error.code == 'PGRST205' || error.code == 'PGRST204' || error.code == '42703');
