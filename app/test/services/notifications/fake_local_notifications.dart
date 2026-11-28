// In-memory stand-in for the OS (the vitest `os` stub of src/lib/local-notification-scheduler.test.ts): pending
// notifications keyed by id (scheduling an existing id replaces it, as on iOS and Android).
import 'package:anacan/services/notifications/local_notification_backend.dart';

class FakeLocalNotificationBackend implements LocalNotificationBackend {
  bool native = true;
  String display = 'granted';
  final Map<int, NativeLocalNotification> pending = {};
  final List<List<NativeLocalNotification>> scheduleCalls = [];
  final List<List<int>> cancelCalls = [];
  int requestCalls = 0;
  int removeDeliveredCalls = 0;
  int checkCalls = 0;
  Object? pendingError;

  List<int> get scheduledIds => [for (final c in scheduleCalls) for (final n in c) n.id];
  List<int> get cancelledIds => [for (final c in cancelCalls) ...c];
  List<int> get pendingKeys => pending.keys.toList();

  void clearCalls() {
    scheduleCalls.clear();
    cancelCalls.clear();
    requestCalls = 0;
    removeDeliveredCalls = 0;
    checkCalls = 0;
  }

  @override
  bool get isAvailable => native;

  @override
  Future<String> checkDisplay() async {
    checkCalls++;
    return display;
  }

  @override
  Future<String> requestDisplay() async {
    requestCalls++;
    display = 'granted';
    return 'granted';
  }

  @override
  Future<List<int>> pendingIds() async {
    if (pendingError != null) throw pendingError!;
    return pending.keys.toList();
  }

  @override
  Future<void> schedule(List<NativeLocalNotification> notifications) async {
    scheduleCalls.add(notifications);
    for (final n in notifications) {
      pending[n.id] = n;
    }
  }

  @override
  Future<void> cancel(List<int> ids) async {
    cancelCalls.add(ids);
    for (final id in ids) {
      pending.remove(id);
    }
  }

  @override
  Future<void> removeAllDelivered() async => removeDeliveredCalls++;
}

/// A pending notification placed by an older app version (not known to the scheduler).
NativeLocalNotification legacyNotification(int id, String title) => NativeLocalNotification(id: id, title: title, body: 'b');
