// Ported from: src/components/tools/FairyTaleGenerator.tsx, src/hooks/useFairyTales.ts (behaviour checks; no
//              vitest suite)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/tools/fairy_tale/fairy_tale_generator.dart';
import 'package:anacan/features/tools/fairy_tale/fairy_tales_data.dart';
import 'package:anacan/features/tools/media_common/media_copy.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

class TaleEnv {
  TaleEnv() {
    env.db.tables['fairy_tale_themes'] = [
      {'id': 't1', 'name': 'Meşə', 'emoji': '🌲', 'is_active': true, 'sort_order': 1},
    ];
  }
  final MediaEnv env = MediaEnv();
  final List<Map<String, Object?>> requests = [];
  Future<Map<String, dynamic>> Function(Map<String, Object?> body) answer = (body) async => {
    'success': true,
    'title': 'Aylin və Ay',
    'content': 'Bir varmış, bir yoxmuş.',
  };

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    FairyTaleGenerator(onBack: () {}),
    overrides: [
      ...env.overrides,
      fairyTaleRequestProvider.overrideWithValue((body) {
        requests.add(body);
        return answer(body);
      }),
    ],
  );
}

Future<void> openCreate(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('tale-create-hero')));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  setUpAll(ensureDateLocales);

  testWidgets('an empty library offers the first tale', (tester) async {
    final e = TaleEnv();
    await e.pump(tester);
    await settle(tester);
    expect(find.text('Hələ nağıl yoxdur'), findsOneWidget);
    expect(find.text('Hamısı (0)'), findsOneWidget);
    await unmountMediaTool(tester);
  });

  testWidgets('free prompt: generates with the example name, stores the tale and opens the reader', (tester) async {
    final e = TaleEnv();
    await e.pump(tester);
    await settle(tester);
    await openCreate(tester);
    await tester.tap(find.text('Sərbəst yaz'));
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('tale-prompt')), 'Balaca aslan haqqında');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-generate')));
    await settle(tester);
    await tester.pump(const Duration(milliseconds: 300));

    expect(e.requests.single, {'childName': exampleChildName('az'), 'language': 'az', 'ageRange': '3-5', 'customPrompt': 'Balaca aslan haqqında'});
    final insert = e.env.db.callsOf('insert', 'fairy_tales').single.body! as Map;
    expect(insert['title'], 'Aylin və Ay');
    expect(insert['user_id'], 'u1');
    expect(e.env.toasts.single.title, 'Nağıl yaradıldı! ✨');
    expect(find.text('Bir varmış, bir yoxmuş.'), findsOneWidget);
    await unmountMediaTool(tester);
  });

  testWidgets('no allowance left opens the paywall before generating', (tester) async {
    final e = TaleEnv();
    e.env.usage.remainingDaily = 0;
    await e.pump(tester);
    await settle(tester);
    await openCreate(tester);
    await tester.tap(find.text('Sərbəst yaz'));
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('tale-prompt')), 'Nağıl');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-generate')));
    await settle(tester);
    expect(e.env.paywalls, ['fairy_tale']);
    expect(e.requests, isEmpty);
    await unmountMediaTool(tester);
  });

  testWidgets('wizard: name and theme are required, the summary sends every choice', (tester) async {
    final e = TaleEnv();
    await e.pump(tester);
    await settle(tester);
    await openCreate(tester);
    await tester.enterText(find.byKey(const ValueKey('tale-child-name')), 'Nərmin');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-next-1')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-theme-t1')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-next-2')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-next-3')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-next-4')));
    await tester.pump();
    expect(find.text('Nərmin'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('tale-generate')));
    await settle(tester);
    expect(e.requests.single, {'childName': 'Nərmin', 'theme': 'Meşə', 'hero': '', 'moralLesson': '', 'language': 'az', 'ageRange': '3-5', 'storyStyle': ''});
    await tester.pump(const Duration(milliseconds: 300));
    await unmountMediaTool(tester);
  });

  testWidgets('a failed generation shows the server error', (tester) async {
    final e = TaleEnv();
    e.answer = (_) async => throw const FairyTaleError('Gemini API error: 500');
    await e.pump(tester);
    await settle(tester);
    await openCreate(tester);
    await tester.tap(find.text('Sərbəst yaz'));
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('tale-prompt')), 'Nağıl');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('tale-generate')));
    await settle(tester);
    expect(e.env.toasts.single.title, 'Nağıl yaradıla bilmədi: Gemini API error: 500');
    expect(e.env.toasts.single.sonner, 'error');
    await unmountMediaTool(tester);
  });

  test('reading time is words / 150 rounded up', () {
    expect(fairyTaleReadingTime('a b c'), 1);
    expect(fairyTaleReadingTime(List.filled(151, 'x').join(' ')), 2);
  });
}
