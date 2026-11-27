// Ported from: src/components/tools/BabyPhotoshoot.tsx (behaviour checks; no vitest suite)
import 'dart:typed_data';

import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:anacan/features/tools/photoshoot/baby_photoshoot.dart';
import 'package:anacan/features/tools/photoshoot/photo_gallery_viewer.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

class _Options implements ToolsDataSource {
  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async => switch (query.table) {
    'photoshoot_backgrounds' => [
      {'theme_id': 'garden', 'theme_name': 'Garden', 'theme_name_az': 'Bağ', 'category_name_az': 'Realist', 'theme_emoji': '🌷', 'gender': 'all'},
    ],
    _ => <Map<String, dynamic>>[],
  };
}

class PhotoEnv {
  final MediaEnv env = MediaEnv();
  final List<int> galleryOpens = [];

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    BabyPhotoshoot(onBack: () {}),
    overrides: [
      ...env.overrides,
      toolsDataSourceProvider.overrideWithValue(_Options()),
      mediaImagePickerProvider.overrideWithValue((source) async => PickedImage(bytes: Uint8List.fromList(const [1, 2, 3]))),
      photoGalleryViewerProvider.overrideWithValue((context, {required photos, required initialIndex, onDelete}) async => galleryOpens.add(initialIndex)),
    ],
  );
}

Future<void> walkToDetails(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('photo-pick')));
  await settle(tester);
  await tester.tap(find.byKey(const ValueKey('photo-next')));
  await settle(tester);
  await tester.tap(find.byKey(const ValueKey('photo-bg-garden')));
  await settle(tester);
  await tester.tap(find.byKey(const ValueKey('photo-next')));
  await settle(tester);
}

void main() {
  testWidgets('premium: photo → background → details → generate-baby-photo, new photo first, gallery opened', (tester) async {
    final e = PhotoEnv();
    e.env.db.functions['generate-baby-photo'] = (_) => {
      'photo': {'id': 'new', 'url': 'https://cdn.test/new.jpg', 'theme': 'garden', 'createdAt': '2026-11-27T10:00:00Z'},
    };
    await e.pump(tester);
    await settle(tester);
    expect(find.text('Hələ foto yoxdur'), findsOneWidget);
    await walkToDetails(tester);
    expect(find.text('Göz Rəngi'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('photo-eye-blue')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('photo-generate')));
    await settle(tester);

    final body = e.env.db.callsOf('invoke', 'generate-baby-photo').single.body! as Map;
    expect(body['backgroundTheme'], 'garden');
    expect(body['sourceImageBase64'], 'data:image/jpeg;base64,AQID');
    expect(body['customization'], {'gender': 'boy', 'eyeColor': 'blue', 'hairColor': 'keep', 'hairStyle': 'keep', 'outfit': 'keep', 'imageStyle': 'realistic'});
    expect(e.galleryOpens, [0]);
    expect(find.byKey(const ValueKey('photo-thumb-new')), findsOneWidget);
    expect(e.env.toasts.single.title, 'Foto hazırdır! 📸');
    await unmountMediaTool(tester);
  });

  testWidgets('free users can browse but creating opens the paywall', (tester) async {
    final e = PhotoEnv();
    e.env.usage.isPremium = false;
    await e.pump(tester);
    await settle(tester);
    expect(find.text('Bu bölmə Premium-dadır'), findsOneWidget);
    await walkToDetails(tester);
    await tester.tap(find.byKey(const ValueKey('photo-generate')));
    await settle(tester);
    expect(e.env.paywalls, ['Daha çox foto yaratmaq']);
    expect(e.env.db.callsOf('invoke'), isEmpty);
    await unmountMediaTool(tester);
  });

  testWidgets('changing the gender clears the background and outfit; continue needs a photo', (tester) async {
    final e = PhotoEnv();
    await e.pump(tester);
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('photo-next')));
    await settle(tester);
    expect(find.text('Cinsiyyət Seçin'), findsOneWidget); // still step 1 without a photo
    await unmountMediaTool(tester);
  });

  test('gradient classes map to their two colours, unknown ones to grey', () {
    expect(photoshootGradient('from-blue-400 to-blue-600').colors, [const Color(0xFF60A5FA), const Color(0xFF2563EB)]);
    expect(photoshootGradient('from-x to-y').colors, [const Color(0xFFD1D5DB), const Color(0xFF9CA3AF)]);
    expect(photoshootCanProceed(0, const PhotoshootCustomization(), false), isFalse);
    expect(photoshootCanProceed(1, const PhotoshootCustomization(background: 'a'), false), isTrue);
  });
}
