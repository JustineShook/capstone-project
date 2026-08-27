// services/owner/ratingService.ts
// ---------------------------------------------------------------------------
// SHARED RATING SERVICE (towing + mechanic bookings)
//
// Ratings are deliberately NOT stored on the booking record itself
// (TowingBookingRequest / MechanicBookingRequest). They live in their own
// store here, keyed by bookingId, and get merged onto a booking object at
// read time via mergeRating() below. This mirrors how a real backend would
// likely model it too — a separate `ratings` collection/table (doc id =
// bookingId) rather than a nested field on every booking document, since
// ratings have their own lifecycle (submitted once, after the fact) and
// don't need to be fetched every time a booking is fetched.
//
// This single file replaces what would otherwise be two near-identical
// files (towingRatingService.ts + mechanicRatingService.ts). Both booking
// types share the same shape of concern — "a 1-5 star rating (plus an
// optional written comment) tied to one completed booking" — so there's no
// real reason to duplicate the store, the clamping logic, or the merge
// helper. The only thing that differs between towing and mechanic bookings
// is which screen renders the stars; this file doesn't need to know or care
// about that.
// ---------------------------------------------------------------------------

// Which booking flow a rating belongs to. Not strictly required for lookups
// (bookingId alone is already unique across both flows, since
// createTowingBooking / createMechanicBooking generate their own prefixed
// ids), but keeping it on the record makes the store self-describing —
// useful for debugging, and useful later if bookingId prefixes ever change
// and you need to disambiguate without parsing the id string.
export type RatedBookingType = "towing" | "mechanic";

export interface BookingRating {
  bookingId: string;
  bookingType: RatedBookingType;
  rating: number; // 1-5, always an integer (see clamping in submitRating)
  comment?: string; // optional written review; omitted entirely if blank
  ratedAt: string; // ISO timestamp of submission
}

// Single in-memory store for both booking types. A Map (not an array) so
// lookups by bookingId are O(1) instead of a .find() scan — this matters
// more here than in the booking stores themselves since ratings get read
// on every booking-detail screen open, for both flows.
const mockRatings = new Map<string, BookingRating>();

// Submit a 1-5 star rating (plus an optional comment) for a booking (either
// flow). Intended to be called once per booking — the UI (both
// booking-detail screens) already disables/hides the form once
// booking.rating is set, but this function itself doesn't enforce
// "once only" so a caller COULD overwrite an existing rating if it wanted
// to (e.g. an "edit my rating" feature later).
//
// `comment` is optional — existing callers (e.g. the mechanic flow, if it
// doesn't pass one yet) keep working unchanged since the parameter has a
// default of undefined.
export async function submitRating(
  bookingId: string,
  bookingType: RatedBookingType,
  rating: number,
  comment?: string
): Promise<BookingRating> {
  // Defensive clamp + round: protects against a caller passing 0, 6, or a
  // decimal (e.g. from a future half-star UI) without the star row itself
  // having to be the only thing enforcing valid values.
  const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));

  // Blank/whitespace-only comments are treated as "no comment" so we don't
  // store empty strings — this keeps `comment` truly optional downstream.
  const trimmedComment = comment?.trim();

  const record: BookingRating = {
    bookingId,
    bookingType,
    rating: clampedRating,
    ...(trimmedComment ? { comment: trimmedComment } : {}),
    ratedAt: new Date().toISOString(),
  };

  mockRatings.set(bookingId, record);
  return record;
}

// Look up a rating for a single booking, regardless of which flow it came
// from. Returns undefined if the booking hasn't been rated yet — callers
// use that to decide whether to show "Rate this Provider" vs "Your Rating".
export async function getRating(
  bookingId: string
): Promise<BookingRating | undefined> {
  return mockRatings.get(bookingId);
}

// Convenience helper: takes any booking-shaped object that has optional
// `rating` / `comment` / `ratedAt` fields (both TowingBookingRequest and
// MechanicBookingRequest qualify, via the generic constraint below) and
// returns a new object with those fields filled in from a fetched
// BookingRating, if one exists. If there's no rating yet, the object is
// returned unchanged — this is what lets both booking-detail screens do:
//
//   const [booking, rating] = await Promise.all([
//     getTowingBookingById(id),      // or getMechanicBookingById(id)
//     getRating(id),
//   ]);
//   setBooking(mergeRating(booking, rating));
//
// without either screen needing to know anything about how ratings are
// stored internally.
export function mergeRating<T extends { rating?: number; comment?: string; ratedAt?: string }>(
  target: T,
  rating: BookingRating | undefined
): T {
  if (!rating) return target;
  return {
    ...target,
    rating: rating.rating,
    comment: rating.comment,
    ratedAt: rating.ratedAt,
  };
}