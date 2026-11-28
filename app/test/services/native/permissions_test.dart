// Ported from: src/lib/permissions.test.ts
//
// The Capacitor Camera / Geolocation mocks become fake ports; `Capacitor.isNativePlatform()` / `getPlatform()` are the
// [NativePermissions] fields; `navigator.geolocation` is [BrowserGeolocation].
import 'package:anacan/services/native/permissions.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeCamera implements CameraPort {
  CameraPermissionStatus check = const CameraPermissionStatus(camera: 'prompt', photos: 'prompt');
  CameraPermissionStatus requested = const CameraPermissionStatus(camera: 'denied', photos: 'denied');
  String? photo;
  final List<List<String>> requestCalls = [];
  final List<CameraPhotoOptions> photoCalls = [];
  int checkCalls = 0;

  @override
  Future<CameraPermissionStatus> checkPermissions() async {
    checkCalls++;
    return check;
  }

  @override
  Future<CameraPermissionStatus> requestPermissions(List<String> permissions) async {
    requestCalls.add(permissions);
    return requested;
  }

  @override
  Future<String?> getPhoto(CameraPhotoOptions options) async {
    photoCalls.add(options);
    return photo;
  }
}

class FakeGeolocation implements GeolocationPort {
  Object? checkError;
  LocationPermissionStatus check = const LocationPermissionStatus(location: 'prompt', coarseLocation: 'prompt');
  LocationPermissionStatus requested = const LocationPermissionStatus(location: 'denied', coarseLocation: 'denied');
  GeoPositionData? position;
  final List<List<String>> requestCalls = [];
  final List<GeolocationOptions> positionCalls = [];
  int checkCalls = 0;

  @override
  Future<LocationPermissionStatus> checkPermissions() async {
    checkCalls++;
    if (checkError != null) throw checkError!;
    return check;
  }

  @override
  Future<LocationPermissionStatus> requestPermissions(List<String> permissions) async {
    requestCalls.add(permissions);
    return requested;
  }

  @override
  Future<GeoPositionData> getCurrentPosition(GeolocationOptions options) async {
    positionCalls.add(options);
    return position!;
  }
}

class FakeBrowserGeolocation implements BrowserGeolocation {
  FakeBrowserGeolocation(this.position);
  final GeoPositionData position;
  int calls = 0;
  @override
  Future<GeoPositionData> getCurrentPosition(GeolocationOptions options) async {
    calls++;
    return position;
  }
}

