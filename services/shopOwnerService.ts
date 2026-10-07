import {
  collection, doc, getDocs, onSnapshot, query, runTransaction,
  serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { SHOP_TRANSITIONS, type ShopBookingRequest, type ShopBookingStatus } from "../types/shopBooking";
import type { ProviderProfile } from "../types/user";
import type { CreateBookingInput } from "./owner/bookingService";
import { auth, db } from "./firebase";
import { isBookableShopListing, type ProviderListing } from "../types/providerListing";
import type { SavedVehicle } from "../types/owner/vehicle";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}

function asIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  return ""; // A pending server timestamp is not a known request/completion time.
}

function fromDocument(id: string, data: Record<string, unknown>): ShopBookingRequest {
  return {
    ...(data as Omit<ShopBookingRequest, "id" | "createdAt" | "updatedAt">),
    id, createdAt: asIso(data.createdAt), updatedAt: asIso(data.updatedAt),
  };
}

/** Same collection and customer/vehicle snapshot as mechanic and towing bookings. */
export async function createShopBooking(input: CreateBookingInput): Promise<string> {
  const user = requireUser();
  const active=await getActiveShopBooking(input.providerId,user.uid); if(active)return active.id;
  const problem = input.problem.trim();
  const notes = input.notes.trim();
  if (!problem || problem.length > 300) throw new Error("Describe the problem in 1–300 characters.");
  if (notes.length > 1000) throw new Error("Additional notes must be 1,000 characters or fewer.");
  if (!input.providerId || !input.vehicleId) throw new Error("Select a shop and one of your saved vehicles.");
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90
    || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180
    || (input.latitude === 0 && input.longitude === 0)) throw new Error("A valid customer location is required.");

  const reference = doc(collection(db, "bookings"));
  await runTransaction(db, async (transaction) => {
    const listing = (await transaction.get(doc(db, "providerListings", input.providerId))).data() as ProviderListing | undefined;
    const vehicle = (await transaction.get(doc(db, "users", user.uid, "vehicles", input.vehicleId))).data() as SavedVehicle | undefined;
    const account = (await transaction.get(doc(db, "users", user.uid))).data();
    if (account?.role !== "owner") throw new Error("Sign in as a Vehicle Owner to request a repair.");
    if (!isBookableShopListing(listing) || listing.providerId !== input.providerId || input.providerId === user.uid) {
      throw new Error("This shop is no longer open for emergency requests. Choose another shop.");
    }
    if (!vehicle || vehicle.vehicleId !== input.vehicleId) throw new Error("This vehicle is no longer saved. Please select another vehicle.");
    transaction.set(reference, {
      bookingType: "shop-owner", customerId: user.uid,
      customerName: account.displayName?.trim() || user.displayName?.trim() || "Customer",
      customerEmail: user.email ?? "", providerId: listing.providerId, providerName: listing.businessName,
      vehicleId: vehicle.vehicleId, vehicle: `${vehicle.make} ${vehicle.model}`, vehicleYear: vehicle.year, vehiclePlate: vehicle.plateNumber,
      latitude: input.latitude, longitude: input.longitude, problem, notes,
      shopLatitude: listing.location.latitude, shopLongitude: listing.location.longitude, shopAreaLabel: listing.serviceAreaLabel,
      startingPrice: listing.startingPrice == null ? "Price on assessment" : `₱${listing.startingPrice.toLocaleString("en-PH")}`,
      status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
  return reference.id;
}
export async function getActiveShopBooking(providerId:string,customerId=requireUser().uid):Promise<ShopBookingRequest|null>{const snap=await getDocs(query(collection(db,"bookings"),where("customerId","==",customerId)));return snap.docs.map(item=>fromDocument(item.id,item.data())).filter(item=>item.bookingType==="shop-owner"&&item.providerId===providerId&&!['completed','cancelled','rejected'].includes(item.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null;}

export function subscribeToMyShopBookings(callback: (bookings: ShopBookingRequest[]) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", user.uid)), (snapshot) => callback(snapshot.docs
    .filter((item) => item.data().bookingType === "shop-owner")
    .map((item) => fromDocument(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))), onError);
}

export function subscribeToMyShopBooking(id: string, callback: (booking: ShopBookingRequest | null) => void, onError: (error: Error) => void) {
  const user = requireUser();
  return onSnapshot(doc(db, "bookings", id), (snapshot) => {
    const data = snapshot.data();
    callback(data?.bookingType === "shop-owner" && data.customerId === user.uid ? fromDocument(snapshot.id, data) : null);
  }, onError);
}

export function subscribeToShopRequests(
  callback: (bookings: ShopBookingRequest[]) => void,
  onError: (error: Error) => void,
) {
  const user = requireUser();
  // A single-field query follows the existing provider services; no new index needed.
  return onSnapshot(query(collection(db, "bookings"), where("providerId", "==", user.uid)),
    (snapshot) => callback(snapshot.docs
      .filter((item) => item.data().bookingType === "shop-owner")
      .map((item) => fromDocument(item.id, item.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))), onError);
}

export function subscribeToShopProfile(
  callback: (profile: ProviderProfile | null) => void,
  onError: (error: Error) => void,
) {
  const user = requireUser();
  return onSnapshot(doc(db, "providers", user.uid), (snapshot) => {
    const profile = snapshot.exists() ? snapshot.data() as ProviderProfile : null;
    if (profile && (profile.role !== "shop-owner" || profile.uid !== user.uid)) {
      onError(new Error("This business profile is not a Shop Owner profile."));
      return;
    }
    callback(profile);
  }, onError);
}

export type ShopProfileInput = Pick<ProviderProfile, "businessName" | "phone" | "address" | "latitude" | "longitude">;

export async function saveShopProfile(input: ShopProfileInput): Promise<void> {
  const user = requireUser();
  const businessName = input.businessName.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  if (!businessName || businessName.length > 120) throw new Error("Enter a shop name of up to 120 characters.");
  if (!phone || phone.length > 30) throw new Error("Enter a contact number of up to 30 characters.");
  if (!address || address.length > 300) throw new Error("Enter a shop address of up to 300 characters.");
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90
    || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180
    || (input.latitude === 0 && input.longitude === 0)) {
    throw new Error("Enter valid shop coordinates.");
  }
  // Only editable business fields: preserve existing verification, rating and availability.
  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, "providers", user.uid);
    const listingRef = doc(db, "providerListings", user.uid);
    const profile = (await transaction.get(profileRef)).data();
    const listing = (await transaction.get(listingRef)).data();
    transaction.update(profileRef, { businessName, phone, address, latitude: input.latitude, longitude: input.longitude });
    if (profile?.verified === true && listing?.role === "shop-owner" && listing.visibility === "active") {
      transaction.update(listingRef, { businessName, location: { latitude: input.latitude, longitude: input.longitude } });
    }
  });
}

