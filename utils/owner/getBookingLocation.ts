import * as Location from "expo-location";
import { Platform } from "react-native";

/**
 * App acceptance policy for a NEW mechanic booking, not platform guarantees:
 * - fix age <= 10 seconds; allow at most 1 second of future clock skew;
 * - reported horizontal uncertainty radius <= 50 metres (unknown is rejected);
 * - 3 attempts, each bounded to 10 seconds, including native watcher startup.
 * Permission prompting remains in the booking screen, outside this 30s budget.
 * SDK 54 defines coords.accuracy in metres and timestamp in epoch milliseconds:
 * https://docs.expo.dev/versions/v54.0.0/sdk/location/#locationobject
 * Browser cache/timeout options:
 * https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
 * No cached/profile-address fallback; temporary native listeners are removed.
 */
export const BOOKING_LOCATION_LIMITS = {
  maxAgeMs: 10_000,
  maxAccuracyMeters: 50,
  futureToleranceMs: 1_000,
  attemptTimeoutMs: 10_000,
  maxAttempts: 3,
} as const;

type BookingLocation = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

class CaptureError extends Error {
  constructor(message: string, readonly retryable = true) { super(message); }
}

function invalidFixReason(fix: BookingLocation): string | null {
  const { latitude, longitude, accuracy } = fix.coords;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "The device returned invalid GPS coordinates.";
  }
  const age = Date.now() - fix.timestamp;
  if (!Number.isFinite(fix.timestamp) || fix.timestamp <= 0
    || age > BOOKING_LOCATION_LIMITS.maxAgeMs || age < -BOOKING_LOCATION_LIMITS.futureToleranceMs) {
    return "The GPS position is out of date or has an invalid timestamp.";
  }
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0) {
    return "The device did not report a valid GPS accuracy.";
  }
  if (accuracy > BOOKING_LOCATION_LIMITS.maxAccuracyMeters) {
    return `GPS uncertainty is ${Math.ceil(accuracy)} metres; 50 metres or better is required.`;
  }
  return null;
}

function captureAttempt(): Promise<BookingLocation> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    let lastReason = "Getting a GPS position took too long.";
    const finish = (error?: CaptureError, fix?: BookingLocation) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription?.remove();
      if (error) reject(error); else resolve(fix!);
    };
    const timer = setTimeout(() => finish(new CaptureError(lastReason)), BOOKING_LOCATION_LIMITS.attemptTimeoutMs);
    const accept = (fix: BookingLocation) => {
      if (finished) return;
      const reason = invalidFixReason(fix);
      if (reason) {
        lastReason = reason;
        // The browser call supplies only one fix; native can improve its fix
        // during this same bounded attempt without opening another listener.
        if (Platform.OS === "web") finish(new CaptureError(reason));
      } else finish(undefined, fix);
    };

    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        finish(new CaptureError("GPS is unavailable in this browser. Use a browser with location access enabled.", false));
        return;
      }
      try { navigator.geolocation.getCurrentPosition(
        position => accept({ coords: position.coords, timestamp: position.timestamp }),
        error => finish(new CaptureError(error.code === 1
          ? "Location permission was denied. Allow location access in your browser settings before trying again."
          : "Your GPS position is unavailable or timed out.", error.code !== 1)),
        { enableHighAccuracy: true, maximumAge: 0, timeout: BOOKING_LOCATION_LIMITS.attemptTimeoutMs },
      ); } catch {
        finish(new CaptureError("Could not access browser GPS. Enable location access and try again.", false));
      }
      return;
    }

    // A short-lived foreground watcher is cancellable, unlike a native
    // getCurrentPositionAsync call. It never publishes customer coordinates.
    const nativeFailure = (error: unknown) => {
      const denied = /denied|unauthori[sz]ed|permission/i.test(String(error));
      finish(new CaptureError(denied
        ? "Location permission is unavailable. Enable location access in device settings before trying again."
        : "Could not get a GPS position. Check device location settings.", !denied));
    };
    void (async () => {
      try {
        const watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 1_000 },
          accept,
          nativeFailure,
        );
        if (finished) watcher.remove(); else subscription = watcher;
      } catch (error) {
        nativeFailure(error);
      }
    })();
  });
}

export async function getBookingLocation(): Promise<BookingLocation> {
  let lastError = "No suitable GPS position was received.";
  for (let attempt = 0; attempt < BOOKING_LOCATION_LIMITS.maxAttempts; attempt++) {
    try { return await captureAttempt(); }
    catch (error) {
      if (error instanceof CaptureError && !error.retryable) throw error;
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(`${lastError} Booking was not sent. Move to an open area, enable precise location if available, and tap Confirm Booking to retry.`);
}
