// Ported from: src/components/tools/PregnancyAlbum.tsx (behaviour checks; src/lib/album-photo-replace.test.ts is
//              ported with the baby album: test/features/tools/baby_album/album_logic_test.dart)
import 'dart:typed_data';

import 'package:anacan/features/tools/baby_album/album_photo_replace.dart';
import 'package:anacan/features/tools/baby_album/image_compress.dart';
import 'package:anacan/features/tools/pregnancy_album/pregnancy_album.dart';
import 'package:anacan/features/tools/pregnancy_album/pregnancy_album_data.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

class FakeAlbumRepository implements PregnancyAlbumRepository, AlbumStorageBucket {
  final List<Map<String, dynamic>> rows = [];
  final List<String> calls = [];
  var _id = 0;

  @override
  Future<List<Map<String, dynamic>>> loadRows(String userId) async => [...rows];
  @override
  Future<List<String>?> signedUrls(List<String> paths) async => [for (final p in paths) 'signed://$p'];
  @override
  String publicUrl(String path) => 'https://h/storage/v1/object/public/pregnancy-album/$path';
  @override
  Future<void> insertRow(Map<String, Object?> row) async {
    calls.add('insert:${row['month_number']}:${row['week_number']}');
    rows.add({'id': 'p${_id++}', 'photo_date': '2026-11-01T10:00:00Z', 'created_at': '2026-11-01T10:00:00Z', ...row});
  }

  @override
  Future<void> deleteRow(String id) async {
    calls.add('delete:$id');
    rows.removeWhere((r) => r['id'] == id);
  }

  @override
  Future<void> updateCaption(String id, String? caption) async => calls.add('caption:$id:$caption');
  @override
  Future<Object?> updateRow(String table, Map<String, Object?> values, String id) async {
    calls.add('update:$id');
    return null;
  }

  @override
  AlbumStorageBucket bucket(String name) => this;
  @override
  Future<Object?> upload(String path, UploadFile file) async {
    calls.add('upload:$path');
    return null;
  }

  @override
  Future<Object?> remove(List<String> paths) async {
    calls.add('remove:${paths.join(',')}');
    return null;
  }
}

final noImages = albumImageBuilderProvider.overrideWithValue((url, fit) => SizedBox.expand(key: ValueKey('img:$url')));

void main() {
  testWidgets('uploads the current month, future months are locked, delete removes object and row', (tester) async {
    final lmp = DateTime.now().subtract(const Duration(days: 15 * 7));
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'bump', 'lastPeriodDate': lmp.toUtc().toIso8601String()}));
    final repo = FakeAlbumRepository();
    var picks = 0;
    await pumpTool(tester, PregnancyAlbum(onBack: () {}), overrides: [
      ...env.overrides,
      noImages,
      pregnancyAlbumRepositoryProvider.overrideWithValue(repo),
      pregnancyAlbumNowProvider.overrideWithValue(() => 1700000000000),
      pregnancyAlbumPickerProvider.overrideWithValue(() async {
        picks++;
        return UploadFile(bytes: Uint8List.fromList([1, 2, 3]), name: 'photo.jpg', type: 'image/jpeg');
      }),
    ]);
    await tester.pump();
    expect(find.text('Hamiləlik Albomu'), findsOneWidget);
    expect(find.text('4-cü ay'), findsWidgets); // week 15 → month 4
    expect(find.text('Fiziki Albom'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('album-month-6')));
    await tester.pump();
    expect(picks, 0);

    await tester.tap(find.byKey(const ValueKey('album-month-4')));
    await tester.pump();
    await tester.pump();
    await tester.pump();
    expect(repo.calls, ['upload:u1/4-1700000000000.jpg', 'insert:4:14']);
    expect(find.text('Şəkil əlavə edildi'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('album-month-4')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('album-action-delete')));
    await tester.pumpAndSettle();
    expect(env.confirms.single, 'Bu şəkli silmək istədiyinizə əminsiniz?');
    expect(repo.calls.skip(2).toList(), ['remove:u1/4-1700000000000.jpg', 'delete:p0']);
    await unmount(tester);
  });

  testWidgets('replace uploads a new object, points the row at it and then removes the old one', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'mommy'}));
    final repo = FakeAlbumRepository()
      ..rows.add({
        'id': 'r1',
        'user_id': 'u1',
        'week_number': 22,
        'month_number': 6,
        'photo_url': 'https://h/storage/v1/object/public/pregnancy-album/u1/6-1.jpg',
        'caption': null,
        'photo_date': '2026-05-01T10:00:00Z',
        'created_at': '2026-05-01T10:00:00Z',
      });
    await pumpTool(tester, PregnancyAlbum(onBack: () {}), overrides: [
      ...env.overrides,
      noImages,
      pregnancyAlbumRepositoryProvider.overrideWithValue(repo),
      pregnancyAlbumNowProvider.overrideWithValue(() => 2),
      pregnancyAlbumPickerProvider.overrideWithValue(() async => UploadFile(bytes: Uint8List.fromList([1]), name: 'new.webp', type: 'image/webp')),
    ]);
    await tester.pump();
    await tester.pump();
    expect(find.text('Fiziki Albom Sifariş Et'), findsOneWidget); // after birth every month is past → order CTA
    await tester.tap(find.byKey(const ValueKey('album-month-6')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('album-action-replace')));
    await tester.pumpAndSettle();
    expect(repo.calls, ['upload:u1/6-2.webp', 'update:r1', 'remove:u1/6-1.jpg']);
    await unmount(tester);
  });
}
