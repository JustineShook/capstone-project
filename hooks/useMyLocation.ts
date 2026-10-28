// hooks/useMyLocation.ts
import * as Location from "expo-location";
import { PermissionStatus } from "expo-modules-core";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Platform } from "react-native";

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

  const getBrowserLocationError = (code?: number, message?: string) => {
    if (code === 1) return "Location permission was denied. Allow location access in your browser settings and try again.";
    if (code === 2) return "Your location is unavailable. Check your device's location settings and try again.";
    if (code === 3) return "Getting your location took too long. Check your connection and try again.";
    return message || "We couldn't get your current location. Please try again.";
  };

  const startWatcher = async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    if (!activeRef.current) return;

    if (Platform.OS === "web") {
      if (!navigator.geolocation) {
        setError("Location is not available in this browser.");
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!activeRef.current) return;
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setError(null);
        },
        (reason) => {
          if (activeRef.current) setError(getBrowserLocationError(reason.code, reason.message));
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
      );

      // Use the browser's matching cleanup API instead of Expo Location's
      // web subscription cleanup, which calls an unavailable emitter method.
      watcherRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      return;
    }

    const watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced },
      (update) => {
        if (activeRef.current) {
          setLocation(toLatLng(update));
          setError(null);
        }
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
      if (!activeRef.current) return;
      if (permission.status !== PermissionStatus.GRANTED) {
        setPermissionGranted(false);
        setLocation(null);
        setError(
          permission.status === PermissionStatus.DENIED
            ? Platform.OS === "web"
              ? "Location permission was denied. Allow location access in your browser settings to see your current position and nearby providers."
              : "Location permission was denied. Enable location access in your device settings to see your current position and nearby providers."
            : Platform.OS === "web"
              ? "Location access is unavailable in this browser."
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
      if (!activeRef.current) return;

      // Fresh fix.
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!activeRef.current) return;
      if (activeRef.current) setLocation(toLatLng(current));

      setLoading(false);

      if (watch && activeRef.current) {
        await startWatcher();
      }
    } catch (err) {
      if (activeRef.current) {
        setError(
          Platform.OS === "web" && typeof err === "object" && err !== null && "code" in err
            ? getBrowserLocationError(Number(err.code), "message" in err ? String(err.message) : undefined)
            : err instanceof Error
              ? err.message
              : "We couldn't get your current location. Please try again."
        );
        setLoading(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      void loadPosition();

      return () => {
        activeRef.current = false;
        watcherRef.current?.remove();
        watcherRef.current = null;
      };
      // loadPosition is intentionally scoped to this focus session.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const refresh = async () => {
    await loadPosition();
  };

  return { location, loading, error, permissionGranted, refresh };
}
