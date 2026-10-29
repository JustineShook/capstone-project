import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { BookingRequest, BookingStatus } from "../../types/owner/booking";
import { auth, db } from "../firebase";
import { getOwnerVerificationProfile, requireVerifiedOwner } from "../ownerVerificationProfileService";
import { addBookingStatusNotification } from "../customerNotificationService";
import { writeMechanicNotification } from "../mechanicNotificationService";
import type { BookingTimingInput } from "../../types/bookingTiming";
import { timingFields, validateBookingTiming } from "../../utils/bookingTiming";
import { claimScheduledReservation, releaseScheduledReservation } from "../scheduledBookingReservationService";
import { isValidFinalPrice } from "../../utils/finalPrice";

const BOOKINGS_COLLECTION = "bookings";
export interface CreateBookingInput { providerId: string; providerName: string; providerPhone?: string; vehicleId: string; vehicle: string; vehicleYear: number; vehiclePlate: string; latitude: number; longitude: number; problem: string; notes: string; startingPrice: string; timing?: BookingTimingInput; }
function requireUser() { const user = auth.currentUser; if (!user) throw new Error("You must be signed in to use bookings."); return user; }
function asIso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString(); }
function fromDocument(id: string, data: Record<string, unknown>): BookingRequest { return { ...(data as Omit<BookingRequest, "id" | "createdAt" | "updatedAt">), ...(data.mechanicLocationUpdatedAt ? { mechanicLocationUpdatedAt: asIso(data.mechanicLocationUpdatedAt) } : {}), ...(data.completedAt ? { completedAt: asIso(data.completedAt) } : {}), id, createdAt: asIso(data.createdAt), updatedAt: asIso(data.updatedAt) }; }

