import { addDoc, collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { TowingBookingRequest, TowingStatus } from "../../types/owner/towing";
import { auth, db } from "../firebase";

const BOOKINGS_COLLECTION = "bookings";
export interface CreateTowingBookingInput { providerId: string; providerName: string; vehicleId: string; vehicle: string; vehicleYear: number; vehiclePlate: string; latitude: number; longitude: number; pickupLocation: string; destination: string; towingType: string; vehicleCondition: string; notes: string; startingPrice: string; }
function requireUser() { const user = auth.currentUser; if (!user) throw new Error("You must be signed in to use bookings."); return user; }
function asIso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString(); }
function fromDocument(id: string, data: Record<string, unknown>): TowingBookingRequest { return { ...(data as Omit<TowingBookingRequest, "id" | "createdAt" | "updatedAt">), id, createdAt: asIso(data.createdAt), updatedAt: asIso(data.updatedAt) }; }
export async function createTowingBooking(input: CreateTowingBookingInput): Promise<TowingBookingRequest> { const user = requireUser(); const payload = { bookingType: "towing-company" as const, customerId: user.uid, customerName: user.displayName?.trim() || user.email?.split("@")[0] || "Customer", customerEmail: user.email ?? "", ...input, status: "pending" as const, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; const reference = await addDoc(collection(db, BOOKINGS_COLLECTION), payload); return { ...payload, id: reference.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
export async function getTowingBookingById(id: string) { requireUser(); const snapshot = await getDoc(doc(db, BOOKINGS_COLLECTION, id)); return snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : undefined; }
export function subscribeToTowingBooking(id: string, callback: (booking?: TowingBookingRequest) => void) { requireUser(); return onSnapshot(doc(db, BOOKINGS_COLLECTION, id), (snapshot) => callback(snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : undefined)); }
export function subscribeToTowingRequests(callback: (bookings: TowingBookingRequest[]) => void) { const user = requireUser(); const q = query(collection(db, BOOKINGS_COLLECTION), where("providerId", "==", user.uid)); return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => fromDocument(item.id, item.data())).filter((item) => item.bookingType === "towing-company").sort((a, b) => b.createdAt.localeCompare(a.createdAt)))); }
const ALLOWED_TRANSITIONS: Partial<Record<TowingStatus, TowingStatus[]>> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
};

export async function updateTowingBookingStatus(id: string, status: TowingStatus) {
  const user = requireUser();
  const reference = doc(db, BOOKINGS_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Booking not found.");
    const booking = snapshot.data() as TowingBookingRequest;
    if (booking.providerId !== user.uid || booking.bookingType !== "towing-company") throw new Error("You are not assigned to this booking.");
    if (!ALLOWED_TRANSITIONS[booking.status]?.includes(status)) throw new Error(`Invalid booking transition: ${booking.status} → ${status}.`);
    transaction.update(reference, { status, updatedAt: serverTimestamp() });
  });
}
