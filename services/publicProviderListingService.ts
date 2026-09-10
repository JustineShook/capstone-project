import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";

import type { ProviderListing, PublicProviderListingInput } from "../types/providerListing";
import { db } from "./firebase";

type ProviderRole = ProviderListing["role"];

const publicProviderListingRef = (uid: string) => doc(db, "providerListings", uid);

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
    : role === "shop-owner" ? "Auto Shops" : "Towing";

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
    startingPrice: input.startingPrice,
    operatingHours: input.operatingHours,
    emergencyServiceAvailable: input.emergencyServiceAvailable,
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
}
