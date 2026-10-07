import { collection, doc, getDoc, getDocs, query, runTransaction, setDoc, where, writeBatch } from "firebase/firestore";

import type { ProviderListing, PublicProviderListingInput } from "../types/providerListing";
import { db } from "./firebase";

type ProviderRole = ProviderListing["role"];

const publicProviderListingRef = (uid: string) => doc(db, "providerListings", uid);

async function ensureParkingSlots(uid: string, totalSlots: number) {
  const existing = await getDocs(query(collection(db, "parkingSlots"), where("providerId", "==", uid)));
  const present = new Set(existing.docs.map((item) => item.data().slotNumber));
  const missing = Array.from({ length: totalSlots }, (_, index) => index + 1).filter((number) => !present.has(number));
  if (!missing.length) return;
  const batch = writeBatch(db);
  missing.forEach((slotNumber) => batch.set(doc(db, "parkingSlots", `${uid}_${slotNumber}`), { providerId: uid, slotNumber, status: "available", customerId: null, bookingId: null }));
  await batch.commit();
}

export async function getPublicProviderListing(uid: string): Promise<ProviderListing | null> {
  const snapshot = await getDoc(publicProviderListingRef(uid));
  return snapshot.exists() ? (snapshot.data() as ProviderListing) : null;
}

/**
 * Writes the minimal map-compatible public document. Firestore Rules derive
 * authorization from the caller's verified private profile and enforce every
 * protected value below; none of these constants are provider-selectable.
 */
export async function updatePublicProviderListing(
  uid: string,
  role: ProviderRole,
  input: PublicProviderListingInput
): Promise<void> {
  const category: ProviderListing["category"] = role === "onsite-mechanic"
    ? "Onsite Mechanics"
    : role === "shop-owner" ? "Auto Shops" : role === "homegarage" ? "Parking Lots" : "Towing";

  const listing: ProviderListing = {
    providerId: uid,
    role,
    category,
    businessName: input.businessName,
    location: {
      latitude: input.location.latitude,
      longitude: input.location.longitude,
    },
    availability: input.availability,
    visibility: "active",
    ratingSummary: { average: 0, count: 0 },
    services: [...input.services],
    vehicleTypes: [...input.vehicleTypes],
    serviceAreaLabel: input.serviceAreaLabel,
    description: input.description,
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
    startingPrice: input.startingPrice,
    operatingHours: input.operatingHours,
    emergencyServiceAvailable: input.emergencyServiceAvailable,
    ...((role === "shop-owner" || role === "homegarage") && input.photoUrls ? { photoUrls: [...input.photoUrls] } : {}),
    ...(role === "shop-owner" && input.hoursType ? { hoursType: input.hoursType, is24Hours: input.is24Hours === true, weeklyHours: input.weeklyHours ?? [] } : {}),
    ...(role === "homegarage" && input.totalSlots ? { totalSlots: input.totalSlots, availableSlots: input.availableSlots ?? input.totalSlots } : {}),
  };

  if (role === "shop-owner") {
    await runTransaction(db, async (transaction) => {
      const profile = (await transaction.get(doc(db, "providers", uid))).data();
      if (profile?.uid !== uid || profile.role !== "shop-owner" || profile.verified !== true) {
        throw new Error("Your shop must be approved before publishing a listing.");
      }
      transaction.set(publicProviderListingRef(uid), {
        ...listing,
        businessName: profile.businessName,
        location: { latitude: profile.latitude, longitude: profile.longitude },
        availability: profile.status === "open" ? "available" : "offline",
        emergencyServiceAvailable: true,
      });
    });
    return;
  }
  await setDoc(publicProviderListingRef(uid), listing);
  if (role === "homegarage" && input.totalSlots) await ensureParkingSlots(uid, input.totalSlots);
}
