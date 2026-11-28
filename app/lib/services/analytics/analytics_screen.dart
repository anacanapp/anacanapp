// Ported from: src/lib/analytics-screen.ts
//
// The screens actually mounted (not URLs or user content). Entries disappear on exit; the newest one is the
// current screen Customer.io reports after consent/identity arrives.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class AnalyticsScreen {
  const AnalyticsScreen({required this.id, required this.title, this.category});
  final int id;
  final String title;
  final String? category;

  @override
  String toString() => 'AnalyticsScreen($id, $title, $category)';
}

class AnalyticsScreenRegistry {
  int _sequence = 0;
  final Map<int, AnalyticsScreen> _screens = <int, AnalyticsScreen>{};

  /// `registerAnalyticsScreen(title, category)`; the returned callback removes the entry.
  VoidCallback register(String title, [String? category]) {
    final id = ++_sequence;
    _screens[id] = AnalyticsScreen(id: id, title: title, category: category);
    return () => _screens.remove(id);
  }

  /// `currentAnalyticsScreen()`.
  AnalyticsScreen? current() => _screens.isEmpty ? null : _screens.values.last;
}

/// Process-wide registry (module state of analytics-screen.ts).
final analyticsScreenRegistryProvider = Provider<AnalyticsScreenRegistry>((ref) => AnalyticsScreenRegistry());
