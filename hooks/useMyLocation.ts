// hooks/useMyLocation.ts
import * as Location from "expo-location";
import { PermissionStatus } from "expo-modules-core";
import { useEffect, useRef, useState } from "react";

export interface MyLocationState {
  /** User's current GPS position, or null until the first fix arrives. */
  location: { lat: number; lng: number } | null;
  /** True while the permission prompt / first position fix is in flight. */
  loading: boolean;
  /** Human-readable error if permission is denied or location can't be resolved. Null when all good. */
  error: string | null;
  /** True once foreground permission has been granted. */
  permissionGranted: boolean;
  /** Re-runs the whole permission + position flow (e.g. after the user fixes settings). */
  refresh: () => Promise<void>;
}

interface UseMyLocationOptions {
  /** When true (default), subscribes to continuous position updates via watchPositionAsync. */
  watch?: boolean;
}

/**
 * Requests foreground location permission, obtains the current GPS position,
 * and optionally subscribes to continuous updates.
 *
 * The watcher is properly cleaned up on unmount. Permission-denied and
 * location-error cases are folded into a single `error: string | null`
 * field so screens can render a small banner without knowing about
 * expo-location internals.
 */
export function useMyLocation({ watch = true }: UseMyLocationOptions = {}) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const activeRef = useRef(true);

  const toLatLng = (l: Location.LocationObject) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
  });

  const startWatcher = async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;

    const watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced },
      (update) => {
        if (activeRef.current) setLocation(toLatLng(update));
      },
      (reason) => {
        if (activeRef.current) setError(`Unable to get your live position: ${reason}`);
      }
    );

    if (activeRef.current) {
      watcherRef.current = watcher;
    } else {
      watcher.remove();
    }
  };

  const loadPosition = async () => {
    setLoading(true);
    setError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== PermissionStatus.GRANTED) {
        setPermissionGranted(false);
        setLocation(null);
        setError(
          permission.status === PermissionStatus.DENIED
            ? "Location permission was denied. Enable location access in your device settings to see your current position and nearby providers."
            : "Location access is unavailable on this device."
        );
        setLoading(false);
        return;
      }

      setPermissionGranted(true);

      // Fast first paint if the OS already has a recent position.
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        if (lastKnown && activeRef.current) setLocation(toLatLng(lastKnown));
      } catch {
        // Optimization only — ignore failures.
      }

      // Fresh fix.
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (activeRef.current) setLocation(toLatLng(current));

      setLoading(false);

      if (watch) {
        await startWatcher();
      }
    } catch (err) {
      if (activeRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't get your current location. Please try again."
        );
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    activeRef.current = true;
    loadPosition();

    return () => {
      activeRef.current = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    await loadPosition();
  };

  return { location, loading, error, permissionGranted, refresh };
}