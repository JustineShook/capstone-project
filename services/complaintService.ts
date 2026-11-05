import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { ComplaintBooking, ComplaintCategory } from "../types/complaint";

const ACTIVE_STATUSES = new Set([
  "accepted", "en_route", "arrived", "in_progress", "vehicle_arrived", "diagnosing", "repairing",
]);

export function complaintId(bookingId: string, reporterId: string) {
  return `${bookingId}_${reporterId}`;
}

export async function submitComplaint(booking: ComplaintBooking, category: ComplaintCategory, explanation: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to report a problem.");
  const isOwner = booking.customerId === user.uid;
  const isProvider = booking.providerId === user.uid;
  if (!isOwner && !isProvider) throw new Error("Only a booking participant can submit a report.");
  const cleanExplanation = explanation.trim();
  if (!category || cleanExplanation.length < 10 || cleanExplanation.length > 2000) {
    throw new Error("Choose a category and enter an explanation of 10 to 2,000 characters.");
  }
  const completedAt = booking.completedAt && typeof booking.completedAt === "object" && booking.completedAt.toDate
    ? booking.completedAt.toDate()
    : typeof booking.completedAt === "string" ? new Date(booking.completedAt) : null;
  const withinCompletionWindow = booking.status === "completed" && completedAt && !Number.isNaN(completedAt.getTime())
    && Date.now() - completedAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
  if (!ACTIVE_STATUSES.has(booking.status) && !withinCompletionWindow) {
    throw new Error("Reports are available during active service and for 7 days after a recorded completion.");
  }
  const reporterType = isOwner ? "Vehicle Owner" : "Provider";
  const report = {
    bookingId: booking.id,
    bookingType: booking.bookingType,
    bookingStatusAtSubmission: booking.status,
    bookingReference: booking.id,
    reporterId: user.uid,
    reporterName: user.displayName?.trim() || user.email?.split("@")[0] || reporterType,
    reporterType,
    reportedUserId: isOwner ? booking.providerId : booking.customerId,
    reportedUserName: isOwner ? booking.providerName || "Provider" : booking.customerName || "Vehicle Owner",
    category,
    explanation: cleanExplanation,
    status: "Pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "complaints", complaintId(booking.id, user.uid)), report);
}
