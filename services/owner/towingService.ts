// services/owner/towingService.ts
import { TowingBookingRequest } from "../../types/owner/towing";

// ---------------------------------------------------------------------------
// MOCK TOWING BOOKING SERVICE
// Same pattern as services/owner/bookingService.ts (mechanic bookings), kept
// as a separate file/store since towing is a separate booking type. Every
// function is already async and keyed by plain IDs/inputs, matching how a
// Firestore-backed version would read (getDoc/onSnapshot) and write
// (addDoc/updateDoc) later.
//
// Ratings are intentionally NOT handled here — see
// services/owner/towingRatingService.ts, which keeps its own store keyed by
// bookingId and is merged into a booking at read time.
// ---------------------------------------------------------------------------

let mockTowingBookings: TowingBookingRequest[] = [];

export interface CreateTowingBookingInput {
  providerId: string;
  vehicleId: string;
  pickupLocation: string;
  destination: string;
  towingType: string;
  vehicleCondition: string;
  notes: string;
  startingPrice: string;
}

export async function createTowingBooking(
  input: CreateTowingBookingInput
): Promise<TowingBookingRequest> {
  const booking: TowingBookingRequest = {
    id: `tow-${Date.now()}`,
    providerId: input.providerId,
    vehicleId: input.vehicleId,
    pickupLocation: input.pickupLocation,
    destination: input.destination,
    towingType: input.towingType,
    vehicleCondition: input.vehicleCondition,
    notes: input.notes,
    startingPrice: input.startingPrice,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
  mockTowingBookings = [...mockTowingBookings, booking];
  return booking;
}

export async function getTowingBookingById(
  id: string
): Promise<TowingBookingRequest | undefined> {
  return mockTowingBookings.find((b) => b.id === id);
}

export async function updateTowingBookingStatus(
  id: string,
  status: TowingBookingRequest["status"]
): Promise<TowingBookingRequest | undefined> {
  let updated: TowingBookingRequest | undefined;
  mockTowingBookings = mockTowingBookings.map((b) => {
    if (b.id !== id) return b;
    updated = { ...b, status };
    return updated;
  });
  return updated;
}