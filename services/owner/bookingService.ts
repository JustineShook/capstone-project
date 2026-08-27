// services/owner/bookingService.ts
import { BookingRequest } from "../../types/owner/booking";

// ---------------------------------------------------------------------------
// MOCK BOOKING SERVICE
// Stands in for a real backend. Every function here is already async and
// keyed by plain IDs/inputs — matching how a Firestore-backed version would
// read (getDoc/onSnapshot) and write (addDoc/updateDoc). Call sites
// (book-mechanic, booking-confirmation, booking-detail) never touch the
// storage directly, so only this file needs to change when it's time to
// connect real Firebase.
// ---------------------------------------------------------------------------

let mockBookings: BookingRequest[] = [];

export interface CreateBookingInput {
  providerId: string;
  vehicleId: string;
  problem: string;
  notes: string;
  startingPrice: string;
  rating?: number;
  comment?: string;
  ratedAt?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingRequest> {
  const booking: BookingRequest = {
    id: `bk-${Date.now()}`,
    providerId: input.providerId,
    vehicleId: input.vehicleId,
    problem: input.problem,
    notes: input.notes,
    startingPrice: input.startingPrice,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
  mockBookings = [...mockBookings, booking];
  return booking;
}

export async function getBookingById(id: string): Promise<BookingRequest | undefined> {
  return mockBookings.find((b) => b.id === id);
}

export async function updateBookingStatus(
  id: string,
  status: BookingRequest["status"]
): Promise<BookingRequest | undefined> {
  let updated: BookingRequest | undefined;
  mockBookings = mockBookings.map((b) => {
    if (b.id !== id) return b;
    updated = { ...b, status };
    return updated;
  });
  return updated;
}