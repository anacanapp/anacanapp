// Ported from: src/components/community/ChatGroupsPanel.test.tsx
import 'package:anacan/features/chat/data/chat_backend.dart' show ChatRow;
import 'package:anacan/features/groups/data/chat_groups.dart';
import 'package:anacan/features/groups/ui/chat_groups_panel.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../chat/support/chat_fakes.dart';

class _State {
  List<ChatRow> groups = [];
  final List<CreateGroupInput> created = [];
}

void main() {
  late _State state;

  setUp(() => state = _State());

  Future<void> pump(WidgetTester tester, void Function(String id) onOpen) => pumpChat(
        tester,
        SingleChildScrollView(child: ChatGroupsPanel(onOpen: onOpen)),
        overrides: [
          ...chatOverrides(backend: FakeChatBackend(), userId: 'viewer'),
          chatGroupsStateProvider.overrideWith((ref, args) => ChatGroupsState(
                groups: state.groups,
                group: null,
                loading: false,
                error: null,
                refetch: () async {},
                members: const [],
                membersLoading: false,
                membersError: null,
                create: (input) async {
                  state.created.add(input);
                  return 'new-group';
                },
                creating: false,
                manage: (group, action, [people = const []]) async => null,
                managing: false,
                update: (input) async {},
                updating: false,
              )),
        ],
      );

  testWidgets('creates a Public messaging group with explicit privacy and description', (tester) async {
    final semantics = tester.ensureSemantics();
    final opened = <String>[];
    await pump(tester, opened.add);
    await tester.tap(find.text('Yeni qrup yarat'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('group-field:Qrupun adı')), 'My conversation');
    await tester.enterText(find.byKey(const ValueKey('group-field:Haqqında')), 'Talk together');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel(RegExp('^Açıq Hər kəs')));
    await tester.pump();
    await tester.tap(find.text('Yarat'));
    await tester.pumpAndSettle();
    expect(state.created, hasLength(1));
    final input = state.created.single;
    expect(input.name, 'My conversation');
    expect(input.visibility, 'public');
    expect(input.description, 'Talk together');
    expect(input.people, isEmpty);
    expect(opened, ['new-group']);
    await flushChat(tester);
    semantics.dispose();
  });

  testWidgets('keeps private request/invitation previews clickable rather than allowing an implicit join', (tester) async {
    state.groups = [
      {'id': 'private', 'name': 'Private room', 'chat_visibility': 'private', 'is_member': false, 'access_state': 'requested', 'member_count': 2},
    ];
    final opened = <String>[];
    await pump(tester, opened.add);
    await tester.tap(find.text('Private room'));
    await tester.pump();
    expect(opened, ['private']);
    expect(find.text('Təsdiq gözləyir'), findsOneWidget);
    await flushChat(tester);
  });
}
