// Ported from: src/lib/permissions.ts (PermissionStatus / PermissionResult, CAMERA_PERMISSION_DENIED,
//              isCameraPermissionError, requestCameraPermission, requestLocationPermission,
//              requestMicrophonePermission, takePhoto, pickFromGallery, getCurrentPosition)
//
// The permission flows of the camera, photo picker, location and microphone, over narrow plugin ports. The default
// ([NativePermissions.web]) is React's web branch: the browser handles camera permission (granted), photos fall back
// to the file input (null), there is no `navigator.geolocation` (location "prompt", getCurrentPosition fails) and no
// `getUserMedia`. The native step supplies the ports: camera / photos permission → `permission_handler`, photos →
// `image_picker` (already in pubspec), location → `geolocator`, microphone → `permission_handler` (or `record`).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/tools/media_common/media_ports.dart' show cameraPermissionDenied;

export '../../features/tools/media_common/media_ports.dart' show isCameraPermissionError;

/// 'granted' | 'denied' | 'prompt'
typedef PermissionState = String;

@immutable
class PermissionResult {
  const PermissionResult({required this.granted, required this.status});
  final bool granted;
  final PermissionState status;
  @override
  bool operator ==(Object other) => other is PermissionResult && other.granted == granted && other.status == status;
  @override
  int get hashCode => Object.hash(granted, status);
  @override
  String toString() => '{granted: $granted, status: $status}';
}

/// Stable marker for a denied camera permission ("enable in Settings" message instead of a raw error).
const String cameraPermissionDeniedMarker = cameraPermissionDenied;

/// An error with a JS-like `name` / `message` (DOMException, Capacitor plugin errors). Its text is the message, so
/// `isCameraPermissionError` (media_ports.dart) classifies it like the JS error.
class NativePermissionError implements Exception {
  const NativePermissionError(this.message, {this.name = 'Error', this.code});
  final String message;
  final String name;
  final String? code;
  @override
  String toString() => message;
}

/// `Camera.checkPermissions()` / `requestPermissions()` result.
@immutable
class CameraPermissionStatus {
  const CameraPermissionStatus({required this.camera, required this.photos});
  final String camera;
  final String photos;
}

/// `Camera.getPhoto` options.
@immutable
class CameraPhotoOptions {
  const CameraPhotoOptions({
    required this.source,
    this.quality = 85,
    this.allowEditing = false,
    this.correctOrientation,
    this.saveToGallery,
    this.width = 1024,
    this.height = 1024,
  });

  /// 'CAMERA' | 'PHOTOS'
  final String source;
  final int quality;
  final bool allowEditing;
  final bool? correctOrientation;
  final bool? saveToGallery;
  final int width;
  final int height;

  @override
  bool operator ==(Object other) =>
      other is CameraPhotoOptions &&
      other.source == source &&
      other.quality == quality &&
      other.allowEditing == allowEditing &&
      other.correctOrientation == correctOrientation &&
      other.saveToGallery == saveToGallery &&
      other.width == width &&
      other.height == height;
  @override
  int get hashCode => Object.hash(source, quality, allowEditing, correctOrientation, saveToGallery, width, height);
}

abstract interface class CameraPort {
  Future<CameraPermissionStatus> checkPermissions();
  Future<CameraPermissionStatus> requestPermissions(List<String> permissions);

  /// `getPhoto(options).base64String` (JPEG); throws on failure (a cancel carries "cancelled" in its message).
  Future<String?> getPhoto(CameraPhotoOptions options);
}

/// `Geolocation.checkPermissions()` / `requestPermissions()` result.
@immutable
class LocationPermissionStatus {
  const LocationPermissionStatus({required this.location, required this.coarseLocation});
  final String location;
  final String coarseLocation;
}

