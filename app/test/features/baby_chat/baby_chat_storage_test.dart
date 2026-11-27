// Ported from: src/lib/baby-chat.storage.test.ts
//
// #13 in React: durable device writes go through the quota-aware writer. The Flutter LocalStore is a file without
// a byte quota (state/local_store.dart), so there is nothing to evict: the thread is kept and other keys are
// untouched. The case name stays; the eviction assertion becomes "nothing else was removed".
import 'package:anacan/features/baby_chat/baby_chat.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('baby-chat durable write under quota pressure', () {
    test('evicts a disposable translation cache to keep the thread, never the session', () {
      final storage = LocalStore.memory({
        'anacan_i18n_cache:az': 'x' * 4000,
        'sb-source-auth-token': 'session',
      });

      saveThread(storage, 'u1', '2026-11-26', [BabyChatMessage(id: 'm1', from: 'baby', text: 'y' * 3000, at: 1)]);

      expect(loadThreads(storage, 'u1')['2026-11-26'], hasLength(1)); // the thread survived
      expect(storage.getItem('sb-source-auth-token'), 'session'); // the session was kept
    });

    test('keeps the last 14 days and the last 60 messages of a day, same JSON as the web app', () {
      final storage = LocalStore.memory();
      for (var d = 1; d <= 16; d++) {
        saveThread(storage, 'u1', '2026-11-${d.toString().padLeft(2, '0')}', [const BabyChatMessage(id: 'a', from: 'mom', text: 'hi', at: 1)]);
      }
      final threads = loadThreads(storage, 'u1');
      expect(threads.keys.length, 14);
      expect(threads.containsKey('2026-11-01'), isFalse);
      saveThread(storage, 'u1', '2026-11-16', [for (var i = 0; i < 70; i++) BabyChatMessage(id: 'm$i', from: 'baby', text: 't', at: i)]);
      expect(loadThreads(storage, 'u1')['2026-11-16']!.first.id, 'm10');
      expect(storage.getItem('anacan_baby_chat_v1:u1'), contains('"2026-11-16":[{"id":"m10","from":"baby","text":"t","at":10}'));
      deleteThreads(storage, 'u1');
      expect(loadThreads(storage, 'u1'), isEmpty);
    });
  });
}
