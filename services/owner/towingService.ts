import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { TowingBookingRequest, TowingStatus } from "../../types/owner/towing";
import { auth, db } from "../firebase";
import { addBookingStatusNotification } from "../customerNotificationService";
import { writeTowingNotification } from "../towingNotificationService";

const BOOKINGS_COLLECTION = "bookings";
export interface CreateTowingBookingInput { providerId: string; providerName: string; vehicleId: string; vehicle: string; vehicleYear: number; vehiclePlate: string; latitude: number; longitude: number; providerLatitude: number; providerLongitude: number; destinationLatitude: number; destinationLongitude: number; providerToPickupDistanceKm: number; pickupToDestinationDistanceKm: number; totalDistanceKm: number; basePrice: number; pricePerKm: number; distanceCharge: number; estimatedTotalPrice: number; pricingMode: "fixed" | "dispatcher"; dispatcherPhone: string; pickupLocation: string; destination: string; towingType: string; vehicleCondition: string; notes: string; startingPrice: string; }
function requireUser() { const user = auth.currentUser; if (!user) throw new Error("You must be signed in to use bookings."); return user; }
function asIso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString(); }
function fromDocument(id: string, data: Record<string, unknown>): TowingBookingRequest { return { ...(data as Omit<TowingBookingRequest, "id" | "createdAt" | "updatedAt">), id, createdAt: asIso(data.createdAt), updatedAt: asIso(data.updatedAt) }; }
export async function createTowingBooking(input: CreateTowingBookingInput): Promise<TowingBookingRequest> { const user = requireUser(); const active=await getActiveTowingBooking(input.providerId,user.uid);if(active)return active; const payload = { bookingType: "towing-company" as const, customerId: user.uid, customerName: user.displayName?.trim() || user.email?.split("@")[0] || "Customer", customerEmail: user.email ?? "", ...input, startingPrice: input.pricingMode === "dispatcher" ? "Contact dispatcher for pricing" : input.startingPrice, status: "pending" as const, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; const reference = doc(collection(db, BOOKINGS_COLLECTION)); await runTransaction(db, async (transaction) => { transaction.set(reference, payload); writeTowingNotification(transaction, { bookingId: reference.id, providerId: input.providerId, customerId: user.uid, customerName: payload.customerName, vehicle: payload.vehicle, pickupLocation: payload.pickupLocation, destination: payload.destination, status: "pending", event: "new_request" }); }); return { ...payload, id: reference.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
export async function getActiveTowingBooking(providerId:string,customerId=requireUser().uid):Promise<TowingBookingRequest|null>{const snap=await getDocs(query(collection(db,BOOKINGS_COLLECTION),where("customerId","==",customerId)));return snap.docs.map(item=>fromDocument(item.id,item.data())).filter(item=>item.bookingType==="towing-company"&&item.providerId===providerId&&!['completed','cancelled','rejected'].includes(item.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null;}
export function subscribeToActiveTowingBooking(providerId: string, callback: (booking: TowingBookingRequest | null) => void) { const user = requireUser(); const q = query(collection(db, BOOKINGS_COLLECTION), where("customerId", "==", user.uid)); return onSnapshot(q, (snapshot) => { const booking = snapshot.docs.map((item) => fromDocument(item.id, item.data())).filter((item) => item.bookingType === "towing-company" && item.providerId === providerId && !["completed", "cancelled", "rejected"].includes(item.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null; callback(booking); }); }
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
    addBookingStatusNotification(transaction, { bookingId: id, customerId: booking.customerId, bookingType: "towing-company", providerId: user.uid, providerName: booking.providerName, status });
    writeTowingNotification(transaction, { bookingId: id, providerId: user.uid, customerId: booking.customerId, customerName: booking.customerName, vehicle: booking.vehicle, pickupLocation: booking.pickupLocation, destination: booking.destination, status, event: "provider_status" });
  });
}

/** Lets the customer cancel a towing request before the tow truck is on the way. */
export async function cancelTowingBookingAsCustomer(id: string) {
  const user = requireUser();
  const reference = doc(db, BOOKINGS_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Booking not found.");
    const booking = snapshot.data() as TowingBookingRequest;
    if (booking.customerId !== user.uid || booking.bookingType !== "towing-company") {
      throw new Error("You cannot cancel this request.");
    }
    if (booking.status !== "pending" && booking.status !== "accepted") {
      throw new Error("This request can no longer be cancelled because the tow truck may already be on the way.");
    }
    transaction.update(reference, { status: "cancelled", updatedAt: serverTimestamp() });
    addBookingStatusNotification(transaction, {
      bookingId: id,
      customerId: user.uid,
      bookingType: "towing-company",
      providerId: booking.providerId,
      providerName: booking.providerName,
      status: "cancelled",
      message: "You cancelled your towing request.",
    });
    writeTowingNotification(transaction, {
      bookingId: id,
      providerId: booking.providerId,
      customerId: user.uid,
      customerName: booking.customerName,
      vehicle: booking.vehicle,
      pickupLocation: booking.pickupLocation,
      destination: booking.destination,
      status: "cancelled",
      event: "customer_cancelled",
    });
  });
}