export async function setShopAvailability(status: "open" | "closed"): Promise<void> {
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "providers", user.uid);
    const snapshot = await transaction.get(reference);
    const listingRef = doc(db, "providerListings", user.uid);
    const listing = (await transaction.get(listingRef)).data();
    const profile = snapshot.data() as ProviderProfile | undefined;
    if (!profile || profile.uid !== user.uid || profile.role !== "shop-owner") throw new Error("Shop profile not found.");
    if (status === "open" && (!profile.businessName.trim() || !profile.phone.trim() || !profile.address.trim()
      || !Number.isFinite(profile.latitude) || Math.abs(profile.latitude) > 90
      || !Number.isFinite(profile.longitude) || Math.abs(profile.longitude) > 180
      || (profile.latitude === 0 && profile.longitude === 0))) {
      throw new Error("Complete your shop name, contact number, address and location in Profile before opening.");
    }
    transaction.update(reference, { status });
    if (profile.verified === true && listing?.role === "shop-owner" && listing.visibility === "active") {
      transaction.update(listingRef, { availability: status === "open" ? "available" : "offline" });
    }
  });
}

export async function updateShopBookingStatus(id: string, status: ShopBookingStatus): Promise<void> {
  const user = requireUser();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "bookings", id);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Request not found.");
    const booking = snapshot.data() as ShopBookingRequest;
    if (booking.providerId !== user.uid || booking.bookingType !== "shop-owner") {
      throw new Error("You are not assigned to this shop request.");
    }
    if (!SHOP_TRANSITIONS[booking.status]?.includes(status)) {
      throw new Error("This request has changed. Check its current status before trying again.");
    }
    if (status === "accepted") {
      const profile = await transaction.get(doc(db, "providers", user.uid));
      if (profile.data()?.status !== "open") throw new Error("Open your shop before accepting requests.");
      if (profile.data()?.verified !== true) throw new Error("Your shop must be approved before accepting requests.");
    }
    transaction.update(reference, { status, updatedAt: serverTimestamp() });
  });
}
