import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

import { isBookableShopListing, type ProviderListing, type PublicProviderListingInput } from "../types/providerListing";
import { db } from "./firebase";

type ProviderRole = ProviderListing["role"];

function logListingDiagnostic(role: ProviderRole, phase: string, error: unknown) {
  const safeError = typeof error === "object" && error !== null ? error as { code?: unknown; name?: unknown } : null;
  console.error("Public listing diagnostic", {
    role,
    phase,
    code: typeof safeError?.code === "string" ? safeError.code : "unknown",
    errorName: typeof safeError?.name === "string" ? safeError.name : "Error",
  });
}

type SafeCondition = boolean | "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHomeGarageServiceListValid(services: unknown): boolean {
  const allowed = new Set([
    "Oil change",
    "Brake service",
    "Engine repair",
    "Battery service",
    "Tire service",
    "Air-conditioning service",
  ]);
  return Array.isArray(services)
    && services.length > 0
    && services.length <= allowed.size
    && services.every((service) => typeof service === "string" && allowed.has(service));
}

async function logHomeGarageWriteDiagnostic(uid: string, listing: ProviderListing, error: unknown) {
  const errorRecord = isRecord(error) ? error : {};
  const message = typeof errorRecord.message === "string" ? errorRecord.message : "";
  const expressionLimitDetected: SafeCondition = /maximum\s+of\s+\d+\s+expressions|expression\s+evaluation\s+limit/i.test(message)
    ? true
    : "unknown";

  const reads = await Promise.allSettled([
    getDoc(publicProviderListingRef(uid)),
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "users", uid, "homeGarageVerification", "profile")),
  ]);
  const [listingRead, accountRead, approvalRead] = reads;
  const existingListing: SafeCondition = listingRead.status === "fulfilled" ? listingRead.value.exists() : "unknown";

  let ratingSummaryWouldChange: SafeCondition = "unknown";
  let visibilityChanging: SafeCondition = "unknown";
  if (listingRead.status === "fulfilled") {
    if (!listingRead.value.exists()) {
      ratingSummaryWouldChange = false;
      visibilityChanging = false;
    } else {
      const current = listingRead.value.data();
      const currentRating = current.ratingSummary;
      const outgoingRating = listing.ratingSummary;
      ratingSummaryWouldChange = !isRecord(currentRating)
        || currentRating.average !== outgoingRating.average
        || currentRating.count !== outgoingRating.count
        || Object.keys(currentRating).length !== 2;
      visibilityChanging = current.visibility !== listing.visibility;
    }
  }

  let accountActive: SafeCondition = "unknown";
  let accountRoleIsHomeGarage: SafeCondition = "unknown";
  if (accountRead.status === "fulfilled") {
    const account = accountRead.value.data();
    accountActive = !account || account.accountStatus === undefined || account.accountStatus === "active";
    accountRoleIsHomeGarage = !!account && account.role === "homegarage";
  }

  let approvalVerified: SafeCondition = "unknown";
  if (approvalRead.status === "fulfilled" && accountRead.status === "fulfilled") {
    const approval = approvalRead.value.data();
    const account = accountRead.value.data();
    const business = approval?.business;
    approvalVerified = !!account
      && account.role === "homegarage"
      && !!approval
      && approval.uid === uid
      && approval.role === "homegarage"
      && approval.verificationStatus === "VERIFIED"
      && isRecord(business)
      && typeof business.name === "string"
      && business.name.trim().length > 0;
  }

  const hasTotalSlots = Object.prototype.hasOwnProperty.call(listing, "totalSlots");
  const hasAvailableSlots = Object.prototype.hasOwnProperty.call(listing, "availableSlots");
  const capacityFieldsValid: SafeCondition = !hasTotalSlots && !hasAvailableSlots
    ? true
    : hasTotalSlots && hasAvailableSlots
      && Number.isInteger(listing.totalSlots)
      && Number.isInteger(listing.availableSlots)
      && (listing.totalSlots ?? 0) >= 1
      && (listing.totalSlots ?? 0) <= 500
      && (listing.availableSlots ?? -1) >= 0
      && (listing.availableSlots ?? Number.MAX_SAFE_INTEGER) <= (listing.totalSlots ?? -1);
  const scheduleFieldsValid: SafeCondition = typeof listing.acceptsScheduledBookings === "boolean";

  const safeError = isRecord(error) ? error : {};
  console.error("Public listing diagnostic", {
    role: "homegarage",
    phase: "listing-write",
    code: typeof safeError.code === "string" ? safeError.code : "unknown",
    errorName: typeof safeError.name === "string" ? safeError.name : "Error",
    existingListing,
    accountActive,
    accountRoleIsHomeGarage,
    approvalVerified,
    servicesValid: isHomeGarageServiceListValid(listing.services),
    ratingSummaryWouldChange,
    capacityFieldsValid,
    scheduleFieldsValid,
    visibilityChanging,
    expressionLimitDetected,
  });
}

