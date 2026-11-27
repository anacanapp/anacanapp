// Ported from: src/pages/Index.tsx (`lockOffer`, `lockSetup`, `autoFeedback` state feeding
//              `<OnboardingTourHost blocked={lockOffer || lockSetup || autoFeedback || …} />`)
//
// Which first-run sheets are on screen. Index kept them as its own state; here the features that show them
// (security: lock offer / lock setup, support: automatic feedback) mark them open, and the onboarding tour waits.
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ids used by the hosts.
abstract final class FirstRunSheet {
  static const lockOffer = 'lock-offer';
  static const lockSetup = 'lock-setup';
  static const autoFeedback = 'auto-feedback';
}

class FirstRunSheets extends Notifier<Set<String>> {
  @override
  Set<String> build() => const <String>{};

  void open(String id) {
    if (!state.contains(id)) state = {...state, id};
  }

  void close(String id) {
    if (state.contains(id)) state = {...state}..remove(id);
  }

  /// Marks [id] open while [show] runs.
  Future<T> during<T>(String id, Future<T> Function() show) async {
    open(id);
    try {
      return await show();
    } finally {
      if (ref.mounted) close(id);
    }
  }
}

final firstRunSheetsProvider = NotifierProvider<FirstRunSheets, Set<String>>(FirstRunSheets.new, name: 'firstRunSheetsProvider');
