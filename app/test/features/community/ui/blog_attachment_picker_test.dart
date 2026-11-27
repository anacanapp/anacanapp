// Ported from: src/components/community/BlogAttachmentPicker.test.tsx
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/ui/community_blog_card.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show Material, TextField;

import '../support/community_fakes.dart';

const blog = {
  'id': '11111111-1111-4111-8111-111111111111',
  'slug': 'sleep-guide',
  'title': 'Sleep guide',
  'excerpt': 'Article description',
  'cover_image_url': 'https://example.invalid/cover.jpg',
};

class _Composer extends StatefulWidget {
  const _Composer();
  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final TextEditingController controller = TextEditingController();
  late final BlogAttachment attachment = BlogAttachment(controller: controller);

  @override
  void dispose() {
    attachment.dispose();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Material(
        child: SingleChildScrollView(
          child: Column(children: [
            TextField(controller: controller, maxLines: null),
            BlogAttachmentPicker(attachment: attachment),
            ListenableBuilder(listenable: attachment, builder: (_, _) => Text('selected:${attachment.selected?.id ?? ''}')),
          ]),
        ),
      );
}

void main() {
  late FakeCommunityBackend backend;
  late QueryClient client;
  late List<Object?> data;

  setUp(() {
    data = [blog];
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry));
    backend = FakeCommunityBackend()..onRpc = (fn, params) async => data;
  });

  List<Override> overrides() => communityOverrides(backend: backend, client: client, userId: 'viewer', language: 'en');

  testWidgets('searches /Blog, attaches its image/title, and preserves independent caption text', (tester) async {
    await pumpCommunity(tester, const _Composer(), overrides: overrides(), language: 'en');
    final field = find.byType(TextField);
    final controller = tester.widget<TextField>(field).controller!;
    controller.value = const TextEditingValue(text: 'My caption /Blog sleep', selection: TextSelection.collapsed(offset: 22));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    await until(() => backend.rpcArgs('search_share_blogs_v1').isNotEmpty);
    expect(backend.rpcArgs('search_share_blogs_v1').last, allOf(containsPair('p_search', 'sleep'), containsPair('p_language', 'en')));
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Sleep guide').first);
    await tester.pump();
    expect(controller.text, 'My caption ');
    expect(find.text('Sleep guide'), findsOneWidget);
    expect(find.byWidgetPredicate((w) => w is Image && w.image is NetworkImage && (w.image as NetworkImage).url == blog['cover_image_url']), findsOneWidget);
    controller.value = const TextEditingValue(text: 'My caption and my thoughts', selection: TextSelection.collapsed(offset: 26));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Sleep guide'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Remove article'));
    await tester.pump();
    expect(find.text('Sleep guide'), findsNothing);
    expect(controller.text, 'My caption and my thoughts');
    await flushCommunity(tester);
  });

  testWidgets('opens a shared card inside the app and hides unpublished/missing metadata', (tester) async {
    final opened = <String>[];
    await pumpCommunity(
      tester,
      const SingleChildScrollView(child: CommunityBlogCard(id: '11111111-1111-4111-8111-111111111111')),
      overrides: [...overrides(), communityBlogOpenerProvider.overrideWithValue(opened.add)],
      language: 'en',
    );
    await tester.pump();
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Sleep guide'));
    expect(Uri.parse(opened.single).pathSegments.last, 'sleep-guide');
    data = [];
    await client.invalidateQueries();
    await tester.pump();
    await tester.pump();
    expect(find.text('This article is no longer available.'), findsOneWidget);
    expect(find.bySemanticsLabel('Sleep guide'), findsNothing);
    await flushCommunity(tester);
  });
}
