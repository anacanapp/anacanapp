// Ported from: src/hooks/useChatGroups.language.test.tsx
import 'package:anacan/features/groups/data/chat_groups.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../../chat/support/chat_fakes.dart';

class _Language extends Notifier<String> {
  @override
  String build() => 'ru';
  void set(String value) => state = value;
}

final _languageProvider = NotifierProvider<_Language, String>(_Language.new);

/// Lets pending futures run (`waitFor`).
Future<void> until(bool Function() condition) async {
  for (var i = 0; i < 200; i++) {
    if (condition()) return;
    await Future<void>.delayed(Duration.zero);
  }
  expect(condition(), isTrue, reason: 'condition not reached');
}

void main() {
  late FakeChatBackend backend;
  late ProviderContainer c;

  setUp(() {
    installTestI18n();
    backend = FakeChatBackend()
      ..onRpc = (fn, params) async => fn == 'chat_group_people_v3'
          ? const []
          : [
              {'id': 'ru-group', 'discovery_language': 'ru', 'is_member': true},
              {'id': 'az-group', 'discovery_language': 'az', 'is_member': true},
            ];
    c = ProviderContainer(overrides: [
      ...chatOverrides(backend: backend, userId: 'viewer'),
      groupsLanguageProvider.overrideWith((ref) => ref.watch(_languageProvider)),
    ]);
    addTearDown(c.dispose);
  });

  T Function() listen<T>(ProviderListenable<T> provider) {
    final sub = c.listen<T>(provider, (_, _) {}, fireImmediately: true);
    addTearDown(sub.close);
    return sub.read;
  }

  test('filters discovery by creator language and immediately clears the previous-language cache on a switch', () async {
    final read = listen(chatGroupsStateProvider(const ChatGroupArgs()));
    await until(() => read().groups.map((g) => g['id']).join(',') == 'ru-group');
    expect(backend.named('rpc').any((call) => call.args[0] == 'chat_groups_v4' && (call.args[1] as Map)['p_language'] == 'ru'), isTrue);
    c.read(_languageProvider.notifier).set('az');
    expect(read().groups, isEmpty);
    await until(() => read().groups.map((g) => g['id']).join(',') == 'az-group');
  });

  test('keeps joined chats and an explicit group accessible through the membership contract', () async {
    final inbox = listen(chatGroupsStateProvider(const ChatGroupArgs(scope: 'mine', languageFiltered: false)));
    await until(() => inbox().groups.length == 2);
    expect(backend.named('rpc').any((call) => call.args[0] == 'chat_groups_v3' && '${call.args[1]}' == '${{'p_scope': 'mine', 'p_group': null, 'p_search': ''}}'), isTrue);
    final single = listen(chatGroupsStateProvider(const ChatGroupArgs.single('az-group')));
    await until(() => single().group?['id'] == 'az-group');
  });
}
