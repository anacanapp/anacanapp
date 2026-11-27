// Ported from: src/lib/album-photo-replace.test.ts, src/lib/image-compress.test.ts
import 'dart:typed_data';

import 'package:anacan/features/tools/baby_album/album_photo_replace.dart';
import 'package:anacan/features/tools/baby_album/image_compress.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeAlbumClient implements AlbumDbClient {
  FakeAlbumClient({this.uploadError, this.dbError, this.removeError});
  final Object? uploadError;
  final Object? dbError;
  final Object? removeError;
  final List<String> calls = [];
  final List<Map<String, Object?>> updates = [];

  @override
  AlbumStorageBucket bucket(String name) => FakeAlbumBucket(this);

  @override
  Future<Object?> updateRow(String table, Map<String, Object?> values, String id) async {
    updates.add(values);
    calls.add('db:update:$id');
    return dbError;
  }
}

class FakeAlbumBucket implements AlbumStorageBucket {
  FakeAlbumBucket(this.c);
  final FakeAlbumClient c;
  @override
  Future<Object?> upload(String path, UploadFile file) async {
    c.calls.add('upload:$path');
    return c.uploadError;
  }

  @override
  Future<Object?> remove(List<String> paths) async {
    c.calls.add('remove:${paths.join(',')}');
    return c.removeError;
  }
}

final UploadFile file = UploadFile(bytes: Uint8List.fromList([120]), name: 'x', type: '');

Future<void> replaceRecord(FakeAlbumClient client) => replaceRecordPhoto(
      client,
      bucket: 'pregnancy-album',
      table: 'pregnancy_album_photos',
      recordId: 'row1',
      oldPath: 'u/3-1.jpg',
      newPath: 'u/3-2.jpg',
      newUrl: 'https://x/pregnancy-album/u/3-2.jpg',
      file: file,
    );

Future<void> replaceStorage(FakeAlbumClient client) =>
    replaceStoragePhoto(client, bucket: 'baby-album', oldPath: 'u/month-2-1.jpg', newPath: 'u/month-2-2.jpg', file: file);

class FakeImageCodec implements ImageCodec {
  ({int w, int h})? drawn;
  ({String type, double quality})? encoded;
  int outputSize = 250000;
  bool fail = false;

  @override
  Future<({int width, int height})> decodeSize(Uint8List bytes) async {
    if (fail) throw StateError('decode');
    return (width: 4032, height: 3024);
  }

  @override
  Future<Uint8List?> encode(Uint8List bytes, {required int width, required int height, required String type, required double quality}) async {
    drawn = (w: width, h: height);
    encoded = (type: type, quality: quality);
    return Uint8List(outputSize);
  }
}

UploadFile big(String type, [int size = 2000000, String name = 'photo.heic']) => UploadFile(bytes: Uint8List(size), name: name, type: type);

void main() {
  group('replaceRecordPhoto (pregnancy album)', () {
    test('uploads new, updates the row, then deletes the old object', () async {
      final c = FakeAlbumClient();
      await replaceRecord(c);
      expect(c.calls, ['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-1.jpg']);
      expect(c.updates.single, {'photo_url': 'https://x/pregnancy-album/u/3-2.jpg'});
    });

    test('keeps the old photo when the upload fails', () async {
      final c = FakeAlbumClient(uploadError: {'message': 'net'});
      await expectLater(replaceRecord(c), throwsA({'message': 'net'}));
      expect(c.calls, ['upload:u/3-2.jpg']);
    });

    test('keeps the old photo and cleans up the new object when the DB update fails', () async {
      final c = FakeAlbumClient(dbError: {'message': 'rls'});
      await expectLater(replaceRecord(c), throwsA({'message': 'rls'}));
      expect(c.calls, ['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-2.jpg']);
      expect(c.calls, isNot(contains('remove:u/3-1.jpg')));
    });

    test('still succeeds when deleting the old object fails', () async {
      final c = FakeAlbumClient(removeError: {'message': 'gone'});
      await replaceRecord(c);
      expect(c.calls, ['upload:u/3-2.jpg', 'db:update:row1', 'remove:u/3-1.jpg']);
    });
  });

  group('replaceStoragePhoto (baby album)', () {
    test('uploads new before deleting old', () async {
      final c = FakeAlbumClient();
      await replaceStorage(c);
      expect(c.calls, ['upload:u/month-2-2.jpg', 'remove:u/month-2-1.jpg']);
    });

    test('never deletes the old object when the upload fails', () async {
      final c = FakeAlbumClient(uploadError: {'message': 'offline'});
      await expectLater(replaceStorage(c), throwsA({'message': 'offline'}));
      expect(c.calls, ['upload:u/month-2-2.jpg']);
    });
  });

  group('storagePathFromUrl', () {
    test('handles public URLs, signed URLs and bare paths', () {
      expect(storagePathFromUrl('https://h/storage/v1/object/public/pregnancy-album/u/3-1.jpg', 'pregnancy-album'), 'u/3-1.jpg');
      expect(storagePathFromUrl('https://h/storage/v1/object/sign/pregnancy-album/u/a%20b.jpg?token=abc', 'pregnancy-album'), 'u/a b.jpg');
      expect(storagePathFromUrl('u/3-1.jpg', 'pregnancy-album'), 'u/3-1.jpg');
    });
  });

  group('compressImageForUpload', () {
    late FakeImageCodec codec;
    setUp(() => codec = FakeImageCodec());

    test('downscales a large photo to 1600 px JPEG and renames it', () async {
      final out = await compressImageForUpload(big('image/jpeg', 3000000, 'IMG_1.jpeg'), codec: codec);
      expect(codec.drawn, (w: 1600, h: 1200));
      expect(codec.encoded, (type: 'image/jpeg', quality: 0.82));
      expect(out.type, 'image/jpeg');
      expect(out.name, 'IMG_1.jpg');
      expect(out.size, 250000);
    });

    test('keeps transparency for PNG by asking for WebP', () async {
      final out = await compressImageForUpload(big('image/png', 2000000, 'shot.png'), codec: codec);
      expect(codec.encoded?.type, 'image/webp');
      expect(out.name, 'shot.webp');
    });

    test('returns the original for small files, GIF, video and non-images', () async {
      for (final f in [big('image/jpeg', 100000), big('image/gif'), big('video/mp4'), big('application/pdf')]) {
        expect(identical(await compressImageForUpload(f, codec: codec), f), isTrue);
      }
      expect(codec.drawn, isNull);
    });

    test('returns the original when decoding fails (e.g. HEIC on Android)', () async {
      codec.fail = true;
      final f = big('image/heic');
      expect(identical(await compressImageForUpload(f, codec: codec), f), isTrue);
    });

    test('returns the original when the result would not be smaller', () async {
      codec.outputSize = 3000000;
      final f = big('image/jpeg', 2000000);
      expect(identical(await compressImageForUpload(f, codec: codec), f), isTrue);
    });
  });
}
