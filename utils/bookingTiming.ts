import { Timestamp } from "firebase/firestore";
import type { BookingTimingInput, BookingTimingMode, BookingUrgency } from "../types/bookingTiming";

export const BOOKING_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_HOURS = 8;

function manilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
}

export function createManilaSlot(dayOffset: number, hour: number, now = new Date()): Date {
  const p = manilaParts(now);
  const day = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + dayOffset));
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - MANILA_OFFSET_HOURS));
}

export function getManilaDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: BOOKING_TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(date);
}

export function getManilaTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: BOOKING_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(date);
}

export function getManilaDayKey(date: Date): string {
  const parts = manilaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getManilaHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: BOOKING_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function formatBookingTimingLabel(value: {
  timingMode?: BookingTimingMode;
  urgency?: BookingUrgency;
  scheduledAt?: Date | Timestamp | string;
}): string {
  if (value.timingMode === "scheduled" && value.scheduledAt) {
    const date = value.scheduledAt instanceof Timestamp ? value.scheduledAt.toDate()
      : value.scheduledAt instanceof Date ? value.scheduledAt : new Date(value.scheduledAt);
    return `Scheduled \u00B7 ${new Intl.DateTimeFormat("en-PH", {
      timeZone: BOOKING_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(date)}`;
  }
  return value.urgency === "emergency" ? "Emergency" : "Now";
}

export function validateBookingTiming(input: BookingTimingInput, emergencyAvailable: boolean, acceptsScheduled: boolean) {
  if (input.timingMode === "scheduled") {
    if (!acceptsScheduled) throw new Error("This provider is not accepting scheduled bookings.");
    if (!input.scheduledAt || input.scheduledAt.toMillis() <= Date.now()
      || input.scheduledAt.toMillis() % 3_600_000 !== 0) {
      throw new Error("Choose a future appointment start on the hour in Manila time.");
    }
    return;
  }
  if (input.urgency === "emergency" && !emergencyAvailable) {
    throw new Error("This provider is not accepting emergency requests.");
  }
}

export function timingFields(input: BookingTimingInput) {
  return {
    timingMode: input.timingMode,
    urgency: input.timingMode === "now" ? input.urgency : "standard" as const,
    ...(input.timingMode === "scheduled" && input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
  };
}

/** A scheduled request is ready only after the owner picks a valid future hour. */
export function isBookingTimingReady(input: BookingTimingInput | null, now = Date.now()): boolean {
  if (!input) return false;
  if (input.timingMode === "now") return true;
  if (!input.scheduledAt) return false;
  const timestamp = input.scheduledAt.toMillis();
  return timestamp > now && timestamp % 3_600_000 === 0;
}

/** Changing the day invalidates the previously selected hour. */
export function clearScheduledHour(): BookingTimingInput {
  return { timingMode: "scheduled", urgency: "standard" };
}

export function providerSlotReservationId(providerId: string, scheduledAt: Timestamp): string {
  return `${providerId}_${scheduledAt.toMillis()}`;
}
