import { collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getOwnerVerificationProfile, requireVerifiedOwner } from "./ownerVerificationProfileService";
import type { ProviderListing } from "../types/providerListing";
import type { SavedVehicle } from "../types/owner/vehicle";
import type { HomeGarageBooking, HomeGarageBookingStatus } from "../types/homeGarageBooking";
import { addBookingStatusNotification, addHomeGaragePriceNotification } from "./customerNotificationService";
import { writeHomeGarageProviderNotification } from "./homeGarageNotificationService";
import type { BookingTimingInput } from "../types/bookingTiming";
import { timingFields, validateBookingTiming } from "../utils/bookingTiming";
import { claimScheduledReservation, releaseScheduledReservation } from "./scheduledBookingReservationService";
import { isValidFinalPrice } from "../utils/finalPrice";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}

function fromDoc(id: string, data: Record<string, unknown>): HomeGarageBooking {
  const toIso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : "";
  return { ...(data as Omit<HomeGarageBooking, "id" | "createdAt" | "updatedAt">), id,
    createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt), completedAt: toIso(data.completedAt) || undefined };
}

export function subscribeToMyHomeGarageBookings(callback: (items: HomeGarageBooking[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", user.uid)), (snapshot) => {
    callback(snapshot.docs.filter((item) => item.data().bookingType === "homegarage")
      .map((item) => fromDoc(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export async function getActiveHomeGarageBooking(providerId: string): Promise<HomeGarageBooking | null> {
  const user = requireUser();
  const snapshot = await getDocs(query(collection(db, "bookings"), where("customerId", "==", user.uid)));
  return snapshot.docs.map((item) => fromDoc(item.id, item.data()))
    .filter((item) => item.bookingType === "homegarage" && item.providerId === providerId
      && !["completed", "cancelled", "rejected"].includes(item.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function subscribeToActiveHomeGarageBooking(providerId: string, callback: (booking: HomeGarageBooking | null) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", user.uid)), (snapshot) => {
    const booking = snapshot.docs.map((item) => fromDoc(item.id, item.data()))
      .filter((item) => item.bookingType === "homegarage" && item.providerId === providerId
        && !["completed", "cancelled", "rejected"].includes(item.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    callback(booking);
  });
}

export function subscribeToHomeGarageRequests(callback: (items: HomeGarageBooking[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, "bookings"), where("providerId", "==", user.uid)), (snapshot) => {
    callback(snapshot.docs.filter((item) => item.data().bookingType === "homegarage")
      .map((item) => fromDoc(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, onError);
}

export function subscribeToHomeGarageBooking(id: string, callback: (item: HomeGarageBooking | null) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(doc(db, "bookings", id), (snapshot) => {
    const data = snapshot.data();
    callback(data?.bookingType === "homegarage" && (data.customerId === user.uid || data.providerId === user.uid)
      ? fromDoc(snapshot.id, data) : null);
  }, onError);
}

export async function createHomeGarageBooking(providerId: string, vehicle: SavedVehicle, problemText: string, notesText: string, timing: BookingTimingInput = { timingMode: "now", urgency: "standard" }): Promise<string> {
  const user = requireUser();
  await requireVerifiedOwner(user.uid);
  const ownerProfile = await getOwnerVerificationProfile(user.uid);
  const problem = problemText.trim();
  const notes = notesText.trim();
  if (!problem || problem.length > 300) throw new Error("Describe the repair needed in 1–300 characters.");
  if (notes.length > 1000) throw new Error("Notes must be 1,000 characters or fewer.");
  if (!providerId || !vehicle.vehicleId) throw new Error("Choose a Home Garage and one of your saved vehicles.");

  const bookingRef = doc(collection(db, "bookings"));
  const lockRef = doc(db, "users", user.uid, "homeGarageBookingLocks", providerId);
  let bookingId = bookingRef.id;
  await runTransaction(db, async (transaction) => {
    const lock = await transaction.get(lockRef);
    const lockedId = lock.data()?.bookingId;
    if (typeof lockedId === "string") {
      const previous = await transaction.get(doc(db, "bookings", lockedId));
      const data = previous.data();
      if (previous.exists() && data?.bookingType === "homegarage" && data.customerId === user.uid
        && data.providerId === providerId && !["completed", "cancelled", "rejected"].includes(data.status as string)) {
        bookingId = lockedId;
        return;
      }
    }
    const listing = (await transaction.get(doc(db, "providerListings", providerId))).data() as ProviderListing | undefined;
    const savedVehicle = (await transaction.get(doc(db, "users", user.uid, "vehicles", vehicle.vehicleId))).data() as SavedVehicle | undefined;
    const account = (await transaction.get(doc(db, "users", user.uid))).data();
    if (account?.role !== "owner") throw new Error("Sign in as a Vehicle Owner to request a repair.");
    if (!listing || listing.role !== "homegarage" || listing.category !== "Parking Lots"
      || listing.visibility !== "active" || listing.providerId !== providerId) {
      throw new Error("This Home Garage is not publicly available.");
    }
    validateBookingTiming(timing, listing.emergencyServiceAvailable === true, listing.acceptsScheduledBookings === true);
    if (timing.timingMode === "now" && listing.availability !== "available") throw new Error("This Home Garage is unavailable now. Choose a scheduled time if enabled.");
    if (!savedVehicle || savedVehicle.vehicleId !== vehicle.vehicleId) throw new Error("This vehicle is no longer saved. Select another vehicle.");
    transaction.set(bookingRef, {
      bookingType: "homegarage", customerId: user.uid,
      customerName: account.displayName?.trim() || user.displayName?.trim() || "Customer",
      customerPhone: ownerProfile?.personal.phone?.trim() ?? "",
      providerId, providerName: listing.businessName,
      vehicleId: savedVehicle.vehicleId, vehicle: `${savedVehicle.make} ${savedVehicle.model}`,
      vehicleYear: savedVehicle.year, vehiclePlate: savedVehicle.plateNumber,
      problem, notes, garageLatitude: listing.location.latitude, garageLongitude: listing.location.longitude,
      serviceAreaLabel: listing.serviceAreaLabel,
      ...timingFields(timing),
      startingPrice: listing.startingPrice == null ? "Price on assessment" : `₱${listing.startingPrice.toLocaleString("en-PH")}`,
      status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    transaction.set(lockRef, { customerId: user.uid, providerId, bookingId: bookingRef.id });
    writeHomeGarageProviderNotification(transaction, {
      bookingId: bookingRef.id, providerId, customerId: user.uid,
      customerName: account.displayName?.trim() || user.displayName?.trim() || "Customer",
      vehicle: `${savedVehicle.make} ${savedVehicle.model}`, problem,
      status: "pending", event: "new_request",
    });
  });
  return bookingId;
}

function validateRecordedPrice(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) throw new Error("Enter a valid price between ₱0 and ₱100,000,000.");
  return Math.round(value * 100) / 100;
}

export async function saveHomeGarageAssessmentPrice(id: string, price: number) {
  const amount = validateRecordedPrice(price);
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    const booking = snapshot.data();
    if (!snapshot.exists() || booking?.bookingType !== "homegarage" || booking.providerId !== user.uid) throw new Error("Home Garage request not found.");
    if (booking.status !== "accepted") throw new Error("The assessment can only be saved on an accepted request.");
    transaction.update(reference, { assessmentPrice: amount, updatedAt: serverTimestamp() });
    addHomeGaragePriceNotification(transaction, { bookingId: id, customerId: booking.customerId,
      providerId: user.uid, providerName: booking.providerName, status: "assessed",
      message: `${booking.providerName} completed the assessment. Assessed service price: ₱${amount.toLocaleString("en-PH")}.` });
    writeHomeGarageProviderNotification(transaction, { bookingId: id, providerId: user.uid, customerId: booking.customerId,
      customerName: booking.customerName || "Customer", vehicle: booking.vehicle, problem: booking.problem,
      status: "assessed", event: "provider_update" });
  });
}

export async function startHomeGarageRepair(id: string) {
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    const booking = snapshot.data();
    if (!snapshot.exists() || booking?.bookingType !== "homegarage" || booking.providerId !== user.uid) throw new Error("Home Garage request not found.");
    if (booking.status !== "accepted") throw new Error("Only an accepted repair can be marked as arrived.");
    transaction.update(reference, { status: "vehicle_arrived", updatedAt: serverTimestamp() });
  });
}

export async function updateHomeGarageRepairProgress(id: string, status: "diagnosing" | "repairing") {
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    const booking = snapshot.data();
    if (!snapshot.exists() || booking?.bookingType !== "homegarage" || booking.providerId !== user.uid) throw new Error("Home Garage request not found.");
    const expected = status === "diagnosing" ? "vehicle_arrived" : "diagnosing";
    if (booking.status !== expected) throw new Error("This repair has changed. Refresh and try again.");
    transaction.update(reference, { status, updatedAt: serverTimestamp() });
  });
}

export async function completeHomeGarageRepair(id: string, finalPrice: number) {
  if (!isValidFinalPrice(finalPrice)) throw new Error("Enter a valid final price with up to two decimal places.");
  const amount = finalPrice;
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    const booking = snapshot.data();
    if (!snapshot.exists() || booking?.bookingType !== "homegarage" || booking.providerId !== user.uid) throw new Error("Home Garage request not found.");
    if (!(booking.status === "repairing" || booking.status === "in_progress")) throw new Error("Only a repairing job can be completed.");
    transaction.update(reference, { status: "completed", finalPrice: amount, completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    addBookingStatusNotification(transaction, { bookingId: id, customerId: booking.customerId,
      bookingType: "homegarage", providerId: user.uid, providerName: booking.providerName, status: "completed",
      message: `${booking.providerName} completed your repair. Final service price: ₱${amount.toLocaleString("en-PH")}.` });
    writeHomeGarageProviderNotification(transaction, { bookingId: id, providerId: user.uid, customerId: booking.customerId,
      customerName: booking.customerName || "Customer", vehicle: booking.vehicle, problem: booking.problem,
      status: "completed", event: "provider_update" });
  });
}

export async function updateHomeGarageBookingStatus(id: string, status: "accepted" | "rejected" | "cancelled", reason?: string) {
  if ((status === "rejected" || status === "cancelled") && !reason?.trim()) throw new Error(status === "rejected" ? "A decline reason is required." : "A cancellation reason is required.");
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    const booking = snapshot.data();
    if (!snapshot.exists() || booking?.bookingType !== "homegarage") throw new Error("Home Garage request not found.");
    if (status === "cancelled") {
      if (booking.customerId !== user.uid || !["pending", "accepted"].includes(booking.status)) throw new Error("After the Home Garage starts the repair, contact the provider to request cancellation.");
      await releaseScheduledReservation(transaction, booking.providerId, id, booking.scheduledAt instanceof Timestamp ? booking.scheduledAt : undefined);
    } else {
      if (booking.providerId !== user.uid) throw new Error("You are not assigned to this repair request.");
      const allowed: HomeGarageBookingStatus[] = booking.status === "pending" ? ["accepted", "rejected"] : [];
      if (!allowed.includes(status)) throw new Error("This request status has changed. Refresh and try again.");
      if (status === "accepted" && booking.timingMode === "scheduled" && booking.scheduledAt instanceof Timestamp) {
        await claimScheduledReservation(transaction, booking.providerId, id, booking.scheduledAt);
      }
    }
    transaction.update(reference, { status, ...(status === "cancelled" ? { cancellationReason: reason!.trim(), ...(booking.status === "accepted" ? { riskEventType: "owner_cancel_after_acceptance", riskEventAt: serverTimestamp() } : {}) } : status === "rejected" ? { declineReason: reason!.trim(), riskEventType: "provider_decline", riskEventAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
    if (status === "cancelled") {
      writeHomeGarageProviderNotification(transaction, { bookingId: id, providerId: booking.providerId,
        customerId: booking.customerId, customerName: booking.customerName || "Customer", vehicle: booking.vehicle,
        problem: booking.problem, status, event: "customer_cancelled", reason: reason!.trim().slice(0, 180) });
    } else {
      addBookingStatusNotification(transaction, { bookingId: id, customerId: booking.customerId,
        bookingType: "homegarage", providerId: user.uid, providerName: booking.providerName, status,
        ...(status === "rejected" ? { message: `${booking.providerName} declined your Home Garage repair request. Reason: ${reason!.trim().slice(0, 180)}` } : {}) });
      writeHomeGarageProviderNotification(transaction, { bookingId: id, providerId: user.uid,
        customerId: booking.customerId, customerName: booking.customerName || "Customer", vehicle: booking.vehicle,
        problem: booking.problem, status, event: "provider_update" });
    }
  });
}
