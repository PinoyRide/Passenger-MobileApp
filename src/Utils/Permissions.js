import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
  request,
} from 'react-native-permissions';
import appAlert from '@/Utils/appAlert';

export const LOCATION_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
});

export const CAMERA_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
});

// ============================================================================
// LOCATION PERMISSIONS
// ============================================================================

// Check location permission status (does NOT request)
export async function checkLocationPermission() {
  const status = await check(LOCATION_PERMISSION);

  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

// Request Location Permission
export async function requestLocationPermission() {
  const result = await request(LOCATION_PERMISSION);

  switch (result) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

// Check location first, only ask if needed
export async function ensureLocationPermission() {
  const status = await check(LOCATION_PERMISSION);

  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked'; // user must go to settings
    case RESULTS.DENIED:
      return await requestLocationPermission(); // now request
    default:
      return 'unavailable';
  }
}

// ============================================================================
// CAMERA PERMISSIONS
// ============================================================================

// Check camera permission status (does NOT request)
export async function checkCameraPermission() {
  const status = await check(CAMERA_PERMISSION);

  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

// Request Camera Permission
export async function requestCameraPermission() {
  const result = await request(CAMERA_PERMISSION);

  switch (result) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

// Check first, then request ONLY IF denied
export async function ensureCameraPermission() {
  const status = await check(CAMERA_PERMISSION);

  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked'; // requires settings
    case RESULTS.DENIED:
      return await requestCameraPermission();
    default:
      return 'unavailable';
  }
}

// Ask for the camera at the moment it is needed (Google Play expects permission requests in
// context, not at app start), then run `onGranted`. Explains and offers Settings otherwise.
export async function withCameraPermission(onGranted, reason) {
  const status = await ensureCameraPermission();
  if (status === 'granted') {
    onGranted();
    return;
  }
  const message =
    reason ||
    'Camera access is needed to take this photo for identity verification.';
  if (status === 'blocked') {
    appAlert(
      'Camera Access Blocked',
      `${message} Please enable it in Settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openSettings() },
      ],
      { icon: 'camera-off-outline' },
    );
    return;
  }
  appAlert('Camera Access Needed', message, undefined, {
    icon: 'camera-off-outline',
  });
}
