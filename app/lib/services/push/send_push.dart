// Ported from: src/lib/push.ts (PushEventData contracts, EXPECTED_PUSH_SKIPS, serverErrorDetails, pushContractError,
//              invokeSendPush)
//
// Every client-triggered push goes through `send-push-notification` with an interaction-bound contract; anything the
// server would reject is blocked here and reported. Actionable failures land in `crash_reports`
// (`reportPushFailure`); expected recipient-side outcomes are not reported. The Edge Function call is
// [PushFunctionTransport] (default: the admitted Supabase client through [Db.invoke]).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException, FunctionsFetchException;

import '../../app/crash_reporter.dart' show CrashReporting;
import '../../core/data/db.dart';
import '../../core/i18n/tr.dart';
import '../../features/chat/data/chat_push.dart' show ChatPushSender, SendPushPayload, SendPushResult;

/// Recipient-side outcomes that are not failures (same list as `EXPECTED_SKIPS` in
/// supabase/functions/_shared/interaction-push.ts and the crash_reports insert filter).
const List<String> expectedPushSkips = [
  'no_device_tokens',
  'preferences_disabled',
  'duplicate',
  'not_member',
  'device_tokens_rejected',
  'interaction_gone',
];

/// The error of a non-2xx (or unsent) Edge Function call: supabase-js `error` with its `context` response.
class PushInvokeError {
  const PushInvokeError({required this.message, this.status, this.headers, this.body, this.cause});

  /// `error.message` ('Edge Function returned a non-2xx status code', …).
  final String message;

  /// `context.status` when a response arrived.
  final int? status;

  /// `context.headers` (lower-case names), null when unreadable.
  final Map<String, String>? headers;

  /// `await context.json()` (null when not JSON).
  final Object? body;
  final Object? cause;

  @override
  String toString() => message;
}

/// `{ data, error }` of `supabase.functions.invoke`.
class PushInvokeResponse {
  const PushInvokeResponse({this.data, this.error});
  final Object? data;
  final PushInvokeError? error;
}

abstract interface class PushFunctionTransport {
  /// `supabase.functions.invoke(name, { body })`. May throw (network stack); a non-2xx answer is an [error].
  Future<PushInvokeResponse> invoke(String name, Map<String, Object?> body);
}

/// supabase-js error messages for the two FunctionException kinds.
const String functionsHttpErrorMessage = 'Edge Function returned a non-2xx status code';
const String functionsFetchErrorMessage = 'Failed to send a request to the Edge Function';

class DbPushFunctionTransport implements PushFunctionTransport {
  DbPushFunctionTransport(this.db);
  final Db db;

  @override
  Future<PushInvokeResponse> invoke(String name, Map<String, Object?> body) async {
    final result = await db.invoke(name, body: body);
    final error = result.error;
    if (error == null) return PushInvokeResponse(data: result.data);
    if (error is FunctionsFetchException) {
      return PushInvokeResponse(error: PushInvokeError(message: functionsFetchErrorMessage, cause: error));
    }
    if (error is FunctionException) {
      // supabase_flutter does not expose the response headers: the runtime header stays unknown.
      return PushInvokeResponse(
          error: PushInvokeError(message: functionsHttpErrorMessage, status: error.status, body: error.details, cause: error));
    }
    return PushInvokeResponse(error: PushInvokeError(message: '$error', cause: error));
  }
}

/// `reportPushFailure(kind, reason, extra)`.
typedef PushFailureReporter = void Function(String kind, String reason, [Map<String, Object?>? extra]);

void _defaultReport(String kind, String reason, [Map<String, Object?>? extra]) => CrashReporting.reportPushFailure(kind, reason, extra);

/// `SendPushResult` of push.ts.
@immutable
class SendPushOutcome {
  const SendPushOutcome({required this.ok, required this.sent, this.skipped, this.skippedCounts, this.serverError, this.data, this.error});
  final bool ok;
  final int sent;
  final String? skipped;

  /// group_message_fanout: per-reason recipient counts from the server.
  final Map<String, Object?>? skippedCounts;

  /// Error code from a non-2xx response body (e.g. 'unsupported_context_or_type'), when readable.
  final String? serverError;
  final Object? data;
  final Object? error;

  @override
  String toString() => 'SendPushOutcome(ok: $ok, sent: $sent, skipped: $skipped, skippedCounts: $skippedCounts, '
      'serverError: $serverError, error: $error)';
}

/// An invalid push contract (`new Error('Invalid push contract: …')`).
class PushContractError implements Exception {
  const PushContractError(this.reason);
  final String reason;
  String get message => 'Invalid push contract: $reason';
  @override
  String toString() => message;
}