const publicProviderListingRef = (uid: string) => doc(db, "providerListings", uid);

async function ensureParkingSlots(uid: string, totalSlots: number) {
  let existing;
  try {
    existing = await getDocs(query(collection(db, "parkingSlots"), where("providerId", "==", uid)));
  } catch (error) {
    logListingDiagnostic("homegarage", "parking-slot-query", error);
    throw error;
  }
  const present = new Set(existing.docs.map((item) => item.data().slotNumber));
  const missing = Array.from({ length: totalSlots }, (_, index) => index + 1).filter((number) => !present.has(number));
  if (!missing.length) return;
  const batch = writeBatch(db);
  missing.forEach((slotNumber) => batch.set(doc(db, "parkingSlots", `${uid}_${slotNumber}`), { providerId: uid, slotNumber, status: "available", customerId: null, bookingId: null }));
  try {
    await batch.commit();
  } catch (error) {
    logListingDiagnostic("homegarage", "parking-slot-create-commit", error);
    throw error;
  }
}

export async function getPublicProviderListing(uid: string): Promise<ProviderListing | null> {
  const snapshot = await getDoc(publicProviderListingRef(uid));
  return snapshot.exists() ? (snapshot.data() as ProviderListing) : null;
}

/** Streams only an approved, open shop listing to a customer request screen. */
export function subscribeToBookableShopListing(
  uid: string,
  callback: (listing: ProviderListing | null) => void,
  onError: (error: Error) => void,
  scheduled = false
) {
  return onSnapshot(publicProviderListingRef(uid), (snapshot) => {
    const listing = snapshot.exists() ? snapshot.data() as ProviderListing : null;
    const eligible = listing && listing.role === "shop-owner" && listing.category === "Auto Shops"
      && listing.visibility === "active" && listing.emergencyServiceAvailable === true
      && (scheduled ? listing.acceptsScheduledBookings === true : listing.availability === "available");
    callback(eligible && listing?.providerId === uid ? listing : null);
  }, onError);
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
    acceptsScheduledBookings: input.acceptsScheduledBookings === true,
    ...(input.photoUrls ? { photoUrls: [...input.photoUrls] } : {}),
    ...((role === "onsite-mechanic" || role === "shop-owner") && input.hoursType ? { hoursType: input.hoursType, is24Hours: input.is24Hours === true, weeklyHours: input.weeklyHours ?? [] } : {}),
    ...(role === "homegarage" && input.totalSlots ? { totalSlots: input.totalSlots, availableSlots: input.availableSlots ?? input.totalSlots } : {}),
  };

  if (role === "shop-owner") {
    try {
      await runTransaction(db, async (transaction) => {
      const profile = (await transaction.get(doc(db, "providers", uid))).data();
      if (profile?.uid !== uid || profile.role !== "shop-owner" || profile.verified !== true) {
        throw new Error("Your shop must be approved before publishing a listing.");
      }
      const listingRef = publicProviderListingRef(uid);
      const currentListing = await transaction.get(listingRef);
      const shopListing: ProviderListing = {
        ...listing,
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
          acceptsScheduledBookings,
          photoUrls,
          hoursType,
          is24Hours,
          weeklyHours,
        } = shopListing;
        const providerEditableFields: Partial<ProviderListing> = {
          businessName,
          location,
          availability: shopListing.availability,
          serviceAreaLabel,
          description,
          services: [...services],
          vehicleTypes: [...vehicleTypes],
          operatingHours,
          startingPrice,
          emergencyServiceAvailable,
          acceptsScheduledBookings,
          // Submitting the public listing form is an explicit publish action.
          // Rules allow this visibility transition only while the account is active.
          visibility: shopListing.visibility,
        };
        if (photoUrls) providerEditableFields.photoUrls = [...photoUrls];
        if (hoursType) {
          providerEditableFields.hoursType = hoursType;
          providerEditableFields.is24Hours = is24Hours;
          providerEditableFields.weeklyHours = weeklyHours ?? [];
        }
        // updateDoc rejects undefined values. Older shop listings may not yet
        // have a public contact number, so omit it until the owner supplies one.
        if (contactPhone) providerEditableFields.contactPhone = contactPhone;
        transaction.update(listingRef, providerEditableFields);
      } else {
        transaction.set(listingRef, shopListing);
      }
      });
    } catch (error) {
      logListingDiagnostic("shop-owner", "listing-transaction", error);
      throw error;
    }
    return;
  }
  try {
    await setDoc(publicProviderListingRef(uid), listing);
  } catch (error) {
    if (role === "homegarage") {
      try {
        await logHomeGarageWriteDiagnostic(uid, listing, error);
      } catch {
        // Diagnostics must never replace the original write error.
        logListingDiagnostic(role, "listing-write", error);
      }
    }
    throw error;
  }
  if (role === "homegarage" && input.totalSlots) await ensureParkingSlots(uid, input.totalSlots);
}
