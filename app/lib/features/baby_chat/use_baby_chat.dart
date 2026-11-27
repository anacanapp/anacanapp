// Ported from: src/hooks/useBabyChat.ts
//
// Today's "Körpəmdən mesajlar" state for the pregnant user: week facts, arrival time and thread.
//   const chat = useBabyChat()      → ref.watch(babyChatProvider)            ([BabyChatView])
//   chat.setThread(messages)        → ref.read(babyChatThreadsProvider.notifier).setThread(day, messages)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../state/persisted_store.dart' show localStoreProvider;
import '../../state/user_store.dart';
import '../home/data/pregnancy_content.dart';
import 'baby_chat.dart';

/// The 30 s clock of the hook (`setInterval(() => setNow(new Date()), 30_000)`); overridable in tests.
final babyChatClockProvider = NotifierProvider.autoDispose<BabyChatClock, DateTime>(BabyChatClock.new);

class BabyChatClock extends Notifier<DateTime> {
  @override
  DateTime build() {
    final timer = Timer.periodic(const Duration(seconds: 30), (_) => state = DateTime.now());
    ref.onDispose(timer.cancel);
    return DateTime.now();
  }
}

/// `user?.id || 'local'`.
final babyChatUserIdProvider = Provider<String>((ref) => ref.watch(authUserProvider)?.id ?? 'local');

/// The device threads of the current user (`loadThreads` / `saveThread`).
final babyChatThreadsProvider = NotifierProvider<BabyChatThreadsController, BabyChatThreads>(BabyChatThreadsController.new);

class BabyChatThreadsController extends Notifier<BabyChatThreads> {
  late String _userId;

  @override
  BabyChatThreads build() {
    _userId = ref.watch(babyChatUserIdProvider);
    return loadThreads(ref.read(localStoreProvider), _userId);
  }

  /// `setThread(messages)` for [day].
  void setThread(String day, List<BabyChatMessage> messages) {
    saveThread(ref.read(localStoreProvider), _userId, day, messages);
    state = {...state, day: messages};
  }
}

class BabyChatView {
  const BabyChatView({
    required this.text,
    required this.userId,
    required this.language,
    required this.facts,
    required this.pregnancyDay,
    required this.arrival,
    required this.arrived,
    required this.dailyMessage,
    required this.today,
    required this.thread,
    required this.pendingDaily,
    required this.previousThread,
  });

  final BabyChatText text;
  final String userId;
  final String language;
  final BabyWeekFacts facts;
  final int pregnancyDay;
  final DateTime arrival;
  final bool arrived;
  final String? dailyMessage;
  final String today;
  final List<BabyChatMessage> thread;
  final List<BabyChatMessage> pendingDaily;
  final List<BabyChatMessage> previousThread;

  bool get unread => pendingDaily.isNotEmpty;
}

/// `useBabyChat()`.
final babyChatProvider = Provider.autoDispose<BabyChatView>((ref) {
  final user = ref.watch(userStoreProvider);
  final language = user.language.isEmpty ? 'az' : user.language;
  final userId = ref.watch(babyChatUserIdProvider);
  final text = loadBabyChatText(language);
  final preg = user.getPregnancyData();
  final nav = PregnancyDayNavigation.of(preg?.lastPeriodDate);
  final day = nav.selectedDay;
  final week = nav.selectedWeek;
  final dayContent = ref.watch(pregnancyContentByDayQuery(day > 0 ? day : null)).data;
  final fruitImages = ref.watch(fruitImagesQuery).data ?? const [];
  final size = week > 0 ? getDynamicFruitData(fruitImages, day, week, dayContent) : null;

  final fruit = size?.fruit;
  final facts = BabyWeekFacts(
    week: week,
    // Mid-sentence the fruit is a common noun (German keeps its capital).
    fruit: fruit != null && fruit.isNotEmpty ? (language == 'de' ? fruit : localeLower(fruit, language)) : null,
    cm: size != null && size.lengthCm != 0 ? size.lengthCm : null,
    weeksLeft: (nav.daysUntilDueFromSelected / 7).ceil().clamp(0, 1 << 30),
  );

  final now = ref.watch(babyChatClockProvider);
  final today = dayKey(now);
  final arrival = dailyArrival(now, userId);
  final arrived = !now.isBefore(arrival);
  // Short, sweet lines of our own (the long day content stays on its own cards).
  final dailyMessage = week > 0 ? babyDailyLine(text, facts, day, userId) : null;

  final threads = ref.watch(babyChatThreadsProvider);
  final thread = threads[today] ?? const <BabyChatMessage>[];
  final delivered = thread.any((m) => m.id == '$today-daily');
  final pendingDaily = dailyMessage != null && arrived && !delivered ? dailyBabyMessages(text, dailyMessage, now, userId) : const <BabyChatMessage>[];
  final previous = (threads.keys.where((k) => k.compareTo(today) < 0).toList()..sort());

  return BabyChatView(
    text: text,
    userId: userId,
    language: language,
    facts: facts,
    pregnancyDay: day,
    arrival: arrival,
    arrived: arrived,
    dailyMessage: dailyMessage,
    today: today,
    thread: thread,
    pendingDaily: pendingDaily,
    previousThread: previous.isEmpty ? const [] : threads[previous.last]!,
  );
});
