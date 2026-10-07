import { collection, doc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";

import { auth, db } from "./firebase";
import type { ParkingBooking } from "../types/parkingBooking";
import type { SavedVehicle } from "../types/owner/vehicle";

const LISTINGS = "providerListings";
const BOOKINGS = "parkingBookings";
const SLOTS = "parkingSlots";
export type ParkingSlot = { id: string; slotNumber: number; status: "available" | "reserved"; customerId: string | null; bookingId: string | null };

function requireUser() { const user = auth.currentUser; if (!user) throw new Error("Sign in required."); return user; }
function asIso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString(); }
function fromDoc(id: string, data: Record<string, unknown>): ParkingBooking {
  return { ...(data as Omit<ParkingBooking, "id" | "bookedAt" | "updatedAt" | "parkingStartedAt" | "parkingEndedAt">), id,
    bookedAt: asIso(data.bookedAt), updatedAt: asIso(data.updatedAt),
    ...(data.parkingStartedAt ? { parkingStartedAt: asIso(data.parkingStartedAt) } : {}),
    ...(data.parkingEndedAt ? { parkingEndedAt: asIso(data.parkingEndedAt) } : {}) };
}

export function subscribeToParkingListing(providerId: string, callback: (value: { totalSlots: number; availableSlots: number } | null) => void) {
  let totalSlots = 0; let availableSlots = 0;
  const publish = () => callback(totalSlots > 0 ? { totalSlots, availableSlots } : null);
  const stopListing = onSnapshot(doc(db, LISTINGS, providerId), (snap) => { const data = snap.data(); totalSlots = data?.role === "homegarage" && Number.isInteger(data.totalSlots) ? data.totalSlots : 0; publish(); });
  const stopSlots = onSnapshot(query(collection(db, SLOTS), where("providerId", "==", providerId), where("status", "==", "available")), (snap) => { availableSlots = snap.size; publish(); });
  return () => { stopListing(); stopSlots(); };
}

export function subscribeToMyParkingProviderListing(callback: (value: { availability: "available" | "busy" | "offline"; totalSlots: number } | null) => void) {
  const user = requireUser();
  return onSnapshot(doc(db, LISTINGS, user.uid), (snap) => {
    const data = snap.data();
    callback(data?.role === "homegarage" && Number.isInteger(data.totalSlots)
      ? { availability: data.availability, totalSlots: data.totalSlots } : null);
  });
}

export function subscribeToProviderParkingSlots(callback: (slots: ParkingSlot[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, SLOTS), where("providerId", "==", user.uid)), (snap) => callback(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ParkingSlot, "id">) })).sort((a, b) => a.slotNumber - b.slotNumber)), onError);
}

export async function setParkingAvailability(available: boolean) {
  const user = requireUser();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, LISTINGS, user.uid);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().role !== "homegarage") throw new Error("Create your public parking listing first.");
    tx.update(ref, { availability: available ? "available" : "offline" });
  });
}

export function subscribeToMyParkingBookings(callback: (bookings: ParkingBooking[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, BOOKINGS), where("customerId", "==", user.uid)), (snap) => callback(snap.docs.map((item) => fromDoc(item.id, item.data())).sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))), onError);
}

/** Firestore is the source of truth when a customer returns to a parking space. */
export async function getActiveParkingBookingForCustomer(providerId: string, customerId = requireUser().uid): Promise<ParkingBooking | null> {
  const snapshot = await getDocs(query(collection(db, BOOKINGS), where("customerId", "==", customerId)));
  const booking = snapshot.docs
    .map((item) => fromDoc(item.id, item.data()))
    .filter((item) => item.providerId === providerId && (item.status === "reserved" || item.status === "active"))
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))[0];
  return booking ?? null;
}

export function subscribeToProviderParkingBookings(callback: (bookings: ParkingBooking[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, BOOKINGS), where("providerId", "==", user.uid)), (snap) => callback(snap.docs.map((item) => fromDoc(item.id, item.data())).sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))), onError);
}

export async function reserveParking(providerId: string, providerName: string, vehicle: SavedVehicle, notes: string) {
  const user = requireUser();
  const existing = await getActiveParkingBookingForCustomer(providerId, user.uid);
  if (existing) return { bookingId: existing.id, recovered: true };
  const listingRef = doc(db, LISTINGS, providerId);
  const bookingRef = doc(collection(db, BOOKINGS));
  const candidates = await getDocs(query(collection(db, SLOTS), where("providerId", "==", providerId), where("status", "==", "available"), limit(1)));
  const slotRef = candidates.docs[0]?.ref;
  if (!slotRef) throw new Error("No parking slots are available.");
  await runTransaction(db, async (tx) => {
    const listingSnapshot = await tx.get(listingRef);
    const listing = listingSnapshot.data();
    if (!listingSnapshot.exists() || listing?.role !== "homegarage" || listing.visibility !== "active" || listing.availability !== "available") throw new Error("This parking space is not accepting reservations.");
    if (!Number.isInteger(listing.totalSlots)) throw new Error("Parking capacity is not configured.");
    const slot = await tx.get(slotRef); if (!slot.exists() || slot.data().status !== "available") throw new Error("That slot was just reserved. Please try again.");
    tx.set(bookingRef, { providerId, providerName, customerId: user.uid, customerName: user.displayName?.trim() || user.email?.split("@")[0] || "Customer", vehicleId: vehicle.vehicleId, vehicle: `${vehicle.make} ${vehicle.model}`, vehiclePlate: vehicle.plateNumber, vehicleType: vehicle.type, slotId: slotRef.id, slotNumber: slot.data().slotNumber, notes: notes.trim(), status: "reserved", bookedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(slotRef, { status: "reserved", customerId: user.uid, bookingId: bookingRef.id, updatedAt: serverTimestamp() });
  });
  return { bookingId: bookingRef.id, recovered: false };
}

export async function startParking(bookingId: string) {
  const user = requireUser(); const ref = doc(db, BOOKINGS, bookingId);
  await runTransaction(db, async (tx) => { const snap = await tx.get(ref); const booking = snap.data(); if (!snap.exists() || booking?.customerId !== user.uid) throw new Error("Parking booking not found."); if (booking.status !== "reserved") throw new Error("Only a reserved parking session can be started."); tx.update(ref, { status: "active", parkingStartedAt: serverTimestamp(), updatedAt: serverTimestamp() }); });
}

export async function endParking(bookingId: string) {
  const user = requireUser(); const bookingRef = doc(db, BOOKINGS, bookingId);
  await runTransaction(db, async (tx) => { const bookingSnapshot = await tx.get(bookingRef); const booking = bookingSnapshot.data(); if (!bookingSnapshot.exists() || booking?.customerId !== user.uid) throw new Error("Parking booking not found."); if (booking.status !== "active" || typeof booking.slotId !== "string") throw new Error("Only an active parking session can be ended."); const slotRef = doc(db, SLOTS, booking.slotId); const slot = await tx.get(slotRef); if (!slot.exists() || slot.data().bookingId !== bookingId || slot.data().customerId !== user.uid) throw new Error("Parking slot could not be released."); tx.update(bookingRef, { status: "completed", parkingEndedAt: serverTimestamp(), updatedAt: serverTimestamp() }); tx.update(slotRef, { status: "available", customerId: null, bookingId: null, updatedAt: serverTimestamp() }); });
}