final RegExp _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);

class _Contract {
  const _Contract(this.context, this.required, {this.optional = const [], this.interactionAlias});
  final String context;
  final List<String> required;
  final List<String> optional;
  final String? interactionAlias;
}

const Map<String, _Contract> _contracts = {
  'diagnostic': _Contract('self', []),
  'direct_message': _Contract('direct_message', ['sender_id', 'messageId'], interactionAlias: 'messageId'),
  'group_message': _Contract('group_message', ['groupId', 'messageId'], interactionAlias: 'messageId'),
  'group_message_fanout': _Contract('group_message_fanout', ['groupId', 'messageId'], interactionAlias: 'messageId'),
  'community_like': _Contract('community_post', ['postId'], optional: ['groupId']),
  'community_comment': _Contract('community_post', ['postId']),
  'story_like': _Contract('community_story', ['storyId']),
  'story_reply': _Contract('community_story', ['storyId']),
  'comment_like': _Contract('post_comment', ['commentId', 'postId']),
  'community_reply': _Contract('post_comment', ['commentId', 'postId']),
  'partner_message': _Contract('partner', ['messageId'], interactionAlias: 'messageId'),
  'thank_you': _Contract('partner', ['messageId'], interactionAlias: 'messageId'),
  'contraction_511': _Contract('partner', []),
  'shopping_list': _Contract('partner', []),
  'sos_alert': _Contract('partner', ['alertId'], interactionAlias: 'alertId'),
  'birth_alert': _Contract('partner', ['alertId'], interactionAlias: 'alertId'),
};

bool _truthy(Object? v) => v != null && v != false && v != '' && v != 0 && !(v is double && v.isNaN);

/// `pushContractError(payload)`: null when the server would accept the event.
String? pushContractError({required String userId, required Object? title, required Object? body, required Object? data, String? kind}) {
  if (!_uuid.hasMatch(userId)) return 'invalid target user id';
  if (title is! String || body is! String || title.trim().isEmpty || body.trim().isEmpty) return 'empty title or body';
  if (data is! Map) return 'missing event data';

  final type = data['type'];
  if (type is! String || !_contracts.containsKey(type)) return 'unsupported event type';
  if (kind != null && kind.isNotEmpty && kind != type) return 'kind does not match event type';

  final contract = _contracts[type]!;
  if (data['context'] != contract.context) return 'unsupported event context';

  final allowed = {'type', 'context', ...contract.required, ...contract.optional};
  if (type != 'diagnostic') allowed.add('interactionId');
  if (data.keys.any((key) => !allowed.contains(key))) return 'unsupported event data field';

  if (type == 'diagnostic') return null;
  final interactionId = data['interactionId'];
  if (interactionId is! String || !_uuid.hasMatch(interactionId)) return 'missing or invalid interaction id';

  for (final field in contract.required) {
    final value = data[field];
    if (value is! String || !_uuid.hasMatch(value)) return 'missing or invalid $field';
  }
  for (final field in contract.optional) {
    if (!data.containsKey(field)) continue;
    final value = data[field];
    if (field == 'groupId' && value == null) continue;
    if (value is! String || !_uuid.hasMatch(value)) return 'invalid $field';
  }
  if (contract.interactionAlias != null && data[contract.interactionAlias] != interactionId) {
    return '${contract.interactionAlias} does not match interaction id';
  }
  return null;
}

/// Error code, HTTP status and whether the push function itself answered (vs. the gateway/router).
Map<String, Object?> _serverErrorDetails(PushInvokeError error) {
  final details = <String, Object?>{};
  final status = error.status;
  if (status != null) details['status'] = status;
  final headers = error.headers;
  if (headers != null) {
    // Only send-push-notification sets this header; 'none' on a 403/429 points at the gateway/router.
    String? runtime;
    for (final e in headers.entries) {
      if (e.key.toLowerCase() == 'x-anacan-push-runtime') runtime = e.value;
    }
    details['runtime'] = runtime != null && runtime.isNotEmpty && runtime.length <= 40 ? runtime : 'none';
  }
  final body = error.body;
  final code = body is Map ? body['error'] : null;
  if (code is String && code.length <= 100) details['code'] = code;
  return details;
}

