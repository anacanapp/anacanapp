// Ported from: src/lib/scrollMemory.test.tsx (blog reader scroll contract)
import 'package:anacan/shell/nav/scroll_memory.dart';
import 'package:flutter_test/flutter_test.dart';

import 'shell_test_support.dart';

void main() {
  late ManualScheduler scheduler;
  late ScrollMemory memory;
  late FakeContainer root;

  /// The reader: `useLayoutEffect(cancelScrollRestoration)` + `useScrollToTop([id])`.
  void mountReader() {
    memory.cancelRestoration();
    memory.scrollToTop(root);
  }

  setUp(() {
    scheduler = ManualScheduler();
    memory = ScrollMemory(scheduler);
    root = FakeContainer();
  });

  group('blog reader scroll contract', () {
    test('opens at the top and does not inherit a related article scroll position', () {
      root.offset = 760;
      mountReader();
      expect(root.offset, 0);
      root.offset = 940;
      mountReader();
      expect(root.offset, 0);
    });

    test('cancels a pending list restore instead of jumping to the middle after opening a reader', () {
      root.offset = 640;
      memory.save('blog', root);
      root.offset = 0;
      memory.restore('blog', root);
      mountReader();
      scheduler.advance(250);
      expect(root.offset, 0);
    });

    test('still restores the previous list position when actually returning to the list', () {
      root.offset = 640;
      memory.save('blog', root);
      root.offset = 0;
      memory.restore('blog', root);
      scheduler.advance(250);
      expect(root.offset, 640);
    });
  });

  test('restore wins over the Index reset (now, frame, 80 ms) because its last retry is at 180 ms', () {
    memory.container = root;
    root.offset = 500;
    memory.save('tab:home');
    memory.restore('tab:home');
    memory.resetToTop();
    expect(root.offset, 0);
    scheduler.advance(100);
    expect(root.offset, 0, reason: 'the 80 ms reset runs after the 80 ms restore');
    scheduler.advance(100);
    expect(root.offset, 500);
  });

  test('nothing saved, zero or cleared → no restore', () {
    memory.container = root;
    memory.restore('missing');
    root.offset = 0;
    memory.save('zero');
    root.offset = 50;
    memory.restore('zero');
    scheduler.advance(250);
    expect(root.offset, 50);
    memory.save('k');
    memory.clear('k');
    expect(memory.saved('k'), isNull);
  });
}
