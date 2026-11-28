// Ported from: src/lib/push.test.ts
//
// `supabase.functions.invoke` becomes a fake [PushFunctionTransport]; `reportPushFailure` a recording reporter.
import 'dart:io';

import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/services/push/send_push.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeTransport implements PushFunctionTransport {
  PushInvokeResponse response = const PushInvokeResponse(data: {'sent': 1});
  Object? throwError;
  final List<List<Object?>> calls = [];

  @override
  Future<PushInvokeResponse> invoke(String name, Map<String, Object?> body) async {
    calls.add([name, body]);
    if (throwError != null) throw throwError!;
    return response;
  }
}

const targetId = '11111111-1111-4111-8111-111111111111';
const senderId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

void main() {
  late FakeTransport transport;
  late List<List<Object?>> reports;

  void report(String kind, String reason, [Map<String, Object?>? extra]) => reports.add([kind, reason, extra]);

  Future<SendPushOutcome> send({required String userId, String title = 'T', String body = 'B', required Object? data, String? kind}) =>
      invokeSendPush(transport: transport, userId: userId, title: title, body: body, data: data, kind: kind, report: report);

  setUp(() {
    transport = FakeTransport();
    reports = [];
  });

  group('invokeSendPush Azure contract guard', () {
    test('forwards only the server payload for an interaction-bound event', () async {
      final data = {'type': 'direct_message', 'context': 'direct_message', 'sender_id': senderId, 'messageId': messageId, 'interactionId': messageId};
      final r = await send(userId: targetId, title: 'Ignored client title', body: 'Ignored client body', data: data, kind: 'direct_message');
      expect(r.ok, isTrue);
      expect(r.sent, 1);
      expect(transport.calls, [
        ['send-push-notification', {'userId': targetId, 'title': 'Ignored client title', 'body': 'Ignored client body', 'data': data}],
      ]);
    });

    test('allows the interaction-free self diagnostic contract', () async {
      await send(userId: targetId, title: 'Diagnostic', body: 'Diagnostic body', data: {'type': 'diagnostic', 'context': 'self'});
      expect(transport.calls, hasLength(1));
    });

    final blocked = <(String, Map<String, Object?>)>[
      ('legacy contextless like', {'type': 'like'}),
      ('supported event without its row id', {'type': 'community_comment', 'context': 'community_post', 'postId': messageId}),
      (
        'message aliases for different rows',
        {
          'type': 'direct_message',
          'context': 'direct_message',
          'sender_id': senderId,
          'messageId': messageId,
          'interactionId': '44444444-4444-4444-8444-444444444444',
        }
      ),
      ('an unsupported data field', {'type': 'shopping_list', 'context': 'partner', 'interactionId': messageId, 'itemName': 'client copy'}),
    ];
    for (final (label, data) in blocked) {
      test('blocks $label before invoking Supabase', () async {
        final r = await send(userId: targetId, title: 'Title', body: 'Body', data: data);
        expect(r.ok, isFalse);
        expect(r.sent, 0);
        expect(r.error, isA<PushContractError>());
        expect(transport.calls, isEmpty);
      });
    }
  });

  group('invokeSendPush group fan-out contract', () {
    const groupId = '55555555-5555-4555-8555-555555555555';
    const fanoutData = {
      'type': 'group_message_fanout',
      'context': 'group_message_fanout',
      'groupId': groupId,
      'messageId': messageId,
      'interactionId': messageId,
    };
    PushInvokeResponse httpError(Object? body) => PushInvokeResponse(error: PushInvokeError(message: functionsHttpErrorMessage, body: body));

    test('forwards the fan-out payload addressed to the sender', () async {
      transport.response = const PushInvokeResponse(data: {'ok': true, 'sent': 3, 'skipped': {'no_device_tokens': 1}});
      final r = await send(userId: senderId, kind: 'group_message_fanout', data: fanoutData);
      expect([r.ok, r.sent, r.skippedCounts], [true, 3, {'no_device_tokens': 1}]);
      expect(transport.calls, [
        ['send-push-notification', {'userId': senderId, 'title': 'T', 'body': 'B', 'data': fanoutData}],
      ]);
      expect(reports, isEmpty);
    });

    test('does not report a fan-out that reached nobody for expected reasons', () async {
      transport.response = const PushInvokeResponse(data: {'ok': true, 'sent': 0, 'skipped': {'preferences_disabled': 2, 'not_member': 1}});
      final r = await send(userId: senderId, kind: 'group_message_fanout', data: fanoutData);
      expect((r.ok, r.sent), (true, 0));
      expect(reports, isEmpty);
    });

    test('reports a fan-out the server flags as incomplete', () async {
      transport.response = const PushInvokeResponse(data: {'ok': false, 'sent': 1, 'skipped': {'deadline': 4}});
      final r = await send(userId: senderId, kind: 'group_message_fanout', data: fanoutData);
      expect([r.ok, r.sent, r.skippedCounts], [false, 1, {'deadline': 4}]);
      expect(reports.single[0], 'group_message_fanout');
      expect(reports.single[1], 'fanout incomplete');
      expect(reports.single[2], isNotNull);
    });

    test('returns unsupported_context_or_type from an older server without reporting it', () async {
      transport.response = httpError({'error': 'unsupported_context_or_type'});
      final r = await send(userId: senderId, kind: 'group_message_fanout', data: fanoutData);
      expect((r.ok, r.sent, r.serverError), (false, 0, 'unsupported_context_or_type'));
      expect(reports, isEmpty);
    });

    test('still reports other invoke errors with the server code', () async {
      transport.response = httpError({'error': 'no_verified_interaction'});
      final r = await send(userId: senderId, kind: 'group_message_fanout', data: fanoutData);
      expect((r.ok, r.serverError), (false, 'no_verified_interaction'));
      expect(reports, [
        ['group_message_fanout', 'invoke error: Edge Function returned a non-2xx status code', {'error': 'no_verified_interaction'}],
      ]);
    });

    test('treats a not_member skip as an expected outcome', () async {
      transport.response = const PushInvokeResponse(data: {'success': true, 'sent': 0, 'skipped': 'not_member'});
      final r = await send(userId: targetId, kind: 'group_message', data: {
        'type': 'group_message',
        'context': 'group_message',
        'groupId': groupId,
        'messageId': messageId,
        'interactionId': messageId,
      });
      expect((r.ok, r.sent, r.skipped), (false, 0, 'not_member'));
      expect(reports, isEmpty);
    });

    test('blocks a fan-out whose messageId and interactionId differ', () async {
      final r = await send(userId: senderId, data: {...fanoutData, 'interactionId': '44444444-4444-4444-8444-444444444444'});
      expect(r.ok, isFalse);
      expect(r.error, isA<PushContractError>());
      expect(transport.calls, isEmpty);
    });
  });

  group('invokeSendPush expected outcomes and diagnostics', () {
    const postId = '66666666-6666-4666-8666-666666666666';
    const likeId = '77777777-7777-4777-8777-777777777777';
    const likeData = {'type': 'community_like', 'context': 'community_post', 'postId': postId, 'groupId': null, 'interactionId': likeId};
    Future<SendPushOutcome> like() => send(userId: targetId, kind: 'community_like', data: likeData);

    test('matches the server list of expected skips', () {
      final source = File('../supabase/functions/_shared/interaction-push.ts').readAsStringSync();
      final list = RegExp(r'export const EXPECTED_SKIPS = \[([^\]]*)\]').firstMatch(source)!.group(1)!;
      final server = RegExp(r"'([^']+)'").allMatches(list).map((m) => m.group(1)!).toList()..sort();
      expect([...expectedPushSkips]..sort(), server);
    });

    for (final skipped in ['no_device_tokens', 'preferences_disabled', 'duplicate', 'device_tokens_rejected', 'interaction_gone']) {
      test('does not report $skipped', () async {
        transport.response = PushInvokeResponse(data: {'success': true, 'sent': 0, 'skipped': skipped});
        final r = await like();
        expect((r.ok, r.sent, r.skipped), (false, 0, skipped));
        expect(reports, isEmpty);
      });
    }

    test('reports status and whether the push function answered a non-2xx', () async {
      transport.response = const PushInvokeResponse(
          error: PushInvokeError(message: functionsHttpErrorMessage, status: 403, headers: {}, body: {'error': 'forbidden'}));
      await like();
      expect(reports, [
        ['community_like', 'invoke error: Edge Function returned a non-2xx status code', {'error': 'forbidden', 'status': 403, 'runtime': 'none'}],
      ]);
    });

    test('names the function runtime when the push function itself answered', () async {
      transport.response = const PushInvokeResponse(
          error: PushInvokeError(
              message: functionsHttpErrorMessage, status: 502, headers: {'x-anacan-push-runtime': 'communications-v2'}, body: {'error': 'fcm_failed'}));
      await like();
      expect(reports, [
        ['community_like', 'invoke error: Edge Function returned a non-2xx status code', {'error': 'fcm_failed', 'status': 502, 'runtime': 'communications-v2'}],
      ]);
    });
  });

  group('Dart push sender', () {
    test('reports an unexpected zero-sent reason and a thrown transport error', () async {
      transport.response = const PushInvokeResponse(data: {'sent': 0, 'message': 'fcm not configured'});
      final r = await send(userId: targetId, kind: 'community_like', data: {
        'type': 'community_like',
        'context': 'community_post',
        'postId': '66666666-6666-4666-8666-666666666666',
        'interactionId': '77777777-7777-4777-8777-777777777777',
      });
      expect(r.skipped, 'fcm not configured');
      expect(reports.single[1], 'fcm not configured');
      transport.throwError = StateError('offline');
      final thrown = await send(userId: targetId, data: {'type': 'diagnostic', 'context': 'self'});
      expect(thrown.ok, isFalse);
      expect(reports.last[1], startsWith('exception: '));
    });

    test('the chat push seam adapter forwards through the contract guard', () async {
      final sender = ContractPushSender(transport, report: report);
      final r = await sender.send(const SendPushPayload(userId: targetId, title: 'T', body: 'B', data: {'type': 'like'}));
      expect(r.ok, isFalse);
      expect(transport.calls, isEmpty);
      final ok = await sender.send(const SendPushPayload(userId: targetId, title: 'T', body: 'B', data: {'type': 'diagnostic', 'context': 'self'}));
      expect((ok.ok, ok.sent), (true, 1));
    });
  });
}
