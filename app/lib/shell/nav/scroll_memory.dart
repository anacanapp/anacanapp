// Ported from: src/lib/scrollMemory.ts (saveScroll, restoreScroll with rAF/80 ms/180 ms retries,
//              cancelScrollRestoration, clearScroll), src/lib/scroll.ts + Index.tsx scroll reset
//              (now, next frame, +80 ms), src/hooks/useScrollToTop.ts (now, next frame, +60 ms)
import 'dart:async';

/// The `[data-scroll-container]` the memory reads and writes (the shell's tab scroll view).
abstract interface class ScrollContainerHandle {
  double get offset;
  void jumpTo(double offset);
}

/// Schedules the retries; [frame] is `requestAnimationFrame`.
abstract interface class ScrollScheduler {
  void frame(void Function() fn);
  void after(Duration delay, void Function() fn);
}

/// Real scheduler: post-frame callbacks are supplied by the widget layer, delays are [Timer]s.
class TimerScrollScheduler implements ScrollScheduler {
  TimerScrollScheduler(this._frame);
  final void Function(void Function() fn) _frame;
  @override
  void frame(void Function() fn) => _frame(fn);
  @override
  void after(Duration delay, void Function() fn) => Timer(delay, fn);
}

/// Scroll positions per key (`tab:<tab>`, `toolshub`, `blog` …), restored after the reset-to-top.
class ScrollMemory {
  ScrollMemory(this.scheduler);

  final ScrollScheduler scheduler;
  final Map<String, double> _mem = {};
  int _generation = 0;

  /// The default container (`document.querySelector('[data-scroll-container]')`); set by the shell.
  ScrollContainerHandle? container;

  static const List<Duration> restoreDelays = [Duration(milliseconds: 80), Duration(milliseconds: 180)];
  static const Duration resetDelay = Duration(milliseconds: 80);
  static const Duration scrollToTopDelay = Duration(milliseconds: 60);

  /// A new reader/navigation must not receive an earlier screen's delayed restore.
  void cancelRestoration() => _generation++;

  /// `saveScroll(key, el)`: call before the content changes.
  void save(String key, [ScrollContainerHandle? el]) {
    final c = el ?? container;
    if (c != null) _mem[key] = c.offset;
  }

  /// `restoreScroll(key, el)`: applied on the next frame, at 80 ms and at 180 ms so it wins over resets.
  void restore(String key, [ScrollContainerHandle? el]) {
    final top = _mem[key];
    if (top == null || top <= 0) return;
    final generation = ++_generation;
    void apply() {
      if (generation != _generation) return;
      final c = el ?? container;
      if (c != null && (c.offset - top).abs() > 2) c.jumpTo(top);
    }

    scheduler.frame(apply);
    for (final d in restoreDelays) {
      scheduler.after(d, apply);
    }
  }

  void clear(String key) => _mem.remove(key);

  double? saved(String key) => _mem[key];

  /// Index's layout effect on every tab/screen/tool change: top now, next frame and at 80 ms.
  void resetToTop([ScrollContainerHandle? el]) {
    void apply() => (el ?? container)?.jumpTo(0);
    apply();
    scheduler.frame(apply);
    scheduler.after(resetDelay, apply);
  }

  /// `useScrollToTop`: top now, next frame and at 60 ms.
  void scrollToTop([ScrollContainerHandle? el]) {
    void apply() => (el ?? container)?.jumpTo(0);
    apply();
    scheduler.frame(apply);
    scheduler.after(scrollToTopDelay, apply);
  }
}
