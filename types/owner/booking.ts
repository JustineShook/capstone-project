// types/owner/booking.ts
// ---------------------------------------------------------------------------
// BOOKING REQUEST
// Shared shape for a service request from an owner to a provider. Every
// field is a plain, serializable value (no functions, no class instances),
// so this object maps directly onto a future Firestore document — no
// reshaping needed once bookingService swaps its mock store for real reads
// and writes.
// ---------------------------------------------------------------------------

export type BookingStatus =
  | "pending"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

// Ordered "happy path" progression, used to render a status timeline.
// "cancelled" is a terminal side-state, not part of this ordered flow.
export const BOOKING_STATUS_FLOW: BookingStatus[] = [
  "pending",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
];

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return "Waiting for provider";
    case "accepted":
      return "Provider Accepted";
    case "on_the_way":
      return "Provider On The Way";
    case "arrived":
      return "Provider Arrived";
    case "in_progress":
      return "Service In Progress";
    case "completed":
      return "Service Completed";
    case "cancelled":
      return "Cancelled";
  }
}

// Shorter labels for the progress-bar dots on the booking-detail screen,
// where full labels ("Provider On The Way") don't fit under a small dot.
export function getBookingStatusShortLabel(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return "Requested";
    case "accepted":
      return "Accepted";
    case "on_the_way":
      return "On The Way";
    case "arrived":
      return "Arrived";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export interface BookingRequest {
  id: string;
  providerId: string;
  vehicleId: string;
  problem: string;
  notes: string;
  startingPrice: string;
  status: BookingStatus;
  createdAt: string; // ISO timestamp

  // Populated at read time via ratingService's mergeRating() — ratings live
  // in their own store (services/owner/ratingService.ts), not written here
  // directly. See that file's header comment for why.
  rating?: number;
  comment?: string;
  ratedAt?: string; // ISO timestamp
}