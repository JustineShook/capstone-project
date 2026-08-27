// types/owner/towing.ts
// ---------------------------------------------------------------------------
// TOWING BOOKING REQUEST
// Mirrors the shape and helpers in types/owner/booking.ts, but kept as its
// own type since towing needs different fields (pickup/destination/towing
// type/vehicle condition) instead of a mechanic "problem" category. Towing
// also has its own status flow — it uses "in_transit" instead of
// "in_progress" since the vehicle is being transported, not repaired.
// ---------------------------------------------------------------------------

export type TowingStatus =
  | "pending"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_transit"
  | "completed"
  | "cancelled";

// Ordered "happy path" progression, used to render the status progress bar.
// "cancelled" is a terminal side-state, not part of this ordered flow.
export const TOWING_STATUS_FLOW: TowingStatus[] = [
  "pending",
  "accepted",
  "on_the_way",
  "arrived",
  "in_transit",
  "completed",
];

export function getTowingStatusLabel(status: TowingStatus): string {
  switch (status) {
    case "pending":
      return "Waiting for provider";
    case "accepted":
      return "Provider Accepted";
    case "on_the_way":
      return "Tow Truck On The Way";
    case "arrived":
      return "Tow Truck Arrived";
    case "in_transit":
      return "Vehicle In Transit";
    case "completed":
      return "Towing Completed";
    case "cancelled":
      return "Cancelled";
  }
}

// Short label for compact UI (e.g. under each dot in the progress bar).
export function getTowingStatusShortLabel(status: TowingStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "on_the_way":
      return "On The Way";
    case "arrived":
      return "Arrived";
    case "in_transit":
      return "In Transit";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

// Towing method the provider will use to move the vehicle.
export const TOWING_TYPES = [
  "Flatbed Towing",
  "Wheel-Lift Towing",
  "Motorcycle Towing",
  "Emergency Towing",
] as const;

export type TowingType = (typeof TOWING_TYPES)[number];

// Condition of the vehicle, reported by the owner before the tow truck
// arrives — helps the provider bring the right equipment.
export const VEHICLE_CONDITIONS = [
  "Vehicle can move",
  "Vehicle cannot move",
  "Vehicle badly damaged",
  "Accident vehicle",
] as const;

export type VehicleCondition = (typeof VEHICLE_CONDITIONS)[number];

export interface TowingBookingRequest {
  id: string;
  providerId: string;
  vehicleId: string;
  pickupLocation: string;
  destination: string;
  towingType: string;
  vehicleCondition: string;
  notes: string;
  startingPrice: string;
  status: TowingStatus;
  createdAt: string; // ISO timestamp
  // These two are populated at read time by merging in a record from
  // services/owner/towingRatingService.ts — not written here directly.
   rating?: number; // 1-5
  comment?: string; // optional written review
  ratedAt?: string; // ISO timestamp
}