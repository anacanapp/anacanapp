// Ported from: src/lib/push.ts (invokeSendPush: SendPushPayload / SendPushResult and the
//              `functions.invoke('send-push-notification')` call)
//
// The chat feature's push seam. The default sends through the Edge Function like invokeSendPush; the push service
// port (`svc.push`) should override [chatPushSenderProvider] with its full invokeSendPush (contract check, crash
// reports of failures).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import '../../../core/data/data.dart';

class SendPushPayload {
  const SendPushPayload({required this.userId, required this.title, required this.body, required this.data, this.kind});
  final String userId;
  final String title;
  final String body;
  final String? kind;
  final Map<String, Object?> data;

  Map<String, Object?> toJson() => {'userId': userId, 'title': title, 'body': body, 'kind': kind, 'data': data};

  @override
  bool operator ==(Object other) => other is SendPushPayload && '${other.toJson()}' == '${toJson()}';
  @override
  int get hashCode => '${toJson()}'.hashCode;
  @override
  String toString() => 'SendPushPayload(${toJson()})';
}

class SendPushResult {
  const SendPushResult({required this.ok, this.sent = 0, this.serverError, this.error, this.skippedCounts});
  final bool ok;
  final int sent;
  final String? serverError;
  final Object? error;
  final Map<String, Object?>? skippedCounts;
}

abstract interface class ChatPushSender {
  /// `invokeSendPush(payload)`; never throws.
  Future<SendPushResult> send(SendPushPayload payload);
}

class FunctionsChatPushSender implements ChatPushSender {
  FunctionsChatPushSender(this.db);
  final Db db;

  @override
  Future<SendPushResult> send(SendPushPayload payload) async {
    try {
      final result = await db.invoke('send-push-notification',
          body: {'userId': payload.userId, 'title': payload.title, 'body': payload.body, 'data': payload.data});
      final error = result.error;
      if (error != null) {
        String? serverError;
        if (error is FunctionException) {
          final details = error.details;
          final code = details is Map ? details['error'] : null;
          if (code is String && code.length <= 100) serverError = code;
        }
        return SendPushResult(ok: false, error: error, serverError: serverError);
      }
      final data = result.data;
      final sent = data is Map && data['sent'] is num ? (data['sent'] as num).toInt() : 0;
      if (data is Map && data['skipped'] is Map) {
        return SendPushResult(ok: data['ok'] != false, sent: sent, skippedCounts: Map<String, Object?>.from(data['skipped'] as Map));
      }
      return SendPushResult(ok: sent > 0, sent: sent);
    } catch (error) {
      return SendPushResult(ok: false, error: error);
    }
  }
}

final chatPushSenderProvider = Provider<ChatPushSender>((ref) => FunctionsChatPushSender(ref.watch(dbProvider)));
