// Ported from: src/lib/baby-chat-ai.ts
//
// Optional AI reply for "Körpəmdən mesajlar" (server function baby-chat-reply, off by default).
// Returns null whenever the AI is off, limited, filtered, slow or unreachable — the caller then
// uses a curated line, so the mother never sees an error.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/db.dart';
import 'baby_chat.dart';

class BabyAiResult {
  const BabyAiResult({this.reply, this.care = false});
  final String? reply;
  final bool care;
}

/// `supabase.functions.invoke(name, { body })` as `{data, error}`.
typedef BabyChatInvoke = Future<DbResult<Object?>> Function(String name, Map<String, Object?> body);

Future<BabyAiResult> askBabyAi(BabyChatInvoke invoke, String message, BabyWeekFacts facts, String language,
    {Duration timeout = const Duration(milliseconds: 5000)}) {
  final call = () async {
    try {
      final res = await invoke('baby-chat-reply', {
        'message': message,
        'language': language,
        'week': facts.week,
        'fruit': facts.fruit,
        'cm': facts.cm,
        'weeksLeft': facts.weeksLeft,
      });
      final data = res.data;
      if (res.error != null || data is! Map) return const BabyAiResult();
      final raw = data['reply'];
      final reply = raw is String && raw.trim().isNotEmpty && raw.length <= 160 ? raw.trim() : null;
      return BabyAiResult(reply: reply, care: data['care'] == true);
    } catch (_) {
      return const BabyAiResult();
    }
  }();
  final done = Completer<BabyAiResult>();
  final timer = Timer(timeout, () {
    if (!done.isCompleted) done.complete(const BabyAiResult());
  });
  unawaited(call.then((r) {
    timer.cancel();
    if (!done.isCompleted) done.complete(r);
  }));
  return done.future;
}

/// The invoke used by the screen (the admitted SDK client).
final babyChatInvokeProvider = Provider<BabyChatInvoke>((ref) {
  return (name, body) => ref.read(dbProvider).invoke(name, body: body);
});