/// `invokeSendPush(payload)`: invokes send-push-notification and reports actionable failures. Never throws.
Future<SendPushOutcome> invokeSendPush({
  required PushFunctionTransport transport,
  required String userId,
  required String title,
  required String body,
  required Object? data,
  String? kind,
  PushFailureReporter report = _defaultReport,
}) async {
  final dataType = data is Map ? data['type'] : null;
  final k = kind != null && kind.isNotEmpty ? kind : (_truthy(dataType) ? '$dataType' : 'push');
  void rep(String reason, [Map<String, Object?>? extra]) {
    try {
      report(k, reason, extra);
    } catch (_) {}
  }

  final contractError = pushContractError(userId: userId, title: title, body: body, data: data, kind: kind);
  if (contractError != null) {
    debugPrint('[Push] contract error: $contractError');
    rep('contract error: $contractError');
    return SendPushOutcome(ok: false, sent: 0, error: PushContractError(contractError));
  }

  try {
    final response = await transport.invoke('send-push-notification', {'userId': userId, 'title': title, 'body': body, 'data': data});
    final error = response.error;
    if (error != null) {
      final details = _serverErrorDetails(error);
      final serverError = details['code'] as String?;
      // An older server without the fan-out contract answers 400 unsupported_context_or_type; the caller falls
      // back to per-member pushes, so that is not a failure to report.
      if (k == 'group_message_fanout' && serverError == 'unsupported_context_or_type') {
        return SendPushOutcome(ok: false, sent: 0, error: error, serverError: serverError);
      }
      debugPrint('[Push] invoke error: $error');
      rep('invoke error: ${error.message.isEmpty ? '$error' : error.message}', {
        'error': ?serverError,
        if (details['status'] != null && details['status'] != 0) 'status': details['status'],
        if (details['runtime'] != null) 'runtime': details['runtime'],
      });
      return SendPushOutcome(ok: false, sent: 0, error: error, serverError: serverError);
    }

    final result = response.data;
    final map = result is Map ? result : null;
    final sentRaw = map?['sent'];
    final sent = sentRaw is num ? sentRaw.toInt() : 0;
    final skippedRaw = map?['skipped'];
    if (skippedRaw is Map) {
      // Fan-out summary: { ok, sent, skipped: { reason: count } }. Zero sent is normal when no member has a device
      // or notifications on; only a server-flagged problem is reported.
      final counts = skippedRaw.map((key, value) => MapEntry('$key', value as Object?));
      final ok = map!['ok'] != false;
      if (!ok) {
        debugPrint('[Push] fan-out incomplete: $result');
        rep('fanout incomplete', {'response': result});
      }
      return SendPushOutcome(ok: ok, sent: sent, skippedCounts: counts, data: result);
    }

    if (sent == 0) {
      final Object? reason = _truthy(skippedRaw)
          ? skippedRaw
          : _truthy(map?['message'])
              ? map!['message']
              : _truthy(map?['error'])
                  ? '${map!['error']}'
                  : tr('push_push_gonderilmedi_sent_0_7d1a2a', 'Push göndərilmədi (sent: 0)');
      final text = '$reason';
      debugPrint('[Push] not delivered: $text');
      // Expected outcomes (no device, notifications off, already sent) are not failures.
      if (!expectedPushSkips.contains(text)) rep(text, {'response': result});
      return SendPushOutcome(ok: false, sent: 0, skipped: text, data: result);
    }

    return SendPushOutcome(ok: true, sent: sent, data: result);
  } catch (err) {
    debugPrint('[Push] exception: $err');
    rep('exception: ${_messageOf(err)}');
    return SendPushOutcome(ok: false, sent: 0, error: err);
  }
}

String _messageOf(Object err) {
  try {
    final dynamic d = err;
    final m = d.message;
    if (m is String && m.isNotEmpty) return m;
  } catch (_) {}
  return '$err';
}

final pushFunctionTransportProvider = Provider<PushFunctionTransport>((ref) => DbPushFunctionTransport(ref.watch(dbProvider)));

final pushFailureReporterProvider = Provider<PushFailureReporter>((ref) => _defaultReport);

/// The app-wide push sender with the contract guard and failure reports (override for `chatPushSenderProvider`).
class ContractPushSender implements ChatPushSender {
  ContractPushSender(this.transport, {this.report = _defaultReport});
  final PushFunctionTransport transport;
  final PushFailureReporter report;

  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    final r = await invokeSendPush(
        transport: transport, userId: payload.userId, title: payload.title, body: payload.body, data: payload.data, kind: payload.kind, report: report);
    return SendPushResult(ok: r.ok, sent: r.sent, serverError: r.serverError, error: r.error, skippedCounts: r.skippedCounts);
  }
}

final contractPushSenderProvider = Provider<ContractPushSender>(
    (ref) => ContractPushSender(ref.watch(pushFunctionTransportProvider), report: ref.watch(pushFailureReporterProvider)));
