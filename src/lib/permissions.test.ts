import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { getCurrentPosition, pickFromGallery, requestCameraPermission, requestLocationPermission } from './permissions';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() } }));
vi.mock('@capacitor/camera', () => ({
  Camera: { checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPhoto: vi.fn() },
  CameraResultType: { Base64: 'base64' }, CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS' },
}));
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: { checkPermissions: vi.fn(), requestPermissions: vi.fn(), getCurrentPosition: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
});

describe('location permission', () => {
  it('accepts an existing approximate grant without asking again', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
    await expect(requestLocationPermission()).resolves.toEqual({ granted: true, status: 'granted' });
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it('requests only coarse location for Android weather and accepts its grant', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
    await expect(requestLocationPermission()).resolves.toEqual({ granted: true, status: 'granted' });
    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ['coarseLocation'] });
  });

  it('uses the iOS location alias on iOS', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    await expect(requestLocationPermission()).resolves.toMatchObject({ granted: true });
    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] });
  });

  it('preserves disabled system location errors instead of returning permission denied', async () => {
    const error = { code: 'OS-PLUG-GLOC-0007', message: 'Location services are not enabled.' };
    vi.mocked(Geolocation.checkPermissions).mockRejectedValue(error);
    await expect(getCurrentPosition()).rejects.toEqual(error);
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('does not fetch a position after an actual denial', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    await expect(getCurrentPosition()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('obtains one native position without requiring precise location', async () => {
    const position = { coords: { latitude: 40, longitude: 49, accuracy: 2000, altitude: null,
      altitudeAccuracy: null, heading: null, speed: null }, timestamp: 1000 };
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'granted' });
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue(position);
    await expect(getCurrentPosition()).resolves.toEqual(position);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledExactlyOnceWith({
      enableHighAccuracy: false, timeout: 10000, maximumAge: 60000,
    });
  });

  it('uses one browser location request instead of a permission probe plus a second position', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const position = { coords: { latitude: 40, longitude: 49 }, timestamp: 1000 };
    const getPosition = vi.fn((success) => success(position));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
    await expect(getCurrentPosition()).resolves.toEqual(position);
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.checkPermissions).not.toHaveBeenCalled();
  });
});

describe('camera and selected photos', () => {
  it('does not require gallery permission for an authorized camera', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({ camera: 'granted', photos: 'denied' });
    await expect(requestCameraPermission()).resolves.toEqual({ granted: true, status: 'granted' });
    expect(Camera.requestPermissions).not.toHaveBeenCalled();
  });

  it('requests the camera only when it needs authorization', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({ camera: 'prompt', photos: 'denied' });
    vi.mocked(Camera.requestPermissions).mockResolvedValue({ camera: 'granted', photos: 'denied' });
    await expect(requestCameraPermission()).resolves.toMatchObject({ granted: true });
    expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
  });

  it('uses the system picker without demanding full-library permission', async () => {
    vi.mocked(Camera.getPhoto).mockResolvedValue({ base64String: 'image', format: 'jpeg', saved: false });
    await expect(pickFromGallery()).resolves.toBe('data:image/jpeg;base64,image');
    expect(Camera.getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: CameraSource.Photos }));
    expect(Camera.checkPermissions).not.toHaveBeenCalled();
    expect(Camera.requestPermissions).not.toHaveBeenCalled();
  });
});