export async function createBooking(input: CreateBookingInput): Promise<BookingRequest> {
  const user = requireUser();
  const active = await getActiveMechanicBooking(input.providerId, user.uid);
  if (active) return active;
  await requireVerifiedOwner(user.uid);
  const ownerProfile = await getOwnerVerificationProfile(user.uid);
  const address = ownerProfile?.personal.address?.trim() ?? "";
  const city = ownerProfile?.personal.cityMunicipality?.trim() ?? "";
  const timing = input.timing ?? { timingMode: "now" as const, urgency: "standard" as const };
  const { timing: _timing, ...bookingInput } = input;
  const payload = { bookingType: "onsite-mechanic" as const, customerId: user.uid, customerName: user.displayName?.trim() || user.email?.split("@")[0] || "Customer", customerEmail: user.email ?? "", customerPhone: ownerProfile?.personal.phone?.trim() ?? "", customerAddress: [address, city].filter(Boolean).join(", "), ...bookingInput, ...timingFields(timing), status: "pending" as const, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const reference = doc(collection(db, BOOKINGS_COLLECTION));
  await runTransaction(db, async (transaction) => {
    const listingRef = doc(db, "providerListings", input.providerId);
    const listingSnapshot = await transaction.get(listingRef);
    const listing = listingSnapshot.data();
    if (!listing || listing.providerId !== input.providerId || listing.role !== "onsite-mechanic" || listing.visibility !== "active") throw new Error("This mechanic is not publicly available.");
    if (timing.timingMode === "now" && timing.urgency === "standard") {
      throw new Error("Mechanics accept Emergency or scheduled requests only. Choose Emergency explicitly to continue.");
    }
    validateBookingTiming(timing, listing.emergencyServiceAvailable === true, listing.acceptsScheduledBookings === true);
    if (timing.timingMode === "now" && listing.availability !== "available") throw new Error("This mechanic is unavailable right now. Choose a scheduled time if enabled.");
    transaction.set(reference, payload);
    writeMechanicNotification(transaction, {
      bookingId: reference.id,
      providerId: input.providerId,
      customerId: user.uid,
      customerName: payload.customerName,
      vehicle: payload.vehicle,
      status: "pending",
      event: "new_request",
    });
  });
  return { ...payload, id: reference.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export async function getActiveMechanicBooking(providerId: string, customerId = requireUser().uid): Promise<BookingRequest | null> { const snap=await getDocs(query(collection(db, BOOKINGS_COLLECTION),where("customerId","==",customerId))); return snap.docs.map((item)=>fromDocument(item.id,item.data())).filter((item)=>item.bookingType==="onsite-mechanic"&&item.providerId===providerId&&!['completed','cancelled','rejected'].includes(item.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null; }
export function subscribeToActiveMechanicBooking(providerId: string, callback: (booking: BookingRequest | null) => void) { const user = requireUser(); const q = query(collection(db, BOOKINGS_COLLECTION), where("customerId", "==", user.uid)); return onSnapshot(q, (snapshot) => { const booking = snapshot.docs.map((item) => fromDocument(item.id, item.data())).filter((item) => item.bookingType === "onsite-mechanic" && item.providerId === providerId && !["completed", "cancelled", "rejected"].includes(item.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null; callback(booking); }); }
export async function getBookingById(id: string) { requireUser(); const snapshot = await getDoc(doc(db, BOOKINGS_COLLECTION, id)); return snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : undefined; }
export function subscribeToBooking(id: string, callback: (booking?: BookingRequest) => void) { requireUser(); return onSnapshot(doc(db, BOOKINGS_COLLECTION, id), (snapshot) => callback(snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : undefined)); }
export function subscribeToMechanicRequests(callback: (bookings: BookingRequest[]) => void) { const user = requireUser(); const q = query(collection(db, BOOKINGS_COLLECTION), where("providerId", "==", user.uid)); return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => fromDocument(item.id, item.data())).filter((item) => item.bookingType === "onsite-mechanic").sort((a, b) => b.createdAt.localeCompare(a.createdAt)))); }
const ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
};

export async function updateBookingStatus(id: string, status: BookingStatus, reason?: string) {
  if (status === "completed") throw new Error("Enter a final price to complete this service.");
  if (status === "rejected" && !reason?.trim()) throw new Error("A decline reason is required.");
  await updateMechanicBooking(id, status, undefined, status === "rejected" ? reason!.trim() : undefined);
}

export async function completeMechanicBooking(id: string, finalPrice: number) {
  if (!isValidFinalPrice(finalPrice)) throw new Error("Enter a valid final price with up to two decimal places.");
  await updateMechanicBooking(id, "completed", finalPrice);
}

async function updateMechanicBooking(id: string, status: BookingStatus, finalPrice?: number, declineReason?: string) {
  const user = requireUser();
  const reference = doc(db, BOOKINGS_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Booking not found.");
    const booking = snapshot.data() as BookingRequest;
    if (booking.providerId !== user.uid || booking.bookingType !== "onsite-mechanic") throw new Error("You are not assigned to this booking.");
    if (!ALLOWED_TRANSITIONS[booking.status]?.includes(status)) throw new Error(`Invalid booking transition: ${booking.status} → ${status}.`);
    const scheduled = booking.timingMode === "scheduled";
    const startingScheduledService = booking.status === "accepted" && status === "en_route" && scheduled;
    if (startingScheduledService && (!(booking.scheduledAt instanceof Timestamp) || booking.scheduledAt.toMillis() > Date.now())) {
      throw new Error("This scheduled service cannot start before its appointment time.");
    }
    if (status === "accepted" && booking.timingMode === "scheduled" && booking.scheduledAt instanceof Timestamp) {
      await claimScheduledReservation(transaction, booking.providerId, id, booking.scheduledAt);
    }
    const completedAt = status === "completed" ? serverTimestamp() : undefined;
    transaction.update(reference, status === "completed"
      ? { status, finalPrice, completedAt, updatedAt: completedAt }
      : { status, ...(status === "rejected" ? { declineReason, riskEventType: "provider_decline", riskEventAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
    addBookingStatusNotification(transaction, {
      bookingId: id, customerId: booking.customerId, bookingType: "onsite-mechanic",
      providerId: user.uid, providerName: booking.providerName, status,
      ...(status === "rejected" ? { message: `${booking.providerName} declined your request. Reason: ${declineReason!.slice(0, 180)}` } : {}),
      ...(status === "completed" ? { message: `${booking.providerName} completed your service. Final price recorded: ₱${finalPrice!.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` } : {}),
    });
    writeMechanicNotification(transaction, { bookingId: id, providerId: user.uid, customerId: booking.customerId, customerName: booking.customerName, vehicle: booking.vehicle, status, event: "provider_status" });
  });
}

/** Lets the customer cancel their own onsite request before the mechanic is on the way. */
export async function cancelMechanicBookingAsCustomer(id: string, reason: string) {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  const user = requireUser();
  const reference = doc(db, BOOKINGS_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Booking not found.");
    const booking = snapshot.data() as BookingRequest;
    if (booking.customerId !== user.uid || booking.bookingType !== "onsite-mechanic") {
      throw new Error("You cannot cancel this request.");
    }
    if (booking.status !== "pending" && booking.status !== "accepted") {
      throw new Error("This request can no longer be cancelled because the mechanic may already be on the way.");
    }
    await releaseScheduledReservation(transaction, booking.providerId, id, booking.scheduledAt instanceof Timestamp ? booking.scheduledAt : undefined);
    transaction.update(reference, { status: "cancelled", cancellationReason: reason.trim(), ...(booking.status === "accepted" ? { riskEventType: "owner_cancel_after_acceptance", riskEventAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
    addBookingStatusNotification(transaction, { bookingId: id, customerId: user.uid, bookingType: "onsite-mechanic", providerId: booking.providerId, providerName: booking.providerName, status: "cancelled" });
    writeMechanicNotification(transaction, { bookingId: id, providerId: booking.providerId, customerId: user.uid, customerName: booking.customerName, vehicle: booking.vehicle, status: "cancelled", event: "customer_cancelled", reason: reason.trim().slice(0, 180) });
  });
}

/** Publishes the assigned mechanic's foreground GPS only while travelling to a customer. */
export async function updateMechanicLocation(id: string, latitude: number, longitude: number) {
  const user = requireUser();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const reference = doc(db, BOOKINGS_COLLECTION, id);
  await updateDoc(reference, { mechanicLatitude: latitude, mechanicLongitude: longitude, mechanicLocationUpdatedAt: serverTimestamp() });
}
