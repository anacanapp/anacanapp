// Ported from: (golden of src/components/community/ConversationListScreen.tsx, empty inbox — reference shot
//              bump.parity__chat-inbox, 390×844 light az: no DMs, no groups, no linked partner)
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/features/chat/dm/conversation_list_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../design/harness.dart';
import '../support/chat_fakes.dart';

void main() {
  setUpAll(loadAnacanFonts);

  testWidgets('golden: empty inbox (reference shot bump.parity__chat-inbox)', (tester) async {
    final backend = FakeChatBackend()..onRpc = (fn, params) async => fn == 'chat_groups_v3' ? <Map<String, dynamic>>[] : null;
    await pumpChat(tester, ConversationListScreen(onBack: () {}, onOpenChat: (_, _, _) {}), overrides: chatOverrides(backend: backend));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await settleSvgs(tester);
    await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/chat_inbox_empty_light.png'));
    await flushChat(tester);
  });
}
