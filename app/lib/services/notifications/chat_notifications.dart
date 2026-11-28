// Ported from: src/lib/chat-notifications.ts (isInSilentHours, notifyIncomingChatMessage)
//
// Best-effort phone notification for an incoming partner chat message while the app runs but is not in front (the
// realtime channel delivers it). Not a remote push. Respects the user's silent hours (LocalStore copy
// `silent_hours_<userId>` written by the settings screen) and never asks for permission.
import 'dart:convert';

import 'package:flutter/widgets.dart';

import '../../state/local_store.dart';
import 'local_notification_scheduler.dart';

/// Chat notification ids live in their own range, so they never replace a scheduled reminder.
const int chatNotificationIdBase = 1100000000;
const int chatNotificationIdSpan = 100000000;

double _num(String s) => double.tryParse(s.trim().isEmpty ? '0' : s.trim()) ?? double.nan;

/// `isInSilentHours(userId)`: overnight ranges (22:00–08:00) wrap.
bool isInChatSilentHours(LocalStore store, String? userId, DateTime now) {
  if (userId == null || userId.isEmpty) return false;
  try {
    final stored = store.getItem('silent_hours_$userId');
    if (stored == null || stored.isEmpty) return false;
    final settings = jsonDecode(stored);
    if (settings is! Map) return false;
    final enabled = settings['enabled'];
    if (enabled == null || enabled == false || enabled == 0 || enabled == '') return false;

    String time(Object? v, String fallback) => v is String && v.isNotEmpty ? v : fallback;
    List<double> parts(String t) {
      final p = t.split(':').map(_num).toList();
      return [p[0], p.length > 1 ? p[1] : double.nan];
    }

    final start = parts(time(settings['startTime'], '22:00'));
    final end = parts(time(settings['endTime'], '08:00'));
    final current = now.hour * 60 + now.minute;
    final startMinutes = start[0] * 60 + start[1];
    final endMinutes = end[0] * 60 + end[1];
    if (startMinutes > endMinutes) return current >= startMinutes || current < endMinutes;
    return current >= startMinutes && current < endMinutes;
  } catch (_) {
    return false;
  }
}

/// `CHAT_ID_BASE + Math.abs(Math.floor(idSeed % CHAT_ID_SPAN))`.
int chatNotificationId(int idSeed) => chatNotificationIdBase + idSeed.remainder(chatNotificationIdSpan).abs();

/// `document.visibilityState === 'visible'`: the app is in front.
bool appIsVisible() {
  try {
    return WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
  } catch (_) {
    return false; // no binding yet
  }
}

class ChatNotifications {
  ChatNotifications({required this.store, required this.scheduler, bool Function()? isVisible, DateTime Function()? clock})
      : _isVisible = isVisible ?? appIsVisible,
        _clock = clock ?? DateTime.now;

  final LocalStore store;
  final LocalNotificationScheduler scheduler;
  final bool Function() _isVisible;
  final DateTime Function() _clock;

  /// `notifyIncomingChatMessage({ title, body, idSeed, userId })`.
  Future<void> notifyIncomingChatMessage({required String title, required String body, int? idSeed, String? userId}) async {
    final now = _clock();
    if (isInChatSilentHours(store, userId, now)) {
      debugPrint('Skipping notification - silent hours active');
      return;
    }
    // No system notification while the user is looking at the app.
    if (_isVisible()) return;
    // Web fallback (browser Notification API) has no counterpart; the scheduler is a no-op without the plugin.
    if (!scheduler.backend.isAvailable) return;
    final id = chatNotificationId(idSeed ?? now.millisecondsSinceEpoch);
    await scheduler.notifyNow(id: id, title: title, body: body);
  }
}
