import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

// Permission status types
export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionResult {
  granted: boolean;
  status: PermissionStatus;
}

/**
 * Check and request camera permissions
 */
export async function requestCameraPermission(): Promise<PermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    // Web platform - permissions handled by browser
    return { granted: true, status: 'granted' };
  }

  try {
    const status = await Camera.checkPermissions();
    
    if (status.camera === 'granted') {
      return { granted: true, status: 'granted' };
    }

    // Request permissions
    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    
    const granted = requested.camera === 'granted';
    return { 
      granted, 
      status: granted ? 'granted' : 'denied' 
    };
  } catch (error) {
    console.error('Camera permission error:', error);
    return { granted: false, status: 'denied' };
  }
}

/**
 * Check and request location permissions
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    // Web platform - use standard geolocation API
    if (!navigator.geolocation) return { granted: false, status: 'prompt' };
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true, status: 'granted' }),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve({ granted: false, status: 'denied' });
          } else {
            resolve({ granted: false, status: 'prompt' });
          }
        },
        { timeout: 5000 }
      );
    });
  }

  // Approximate location is sufficient for weather. A disabled location
  // service throws separately; it must not be reported as an app denial.
  const status = await Geolocation.checkPermissions();
  if (status.location === 'granted' || status.coarseLocation === 'granted') {
    return { granted: true, status: 'granted' };
  }

  const requested = await Geolocation.requestPermissions({
    permissions: [Capacitor.getPlatform() === 'android' ? 'coarseLocation' : 'location'],
  });
  const granted = requested.location === 'granted' || requested.coarseLocation === 'granted';
  return { granted, status: granted ? 'granted' : 'denied' };
}

/**
 * Check and request microphone permissions
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  try {
    // For both web and native, we use the MediaDevices API
    // On native, this will trigger the system permission dialog
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Stop the stream immediately - we just needed to request permission
    stream.getTracks().forEach(track => track.stop());
    
    return { granted: true, status: 'granted' };
  } catch (error) {
    console.error('Microphone permission error:', error);
    const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { granted: false, status: 'denied' };
    }
    
    return { granted: false, status: 'prompt' };
  }
}

/**
 * Take a photo using the camera (native or web)
 */
export async function takePhoto(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback - return null to trigger file input
    return null;
  }

  try {
    // Request permissions first on native
    const permStatus = await Camera.checkPermissions();
    
    if (permStatus.camera !== 'granted') {
      const requested = await Camera.requestPermissions({ permissions: ['camera'] });
      if (requested.camera !== 'granted') {
        throw new Error('Camera permission denied');
      }
    }

    // Use Capacitor Camera plugin for native
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
      saveToGallery: false,
      width: 1024,
      height: 1024,
    });

    if (image.base64String) {
      return `data:image/jpeg;base64,${image.base64String}`;
    }
    return null;
  } catch (error) {
    console.error('Take photo error:', error);
    // If user cancelled, don't throw
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.toLowerCase().includes('cancelled')) {
      return null;
    }
    throw error;
  }
}

/**
 * Pick a photo from gallery (native or web)
 */
export async function pickFromGallery(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback - return null to trigger file input
    return null;
  }

  try {
    // The system picker grants access to the selected image without requiring
    // full-library access (including Android Photo Picker and iOS limited access).
    const image = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      width: 1024,
      height: 1024,
    });

    if (image.base64String) {
      return `data:image/jpeg;base64,${image.base64String}`;
    }
    return null;
  } catch (error) {
    console.error('Pick from gallery error:', error);
    // If user cancelled, don't throw
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.toLowerCase().includes('cancelled')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get current position with proper permission handling
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (Capacitor.isNativePlatform()) {
    const permission = await requestLocationPermission();
    if (!permission.granted) {
      throw new DOMException('Location permission denied', 'NotAllowedError');
    }
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });

    // Convert Capacitor position to standard GeolocationPosition format
    return {
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
      },
      timestamp: position.timestamp,
    } as GeolocationPosition;
  } else {
    if (!navigator.geolocation) throw new Error('Geolocation is unavailable');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
  }
}

const readFileAsDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
  reader.readAsDataURL(file);
});

/**
 * Read a picked image file as a data URL, downscaled to at most `maxSide` px on
 * the longest side (JPEG, `quality`). Keeps preview/upload state around a few
 * hundred KB instead of a multi-MB base64 string. Small images and anything the
 * WebView cannot decode fall back to the original data URL unchanged.
 * (Native camera/gallery results are already bounded via Camera.getPhoto width/height.)
 */
export async function readImageFileAsDataUrl(file: File, maxSide = 1280, quality = 0.85): Promise<string> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return readFileAsDataUrl(file);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      element.src = objectUrl;
    });
    const width = image.naturalWidth, height = image.naturalHeight;
    const longest = Math.max(width, height);
    // Already small: keep the original bytes/format (no re-encode quality loss).
    if (!longest || (longest <= maxSide && file.size <= 1.5 * 1024 * 1024)) return readFileAsDataUrl(file);
    const scale = Math.min(1, maxSide / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return readFileAsDataUrl(file);
    context.fillStyle = '#fff'; // JPEG has no alpha — flatten transparent PNGs onto white
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 0; canvas.height = 0; // release the backing store promptly
    return dataUrl.startsWith('data:image/jpeg') ? dataUrl : readFileAsDataUrl(file);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