void main() {
  late FakeCamera camera;
  late FakeGeolocation geo;
  late String platform;
  late bool native;
  BrowserGeolocation? browser;

  NativePermissions perms() =>
      NativePermissions(isNative: native, platform: platform, camera: camera, geolocation: geo, browserGeolocation: browser);

  setUp(() {
    camera = FakeCamera();
    geo = FakeGeolocation();
    platform = 'android';
    native = true;
    browser = null;
  });

  group('location permission', () {
    test('accepts an existing approximate grant without asking again', () async {
      geo.check = const LocationPermissionStatus(location: 'denied', coarseLocation: 'granted');
      expect(await perms().requestLocationPermission(), const PermissionResult(granted: true, status: 'granted'));
      expect(geo.requestCalls, isEmpty);
    });

    test('requests only coarse location for Android weather and accepts its grant', () async {
      geo.check = const LocationPermissionStatus(location: 'prompt', coarseLocation: 'prompt');
      geo.requested = const LocationPermissionStatus(location: 'denied', coarseLocation: 'granted');
      expect(await perms().requestLocationPermission(), const PermissionResult(granted: true, status: 'granted'));
      expect(geo.requestCalls, [
        ['coarseLocation']
      ]);
    });

    test('uses the iOS location alias on iOS', () async {
      platform = 'ios';
      geo.check = const LocationPermissionStatus(location: 'prompt', coarseLocation: 'prompt');
      geo.requested = const LocationPermissionStatus(location: 'granted', coarseLocation: 'granted');
      expect((await perms().requestLocationPermission()).granted, isTrue);
      expect(geo.requestCalls, [
        ['location']
      ]);
    });

    test('preserves disabled system location errors instead of returning permission denied', () async {
      const error = NativePermissionError('Location services are not enabled.', code: 'OS-PLUG-GLOC-0007');
      geo.checkError = error;
      await expectLater(perms().getCurrentPosition(), throwsA(same(error)));
      expect(geo.requestCalls, isEmpty);
      expect(geo.positionCalls, isEmpty);
    });

    test('does not fetch a position after an actual denial', () async {
      geo.check = const LocationPermissionStatus(location: 'denied', coarseLocation: 'denied');
      geo.requested = const LocationPermissionStatus(location: 'denied', coarseLocation: 'denied');
      await expectLater(perms().getCurrentPosition(), throwsA(isA<NativePermissionError>().having((e) => e.name, 'name', 'NotAllowedError')));
      expect(geo.positionCalls, isEmpty);
    });

    test('obtains one native position without requiring precise location', () async {
      const position = GeoPositionData(latitude: 40, longitude: 49, accuracy: 2000, timestamp: 1000);
      geo.check = const LocationPermissionStatus(location: 'denied', coarseLocation: 'granted');
      geo.position = position;
      expect(await perms().getCurrentPosition(), position);
      expect(geo.positionCalls, [
        const GeolocationOptions(enableHighAccuracy: false, timeout: Duration(milliseconds: 10000), maximumAge: Duration(milliseconds: 60000)),
      ]);
    });

    test('uses one browser location request instead of a permission probe plus a second position', () async {
      native = false;
      const position = GeoPositionData(latitude: 40, longitude: 49, timestamp: 1000);
      final b = FakeBrowserGeolocation(position);
      browser = b;
      expect(await perms().getCurrentPosition(), position);
      expect(b.calls, 1);
      expect(geo.checkCalls, 0);
    });
  });

  group('camera and selected photos', () {
    test('does not require gallery permission for an authorized camera', () async {
      camera.check = const CameraPermissionStatus(camera: 'granted', photos: 'denied');
      expect(await perms().requestCameraPermission(), const PermissionResult(granted: true, status: 'granted'));
      expect(camera.requestCalls, isEmpty);
    });

    test('requests the camera only when it needs authorization', () async {
      camera.check = const CameraPermissionStatus(camera: 'prompt', photos: 'denied');
      camera.requested = const CameraPermissionStatus(camera: 'granted', photos: 'denied');
      expect((await perms().requestCameraPermission()).granted, isTrue);
      expect(camera.requestCalls, [
        ['camera']
      ]);
    });

    test('uses the system picker without demanding full-library permission', () async {
      camera.photo = 'image';
      expect(await perms().pickFromGallery(), 'data:image/jpeg;base64,image');
      expect(camera.photoCalls.single.source, 'PHOTOS');
      expect(camera.checkCalls, 0);
      expect(camera.requestCalls, isEmpty);
    });

    test('throws a typed, recognisable error when camera permission is denied', () async {
      camera.check = const CameraPermissionStatus(camera: 'denied', photos: 'denied');
      camera.requested = const CameraPermissionStatus(camera: 'denied', photos: 'denied');
      await expectLater(perms().takePhoto(), throwsA(isA<NativePermissionError>().having((e) => e.message, 'message', cameraPermissionDeniedMarker)));
      Object? thrown;
      try {
        await perms().takePhoto();
      } catch (e) {
        thrown = e;
      }
      expect(isCameraPermissionError(thrown), isTrue);
    });

    test('classifies only permission-denied errors as camera permission errors', () {
      expect(isCameraPermissionError(const NativePermissionError(cameraPermissionDeniedMarker)), isTrue);
      expect(isCameraPermissionError(const NativePermissionError('Camera permission denied')), isTrue);
      expect(isCameraPermissionError(const NativePermissionError('User cancelled photos app')), isFalse);
      expect(isCameraPermissionError(null), isFalse);
    });
  });

  group('web defaults', () {
    test('the web build lets the browser handle the camera and has no location or microphone', () async {
      const web = NativePermissions.web();
      expect(await web.requestCameraPermission(), const PermissionResult(granted: true, status: 'granted'));
      expect(await web.takePhoto(), isNull);
      expect(await web.pickFromGallery(), isNull);
      expect(await web.requestLocationPermission(), const PermissionResult(granted: false, status: 'prompt'));
      await expectLater(web.getCurrentPosition(), throwsStateError);
      expect(await web.requestMicrophonePermission(), const PermissionResult(granted: false, status: 'prompt'));
    });

    test('a cancelled native photo is not an error', () async {
      camera.check = const CameraPermissionStatus(camera: 'granted', photos: 'granted');
      final cancelling = _CancellingCamera();
      final p = NativePermissions(isNative: true, platform: 'ios', camera: cancelling);
      expect(await p.takePhoto(), isNull);
      expect(await p.pickFromGallery(), isNull);
    });
  });
}

class _CancellingCamera implements CameraPort {
  @override
  Future<CameraPermissionStatus> checkPermissions() async => const CameraPermissionStatus(camera: 'granted', photos: 'granted');
  @override
  Future<CameraPermissionStatus> requestPermissions(List<String> permissions) async => checkPermissions();
  @override
  Future<String?> getPhoto(CameraPhotoOptions options) async => throw const NativePermissionError('User cancelled photos app');
}
