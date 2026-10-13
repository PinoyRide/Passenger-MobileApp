import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureLocationPermission } from '@/Utils/Permissions';
import Geolocation from 'react-native-geolocation-service';

/**
 * Custom hook to handle location permission and fetching
 *
 * @param {boolean} requestOnMount - Whether to request location when component mounts (default: true)
 * @param {object} options - Geolocation options
 * @returns {object} Location state and methods
 *
 * @example
 * const { location, loading, error, permissionStatus, requestLocation } = useLocation();
 *
 * @example
 * // Don't request on mount, request manually
 * const { location, requestLocation } = useLocation(false);
 */
const DEFAULT_LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 10000,
};

export const useLocation = (
  requestOnMount = true,
  options = DEFAULT_LOCATION_OPTIONS,
) => {
  // The default options object used to be re-created every render, which
  // re-created requestLocation and re-ran the mount effect after every
  // setState: an endless request/error loop (froze "Choose from Map" on web
  // with location blocked). Keep options in a ref so the request is stable.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const requestedOnMountRef = useRef(false);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(requestOnMount);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Request permission
      const permission = await ensureLocationPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        // Get current location
        Geolocation.getCurrentPosition(
          position => {
            console.log('Got location:', position);
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            });
            setLoading(false);
            setError(null);
          },
          err => {
            console.log('Location watch failed:', err);
            console.error('Geolocation error:', err);
            setError(err.message || 'Failed to get location');
            setLoading(false);
          },
          optionsRef.current,
        );
      } else {
        // Permission not granted
        setLoading(false);
        if (permission === 'blocked') {
          setError(
            'Location permission is blocked. Please enable it in Settings.',
          );
        } else if (permission === 'denied') {
          setError('Location permission denied.');
        } else {
          setError('Location services are unavailable.');
        }
      }
    } catch (err) {
      console.error('Location request error:', err);
      setError(err.message || 'Failed to request location');
      setLoading(false);
    }
  }, []);

  // Request location once on mount if enabled (no retry on error/denied;
  // callers can call requestLocation() again explicitly).
  useEffect(() => {
    if (requestOnMount && !requestedOnMountRef.current) {
      requestedOnMountRef.current = true;
      requestLocation();
    }
  }, [requestOnMount, requestLocation]);

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestLocation,
  };
};

/**
 * Hook for watching location changes in real-time
 *
 * @param {boolean} enabled - Whether to start watching immediately
 * @returns {object} Location state and methods
 *
 * @example
 * const { location, watching, startWatching, stopWatching } = useLocationWatch();
 */
export const useLocationWatch = (enabled = false) => {
  const [location, setLocation] = useState(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const watchIdRef = useRef(null);

  const startWatching = useCallback(async () => {
    try {
      const permission = await ensureLocationPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const watchId = Geolocation.watchPosition(
          position => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            });
            setError(null);
          },
          err => {
            console.error('Location watch error:', err);
            setError(err.message);
            // Permission denied won't recover by itself; stop the watch so
            // it doesn't keep firing errors (seen on web with location blocked).
            if (err?.code === 1 && watchIdRef.current !== null) {
              Geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
              setWatching(false);
            }
          },
          {
            enableHighAccuracy: true,
            distanceFilter: 10, // Update every 10 meters
            interval: 5000, // Update every 5 seconds (Android)
            fastestInterval: 2000, // Fastest update interval (Android)
          },
        );

        watchIdRef.current = watchId;
        setWatching(true);
      } else {
        setError('Location permission not granted');
      }
    } catch (err) {
      console.error('Start watching error:', err);
      setError(err.message);
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startWatching();
    }

    return () => {
      stopWatching();
    };
  }, [enabled]);

  return {
    location,
    watching,
    error,
    permissionStatus,
    startWatching,
    stopWatching,
  };
};
