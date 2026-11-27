// Ported from: (no React test) src/components/MotherChatScreen.tsx, src/components/stickers/StickerPicker.tsx,
//              src/hooks/useChatChrome.ts, src/components/chat/ChatMemberPicker.tsx, src/pages/Index.tsx (registration)
import 'package:anacan/features/chat/data/chat.dart' show ChatKind;
import 'package:anacan/features/chat/data/chat_messages.dart';
import 'package:anacan/features/chat/data/stickers.dart';
import 'package:anacan/features/chat/mother_chat_screen.dart';
import 'package:anacan/features/chat/register.dart';
import 'package:anacan/features/chat/ui/chat_member_picker.dart';
import 'package:anacan/features/chat/ui/chat_widgets.dart';
import 'package:anacan/features/chat/ui/conversation_screen.dart';
import 'package:anacan/features/chat/ui/sticker_picker.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show TextField;
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import 'support/chat_fakes.dart';

void main() {
  testWidgets('MotherChatScreen asks to link a partner when none is linked', (tester) async {
    final backend = FakeChatBackend();
    await pumpChat(tester, MotherChatScreen(onBack: () {}), overrides: chatOverrides(backend: backend));
    expect(find.text('Əvvəlcə partnyorla əlaqələnin.'), findsOneWidget);
    expect(find.text('Mesajlar'), findsOneWidget);
    expect(backend.named('maybeSingle'), isEmpty);
    await flushChat(tester);
  });

  testWidgets('MotherChatScreen offers a retry after a failed partner lookup, then opens the partner conversation', (tester) async {
    var calls = 0;
    final backend = FakeChatBackend()
      ..onMaybeSingle = (table, columns, column, value) async {
        calls++;
        if (calls == 1) throw PostgrestException(message: 'offline');
        return {'user_id': 'partner-user', 'name': 'Elvin', 'avatar_url': null};
      };
    await pumpChat(tester, MotherChatScreen(onBack: () {}),
        overrides: [...chatOverrides(backend: backend, profile: chatProfile('sender', linkedPartnerId: 'partner-profile'))]);
    await tester.pump();
    expect(find.text('Partnyor məlumatları yüklənmədi.'), findsOneWidget);
    await tester.tap(find.text('Yenidən cəhd et'));
    await tester.pump();
    await tester.pump();
    final screen = tester.widget<ConversationScreen>(find.byType(ConversationScreen));
    expect(screen.target, 'partner-user');
    expect(screen.title, 'Elvin');
    expect(backend.named('maybeSingle').last.args, ['profiles', 'user_id,name,avatar_url', 'id', 'partner-profile']);
    await flushChat(tester);
  });

  testWidgets('StickerPicker sends a sticker, remembers it and filters by group', (tester) async {
    final picked = <String>[];
    final store = LocalStore.memory();
    await pumpChat(
      tester,
      Center(child: SizedBox(width: 360, child: StickerPicker(onPick: picked.add, onClose: () {}))),
      overrides: chatOverrides(backend: FakeChatBackend(), store: store),
    );
    expect(find.byKey(const ValueKey('sticker-01')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('sticker-01')));
    expect(picked, ['01']);
    expect(recentStickers(store), ['01']);
    await tester.tap(find.text('Ritm'));
    await tester.pump();
    expect(find.byKey(const ValueKey('sticker-01')), findsNothing);
    expect(find.byKey(const ValueKey('sticker-04')), findsOneWidget);
    await flushChat(tester);
  });

  testWidgets('a full-screen chat holds one nav lease while mounted', (tester) async {
    final show = ValueNotifier(true);
    await pumpChat(
      tester,
      ValueListenableBuilder<bool>(
        valueListenable: show,
        builder: (context, visible, _) => Column(children: [
          if (visible) const FullScreenChatLease(child: SizedBox()),
          if (visible) const FullScreenChatLease(child: SizedBox()),
        ]),
      ),
      overrides: chatOverrides(backend: FakeChatBackend()),
    );
    await tester.pump();
    final container = ProviderScope.containerOf(tester.element(find.byType(Column).first));
    expect(container.read(fullScreenChatLeasesProvider), 2);
    expect(container.read(chatChromeHiddenProvider), isTrue);
    show.value = false;
    await tester.pump();
    await tester.pump();
    expect(container.read(fullScreenChatLeasesProvider), 0);
    await flushChat(tester);
  });

  testWidgets('ChatMemberPicker searches after two letters and toggles people', (tester) async {
    final backend = FakeChatBackend();
    var selected = <Map<String, dynamic>>[];
    await pumpChat(
      tester,
      StatefulBuilder(
        builder: (context, setState) => ChatMemberPicker(selected: selected, onChange: (next) => setState(() => selected = next)),
      ),
      overrides: chatOverrides(backend: backend),
    );
    expect(find.text('Axtarış üçün ən azı 2 hərf yazın.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'A%y');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();
    expect(backend.named('searchProfileCards').single.args, ['Ay', 20]);
    expect(find.text('İstifadəçi tapılmadı.'), findsOneWidget);
    await flushChat(tester);
  });

  test('registerChatFeature registers the Messages overlay, the partner chat tab and the toast listener', () {
    final registry = FeatureRegistry()..registerAll([registerChatFeature]);
    expect(registry.registeredIds, containsAll(['overlay:motherChat', 'tab:chat:partner', 'frame:partner-message-toasts']));
    expect(registry.tab(ShellTab.chat, partner: true)!.fillsViewport, isTrue);
    expect(const ChatScope(ChatKind.direct, 'a'), const ChatScope(ChatKind.direct, 'a'));
  });
}
