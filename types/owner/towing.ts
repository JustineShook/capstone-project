// types/owner/towing.ts
// ---------------------------------------------------------------------------
// TOWING BOOKING REQUEST
// Mirrors the shape and helpers in types/owner/booking.ts, but kept as its
// own type since towing needs different fields (pickup/destination/towing
// type/vehicle condition) instead of a mechanic "problem" category. Towing
// Uses the same public progress states as mechanic bookings so both provider
// and customer screens follow one predictable state machine.
// ---------------------------------------------------------------------------

export type TowingStatus =
  | "pending"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

// Ordered "happy path" progression, used to render the status progress bar.
// "cancelled" is a terminal side-state, not part of this ordered flow.
export const TOWING_STATUS_FLOW: TowingStatus[] = [
  "pending",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
];

export function getTowingStatusLabel(status: TowingStatus): string {
  switch (status) {
    case "pending":
      return "Waiting for provider";
    case "accepted":
      return "Provider Accepted";
    case "en_route":
      return "Tow Truck On The Way";
    case "arrived":
      return "Tow Truck Arrived";
    case "in_progress":
      return "Service In Progress";
    case "completed":
      return "Towing Completed";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Provider Rejected";
  }
}

// Short label for compact UI (e.g. under each dot in the progress bar).
export function getTowingStatusShortLabel(status: TowingStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "en_route":
      return "On The Way";
    case "arrived":
      return "Arrived";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Rejected";
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
  bookingType: "towing-company";
  customerId: string;
  customerName: string;
  customerEmail: string;
  providerId: string;
  providerName: string;
  vehicleId: string;
  vehicle: string;
  vehicleYear: number;
  vehiclePlate: string;
  latitude: number;
  longitude: number;
  providerLatitude: number;
  providerLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  providerToPickupDistanceKm: number;
  pickupToDestinationDistanceKm: number;
  totalDistanceKm: number;
  basePrice: number;
  pricePerKm: number;
  distanceCharge: number;
  estimatedTotalPrice: number;
  /** Legacy bracket-pricing fields retained when reading historical bookings. */
  pricingBracketId?: string;
  estimatedPrice?: number;
  pickupLocation: string;
  destination: string;
  towingType: string;
  vehicleCondition: string;
  notes: string;
  startingPrice: string;
  status: TowingStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  // These two are populated at read time by merging in a record from
  // services/owner/towingRatingService.ts — not written here directly.
   rating?: number; // 1-5
  comment?: string; // optional written review
  ratedAt?: string; // ISO timestamp
}
