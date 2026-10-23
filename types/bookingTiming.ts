import type { Timestamp } from "firebase/firestore";

export type BookingTimingMode = "now" | "scheduled";
export type BookingUrgency = "standard" | "emergency";

/** Older bookings omit these optional fields and are treated as immediate. */
export interface BookingTimingFields {
  timingMode?: BookingTimingMode;
  urgency?: BookingUrgency;
  scheduledAt?: Timestamp | string;
}

export interface BookingTimingInput {
  timingMode: BookingTimingMode;
  urgency: BookingUrgency;
  scheduledAt?: Timestamp;
}