@immutable
class GeolocationOptions {
  const GeolocationOptions({this.enableHighAccuracy = false, this.timeout = const Duration(seconds: 10), this.maximumAge = const Duration(seconds: 60)});
  final bool enableHighAccuracy;
  final Duration timeout;
  final Duration maximumAge;
  @override
  bool operator ==(Object other) =>
      other is GeolocationOptions && other.enableHighAccuracy == enableHighAccuracy && other.timeout == timeout && other.maximumAge == maximumAge;
  @override
  int get hashCode => Object.hash(enableHighAccuracy, timeout, maximumAge);
}

/// `GeolocationPosition`.
@immutable
class GeoPositionData {
  const GeoPositionData({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.altitude,
    this.altitudeAccuracy,
    this.heading,
    this.speed,
    required this.timestamp,
  });
  final double latitude;
  final double longitude;
  final double? accuracy;
  final double? altitude;
  final double? altitudeAccuracy;
  final double? heading;
  final double? speed;
  final int timestamp;

  @override
  bool operator ==(Object other) =>
      other is GeoPositionData &&
      other.latitude == latitude &&
      other.longitude == longitude &&
      other.accuracy == accuracy &&
      other.altitude == altitude &&
      other.altitudeAccuracy == altitudeAccuracy &&
      other.heading == heading &&
      other.speed == speed &&
      other.timestamp == timestamp;
  @override
  int get hashCode => Object.hash(latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timestamp);
}

/// `@capacitor/geolocation`.
abstract interface class GeolocationPort {
  /// Throws when the location service is off (that is not an app denial).
  Future<LocationPermissionStatus> checkPermissions();
  Future<LocationPermissionStatus> requestPermissions(List<String> permissions);
  Future<GeoPositionData> getCurrentPosition(GeolocationOptions options);
}

/// `navigator.geolocation.getCurrentPosition` of the web build: throws a [NativePermissionError] whose [name] is
/// 'PERMISSION_DENIED' on a denial.
abstract interface class BrowserGeolocation {
  Future<GeoPositionData> getCurrentPosition(GeolocationOptions options);
}

/// `navigator.mediaDevices.getUserMedia({ audio: true })` + stopping the tracks: throws a [NativePermissionError]
/// with the DOMException name.
abstract interface class MicrophoneProbe {
  Future<void> openAndClose();
}

/// The permission flows of permissions.ts.
class NativePermissions {
  const NativePermissions({
    required this.isNative,
    required this.platform,
    this.camera,
    this.geolocation,
    this.browserGeolocation,
    this.microphone,
  });

  /// React's web branch (the default until the native plugins are wired).
  const NativePermissions.web()
      : isNative = false,
        platform = 'web',
        camera = null,
        geolocation = null,
        browserGeolocation = null,
        microphone = null;

  /// `Capacitor.isNativePlatform()`.
  final bool isNative;

  /// `Capacitor.getPlatform()`.
  final String platform;
  final CameraPort? camera;
  final GeolocationPort? geolocation;

  /// Web only; null = no `navigator.geolocation`.
  final BrowserGeolocation? browserGeolocation;

  /// null = no `getUserMedia`.
  final MicrophoneProbe? microphone;

  CameraPort get _camera => camera ?? (throw StateError('Camera plugin is not available'));
  GeolocationPort get _geo => geolocation ?? (throw StateError('Geolocation plugin is not available'));

  static const GeolocationOptions _positionOptions = GeolocationOptions();

  /// `requestCameraPermission()`.
  Future<PermissionResult> requestCameraPermission() async {
    // Web: permissions handled by the browser.
    if (!isNative) return const PermissionResult(granted: true, status: 'granted');
    try {
      final status = await _camera.checkPermissions();
      if (status.camera == 'granted') return const PermissionResult(granted: true, status: 'granted');
      final requested = await _camera.requestPermissions(const ['camera']);
      final granted = requested.camera == 'granted';
      return PermissionResult(granted: granted, status: granted ? 'granted' : 'denied');
    } catch (error) {
      debugPrint('Camera permission error: $error');
      return const PermissionResult(granted: false, status: 'denied');
    }
  }

