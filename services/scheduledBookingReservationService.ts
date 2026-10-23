import { doc, type Transaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { providerSlotReservationId } from "../utils/bookingTiming";
import { db } from "./firebase";

function reservationRef(providerId: string, scheduledAt: Timestamp) {
  return doc(db, "providerScheduleReservations", providerSlotReservationId(providerId, scheduledAt));
}

/** Must be called before any transaction writes. The slot document is shared by all contenders. */
export async function claimScheduledReservation(
  transaction: Transaction, providerId: string, bookingId: string, scheduledAt: Timestamp,
) {
  const reference = reservationRef(providerId, scheduledAt);
  const snapshot = await transaction.get(reference);
  if (snapshot.exists()) throw new Error("That appointment start window was just reserved. Choose another time.");
  transaction.set(reference, { providerId, bookingId, scheduledAt, createdAt: serverTimestamp() });
}

/** Called in the same transaction as an eligible cancellation. */
export async function releaseScheduledReservation(
  transaction: Transaction, providerId: string, bookingId: string, scheduledAt?: Timestamp,
) {
  if (!scheduledAt) return;
  const reference = reservationRef(providerId, scheduledAt);
  const snapshot = await transaction.get(reference);
  if (snapshot.exists() && snapshot.data().bookingId === bookingId) transaction.delete(reference);
}

