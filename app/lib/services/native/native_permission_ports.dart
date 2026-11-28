// Ported from: node_modules/@capacitor/camera (checkPermissions / requestPermissions / getPhoto),
//              node_modules/@capacitor/geolocation (checkPermissions — throws "Location services are not enabled" —,
//              requestPermissions, getCurrentPosition with enableHighAccuracy / timeout / maximumAge), the WebView's
//              getUserMedia permission prompt (requestMicrophonePermission), src/hooks/useSOSAlert.ts
//              (getCurrentLocation)
//
// The plugin ports of [NativePermissions] in the app build: camera / photos / microphone permissions through
// permission_handler, photos through image_picker, location through geolocator. Capacitor permission states:
// 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'.
import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../features/partner/partner_ports.dart' show SosLocation;
import 'mobile_host.dart';
import 'permissions.dart';

/// permission_handler status → Capacitor state (`denied` before the first prompt is Capacitor's `prompt`).
Future<String> capacitorPermissionState(Permission permission) async {
  final status = await permission.status;
  if (status.isGranted || status.isLimited || status.isProvisional) return 'granted';
  if (status.isPermanentlyDenied || status.isRestricted) return 'denied';
  if (isAndroidHost && await permission.shouldShowRequestRationale) return 'prompt-with-rationale';
  return 'prompt';
}

class PluginCameraPort implements CameraPort {
  const PluginCameraPort();

  Future<CameraPermissionStatus> _status() async =>
      CameraPermissionStatus(camera: await capacitorPermissionState(Permission.camera), photos: await capacitorPermissionState(Permission.photos));

  @override
  Future<CameraPermissionStatus> checkPermissions() => _status();

  @override
  Future<CameraPermissionStatus> requestPermissions(List<String> permissions) async {
    if (permissions.contains('camera')) await Permission.camera.request();
    if (permissions.contains('photos')) await Permission.photos.request();
    return _status();
  }

  /// `getPhoto` → base64 JPEG; null when the user closes the camera / picker.
  @override
  Future<String?> getPhoto(CameraPhotoOptions options) async {
    final file = await ImagePicker().pickImage(
      source: options.source == 'CAMERA' ? ImageSource.camera : ImageSource.gallery,
      maxWidth: options.width.toDouble(),
      maxHeight: options.height.toDouble(),
      imageQuality: options.quality,
    );
    if (file == null) return null;
    return base64Encode(await file.readAsBytes());
  }
}

String _locationState(LocationPermission p) => switch (p) {
      LocationPermission.always || LocationPermission.whileInUse => 'granted',
      LocationPermission.deniedForever => 'denied',
      LocationPermission.denied || LocationPermission.unableToDetermine => 'prompt',
    };

class PluginGeolocationPort implements GeolocationPort {
  const PluginGeolocationPort();

  Future<void> _requireService() async {
    if (!await Geolocator.isLocationServiceEnabled()) throw const NativePermissionError('Location services are not enabled');
  }

  @override
  Future<LocationPermissionStatus> checkPermissions() async {
    await _requireService();
    final state = _locationState(await Geolocator.checkPermission());
    return LocationPermissionStatus(location: state, coarseLocation: state);
  }

  /// Android asks for fine + coarse together (the system dialog offers "approximate"); Capacitor asked for
  /// coarse only there.
  @override
  Future<LocationPermissionStatus> requestPermissions(List<String> permissions) async {
    await _requireService();
    final state = _locationState(await Geolocator.requestPermission());
    return LocationPermissionStatus(location: state, coarseLocation: state);
  }

  @override
  Future<GeoPositionData> getCurrentPosition(GeolocationOptions options) async {
    if (options.maximumAge > Duration.zero) {
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null && DateTime.now().difference(last.timestamp) <= options.maximumAge) return _data(last);
      } catch (_) {
        // fall through to a fresh fix
      }
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: options.enableHighAccuracy ? LocationAccuracy.high : LocationAccuracy.low,
        timeLimit: options.timeout,
      ),
    );
    return _data(position);
  }

  static GeoPositionData _data(Position p) => GeoPositionData(
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        altitude: p.altitude,
        altitudeAccuracy: p.altitudeAccuracy,
        heading: p.heading,
        speed: p.speed,
        timestamp: p.timestamp.millisecondsSinceEpoch,
      );
}

/// The WebView's getUserMedia permission: a denial is a `NotAllowedError`.
class PluginMicrophoneProbe implements MicrophoneProbe {
  const PluginMicrophoneProbe();
  @override
  Future<void> openAndClose() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted && !status.isLimited) throw const NativePermissionError('Permission denied', name: 'NotAllowedError');
  }
}

/// [NativePermissions] of the app build.
NativePermissions pluginNativePermissions() => NativePermissions(
      isNative: true,
      platform: isIOSHost ? 'ios' : 'android',
      camera: const PluginCameraPort(),
      geolocation: const PluginGeolocationPort(),
      microphone: const PluginMicrophoneProbe(),
    );

/// `getCurrentLocation()` of useSOSAlert: Geolocation permission (`location` must be granted), one high-accuracy fix
/// within 10 s; null on a denial or any failure (the alert is sent without coordinates).
Future<SosLocation?> sosCurrentLocation() async {
  try {
    const port = PluginGeolocationPort();
    final permission = await port.checkPermissions();
    if (permission.location != 'granted') {
      final request = await port.requestPermissions(const ['location']);
      if (request.location != 'granted') return null;
    }
    final position = await port.getCurrentPosition(
      const GeolocationOptions(enableHighAccuracy: true, timeout: Duration(seconds: 10), maximumAge: Duration.zero),
    );
    return SosLocation(latitude: position.latitude, longitude: position.longitude);
  } catch (_) {
    return null;
  }
}