  /// `requestLocationPermission()`: approximate location is enough (weather); a disabled location service throws
  /// and is not reported as an app denial.
  Future<PermissionResult> requestLocationPermission() async {
    if (!isNative) {
      final browser = browserGeolocation;
      if (browser == null) return const PermissionResult(granted: false, status: 'prompt');
      try {
        await browser.getCurrentPosition(const GeolocationOptions(timeout: Duration(seconds: 5)));
        return const PermissionResult(granted: true, status: 'granted');
      } on NativePermissionError catch (e) {
        return PermissionResult(granted: false, status: e.name == 'PERMISSION_DENIED' ? 'denied' : 'prompt');
      } catch (_) {
        return const PermissionResult(granted: false, status: 'prompt');
      }
    }
    final status = await _geo.checkPermissions();
    if (status.location == 'granted' || status.coarseLocation == 'granted') return const PermissionResult(granted: true, status: 'granted');
    final requested = await _geo.requestPermissions([platform == 'android' ? 'coarseLocation' : 'location']);
    final granted = requested.location == 'granted' || requested.coarseLocation == 'granted';
    return PermissionResult(granted: granted, status: granted ? 'granted' : 'denied');
  }

  /// `requestMicrophonePermission()`.
  Future<PermissionResult> requestMicrophonePermission() async {
    try {
      final mic = microphone;
      if (mic == null) throw const NativePermissionError('getUserMedia is not available', name: 'TypeError');
      await mic.openAndClose();
      return const PermissionResult(granted: true, status: 'granted');
    } catch (error) {
      debugPrint('Microphone permission error: $error');
      final name = error is NativePermissionError ? error.name : '';
      if (name == 'NotAllowedError' || name == 'PermissionDeniedError') return const PermissionResult(granted: false, status: 'denied');
      return const PermissionResult(granted: false, status: 'prompt');
    }
  }

  static String? _dataUrl(String? base64) => base64 == null || base64.isEmpty ? null : 'data:image/jpeg;base64,$base64';

  static bool _cancelled(Object error) {
    try {
      final dynamic d = error;
      return '${d.message}'.toLowerCase().contains('cancelled');
    } catch (_) {
      return false;
    }
  }

  /// `takePhoto()`: null on the web (the caller opens the file input) or when cancelled.
  Future<String?> takePhoto() async {
    if (!isNative) return null;
    try {
      final perm = await _camera.checkPermissions();
      if (perm.camera != 'granted') {
        final requested = await _camera.requestPermissions(const ['camera']);
        if (requested.camera != 'granted') throw const NativePermissionError(cameraPermissionDeniedMarker);
      }
      return _dataUrl(await _camera.getPhoto(const CameraPhotoOptions(source: 'CAMERA', correctOrientation: true, saveToGallery: false)));
    } catch (error) {
      debugPrint('Take photo error: $error');
      if (_cancelled(error)) return null;
      rethrow;
    }
  }

  /// `pickFromGallery()`: the system picker grants access to the selected image without full-library permission.
  Future<String?> pickFromGallery() async {
    if (!isNative) return null;
    try {
      return _dataUrl(await _camera.getPhoto(const CameraPhotoOptions(source: 'PHOTOS')));
    } catch (error) {
      debugPrint('Pick from gallery error: $error');
      if (_cancelled(error)) return null;
      rethrow;
    }
  }

  /// `getCurrentPosition()`: one position, coarse, 10 s timeout, 60 s maximum age.
  Future<GeoPositionData> getCurrentPosition() async {
    if (isNative) {
      final permission = await requestLocationPermission();
      if (!permission.granted) throw const NativePermissionError('Location permission denied', name: 'NotAllowedError');
      return _geo.getCurrentPosition(_positionOptions);
    }
    final browser = browserGeolocation;
    if (browser == null) throw StateError('Geolocation is unavailable');
    return browser.getCurrentPosition(_positionOptions);
  }
}

final nativePermissionsProvider = Provider<NativePermissions>((ref) => const NativePermissions.web(), name: 'nativePermissionsProvider');
