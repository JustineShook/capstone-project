import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";

import type { ProviderReview } from "../../data/owner/mockProviders";
import { auth, db } from "../firebase";

export type RatedBookingType = "towing" | "mechanic";
export type RatedProviderRole = "towing-company" | "onsite-mechanic";

export interface BookingRating {
  bookingId: string;
  customerId: string;
  providerId: string;
  providerRole: RatedProviderRole;
  bookingType: RatedBookingType;
  rating: number;
  comment?: string;
  ratedAt: string;
}

export interface ProviderReviewSummary {
  average: number;
  count: number;
  reviews: ProviderReview[];
}

const reviewRef = (bookingId: string) => doc(db, "providerReviews", bookingId);

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to submit a review.");
  return user;
}

function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();
}

function bookingTypeForRole(role: RatedProviderRole): RatedBookingType {
  return role === "onsite-mechanic" ? "mechanic" : "towing";
}

export async function submitRating(
  bookingId: string,
  bookingType: RatedBookingType,
  rating: number,
  comment?: string
): Promise<BookingRating> {
  const user = requireUser();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be an integer from 1 to 5.");
  const trimmedComment = comment?.trim() ?? "";
  if (trimmedComment.length > 1000) throw new Error("Review comment cannot exceed 1000 characters.");

  const bookingSnapshot = await getDoc(doc(db, "bookings", bookingId));
  if (!bookingSnapshot.exists()) throw new Error("Booking not found.");
  const booking = bookingSnapshot.data();
  const providerRole = booking.bookingType as RatedProviderRole;
  if (booking.customerId !== user.uid) throw new Error("Only the booking customer can submit this review.");
  if (booking.status !== "completed") throw new Error("Only completed bookings can be reviewed.");
  if (booking.providerId === user.uid) throw new Error("Providers cannot review themselves.");
  if (bookingTypeForRole(providerRole) !== bookingType) throw new Error("Booking type does not match this review.");

  await setDoc(reviewRef(bookingId), {
    bookingId,
    customerId: user.uid,
    providerId: booking.providerId,
    providerRole,
    rating,
    comment: trimmedComment,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { bookingId, customerId: user.uid, providerId: booking.providerId, providerRole,
    bookingType, rating, ...(trimmedComment ? { comment: trimmedComment } : {}), ratedAt: new Date().toISOString() };
}

export async function getRating(bookingId: string): Promise<BookingRating | undefined> {
  requireUser();
  const snapshot = await getDoc(reviewRef(bookingId));
  if (!snapshot.exists()) return undefined;
  const data = snapshot.data();
  const providerRole = data.providerRole as RatedProviderRole;
  return { bookingId: data.bookingId, customerId: data.customerId, providerId: data.providerId,
    providerRole, bookingType: bookingTypeForRole(providerRole), rating: data.rating,
    ...(data.comment ? { comment: data.comment } : {}), ratedAt: toIso(data.createdAt) };
}

export async function getProviderReviewSummary(providerId: string): Promise<ProviderReviewSummary> {
  requireUser();
  const snapshot = await getDocs(query(collection(db, "providerReviews"), where("providerId", "==", providerId)));
  const reviews = snapshot.docs.map((item) => {
    const data = item.data();
    return { id: item.id, customerName: "Verified customer", rating: data.rating,
      comment: data.comment || "", date: new Date(toIso(data.createdAt)).toLocaleDateString() };
  });
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: reviews.length ? total / reviews.length : 0, count: reviews.length, reviews };
}

export function mergeRating<T extends { rating?: number; comment?: string; ratedAt?: string }>(target: T, rating: BookingRating | undefined): T {
  return rating ? { ...target, rating: rating.rating, comment: rating.comment, ratedAt: rating.ratedAt } : target;
}
