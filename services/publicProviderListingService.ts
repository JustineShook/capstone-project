import { collection, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

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

/** Changes only availability on an existing verified mechanic listing. */
export async function updateMechanicAvailability(
  uid: string,
  availability: "available" | "offline"
): Promise<void> {
  await updateDoc(publicProviderListingRef(uid), { availability });
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
    ...((role === "onsite-mechanic" || role === "shop-owner") && input.hoursType ? { hoursType: input.hoursType, is24Hours: input.is24Hours === true, weeklyHours: input.weeklyHours ?? [] } : {}),
    ...(role === "homegarage" && input.totalSlots ? { totalSlots: input.totalSlots, availableSlots: input.availableSlots ?? input.totalSlots } : {}),
  };

  if (role === "shop-owner") {
    await runTransaction(db, async (transaction) => {
      const profile = (await transaction.get(doc(db, "providers", uid))).data();
      if (profile?.uid !== uid || profile.role !== "shop-owner" || profile.verified !== true) {
        throw new Error("Your shop must be approved before publishing a listing.");
      }
      const listingRef = publicProviderListingRef(uid);
      const currentListing = await transaction.get(listingRef);
      const shopListing = {
        ...listing,
        location: { latitude: profile.latitude, longitude: profile.longitude },
        availability: profile.status === "open" ? "available" : "offline",
        emergencyServiceAvailable: true,
      };

      if (currentListing.exists()) {
        // Existing listing updates are deliberately limited by Firestore rules
        // to provider-editable fields. Preserve system-owned compatibility,
        // identity, rating and visibility fields from the stored document.
        const {
          businessName,
          location,
          availability,
          serviceAreaLabel,
          description,
          contactPhone,
          services,
          vehicleTypes,
          operatingHours,
          startingPrice,
          emergencyServiceAvailable,
          photoUrls,
          hoursType,
          is24Hours,
          weeklyHours,
        } = shopListing;
        const providerEditableFields: Partial<ProviderListing> = {
          businessName,
          location,
          availability,
          serviceAreaLabel,
          description,
          services,
          vehicleTypes,
          operatingHours,
          startingPrice,
          emergencyServiceAvailable,
          photoUrls,
          hoursType,
          is24Hours,
          weeklyHours,
        };
        // updateDoc rejects undefined values. Older shop listings may not yet
        // have a public contact number, so omit it until the owner supplies one.
        if (contactPhone) providerEditableFields.contactPhone = contactPhone;
        transaction.update(listingRef, providerEditableFields);
      } else {
        transaction.set(listingRef, shopListing);
      }
    });
    return;
  }
  await setDoc(publicProviderListingRef(uid), listing);
  if (role === "homegarage" && input.totalSlots) await ensureParkingSlots(uid, input.totalSlots);
}
