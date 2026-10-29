import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, where, writeBatch, type DocumentReference, type Transaction } from "firebase/firestore";

import { isBookableShopListing, type ProviderListing, type PublicProviderListingInput } from "../types/providerListing";
import { db } from "./firebase";
import { getProviderContactPhone } from "./providerContactService";

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
const publicProviderDirectoryRef = (uid: string) => doc(db, "publicProviderDirectory", uid);

function isDirectoryEligible(listing: Pick<ProviderListing, "availability" | "visibility" | "acceptsScheduledBookings" | "contactPhone">): boolean {
  return listing.visibility === "active"
    && !listing.contactPhone
    && (listing.availability === "available" || listing.acceptsScheduledBookings === true);
}

async function syncAvailability(uid: string, availability: ProviderListing["availability"]): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const listingRef = publicProviderListingRef(uid);
    const activeServiceRef = doc(db, "providerActiveServices", uid);
    const [snapshot, activeService] = await Promise.all([
      transaction.get(listingRef), transaction.get(activeServiceRef),
    ]);
    if (!snapshot.exists()) throw new Error("Create your public listing first.");
    const serviceLock = activeService.data();
    if (activeService.exists() && serviceLock?.providerId === uid && typeof serviceLock.bookingId === "string") {
      throw new Error("Availability is locked while you have an active service.");
    }
    const directoryRef = publicProviderDirectoryRef(uid);
    const directorySnapshot = await transaction.get(directoryRef);
    const listing = snapshot.data() as ProviderListing;
    const nextListing = { ...listing, availability };
    transaction.update(listingRef, { availability });
    if (!directorySnapshot.exists() && isDirectoryEligible(nextListing)) transaction.set(directoryRef, {});
  });
}

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
  if (!snapshot.exists()) return null;
  const listing = snapshot.data() as ProviderListing;
  if (!listing.contactPhone && listing.visibility === "active") {
    try {
      const contactPhone = await getProviderContactPhone(uid);
      if (contactPhone) listing.contactPhone = contactPhone;
    } catch {
      // Keep legacy listing data available if contact lookup is unavailable.
    }
  }
  return listing;
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

/** Changes only availability on an existing verified Towing listing. */
export async function updateTowingAvailability(uid: string, availability: "available" | "offline"): Promise<void> {
  await syncAvailability(uid, availability);
}

/** Changes only availability on an existing verified mechanic listing. */
export async function updateMechanicAvailability(
  uid: string,
  availability: "available" | "offline"
): Promise<void> {
  await syncAvailability(uid, availability);
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
  const submittedPhone = typeof input.contactPhone === "string" ? input.contactPhone.trim() : "";
  if (submittedPhone && (submittedPhone.length < 7 || submittedPhone.length > 30)) {
    throw new Error("Enter a valid contact number.");
  }
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
    startingPrice: input.startingPrice,
    operatingHours: input.operatingHours,
    emergencyServiceAvailable: input.emergencyServiceAvailable,
    acceptsScheduledBookings: input.acceptsScheduledBookings === true,
    contactPhone: "",
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
      const contactRef = doc(db, "providerContacts", uid);
      const existingContact = await transaction.get(contactRef);
      const directoryRef = publicProviderDirectoryRef(uid);
      const existingDirectory = await transaction.get(directoryRef);
      const oldListingPhone = currentListing.data()?.contactPhone;
      const oldContactPhone = existingContact.data()?.phone;
      const contactPhone = submittedPhone || validStoredPhone(oldContactPhone) || validStoredPhone(oldListingPhone);
      const shopListing: ProviderListing = {
        ...listing,
        availability: profile.status === "open" ? "available" : "offline",
        emergencyServiceAvailable: true,
      };
      const directoryCandidate = currentListing.exists()
        ? { ...currentListing.data(), ...shopListing, ratingSummary: currentListing.data()?.ratingSummary } as ProviderListing
        : shopListing;

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
        transaction.update(listingRef, { ...providerEditableFields, contactPhone: "" });
      } else {
        transaction.set(listingRef, shopListing);
      }
      writeContact(transaction, contactRef, uid, contactPhone);
      if (!existingDirectory.exists() && isDirectoryEligible(directoryCandidate)) transaction.set(directoryRef, {});
      });
    } catch (error) {
      logListingDiagnostic("shop-owner", "listing-transaction", error);
      throw error;
    }
    return;
  }
  try {
    await runTransaction(db, async (transaction) => {
      const listingRef = publicProviderListingRef(uid);
      const existing = await transaction.get(listingRef);
      const contactRef = doc(db, "providerContacts", uid);
      const existingContact = await transaction.get(contactRef);
      const directoryRef = publicProviderDirectoryRef(uid);
      const existingDirectory = await transaction.get(directoryRef);
      const oldListingPhone = existing.data()?.contactPhone;
      const oldContactPhone = existingContact.data()?.phone;
      const contactPhone = submittedPhone || validStoredPhone(oldContactPhone) || validStoredPhone(oldListingPhone);
      if (!existing.exists()) {
        transaction.set(listingRef, listing);
        writeContact(transaction, contactRef, uid, contactPhone);
        if (!existingDirectory.exists() && isDirectoryEligible(listing)) transaction.set(directoryRef, {});
        return;
      }
      const { providerId: _providerId, role: _role, category: _category, ratingSummary: _ratingSummary, ...editable } = listing;
      transaction.update(listingRef, { ...editable, contactPhone: "" });
      writeContact(transaction, contactRef, uid, contactPhone);
      if (!existingDirectory.exists() && isDirectoryEligible(listing)) transaction.set(directoryRef, {});
    });
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

function validStoredPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const phone = value.trim();
  return phone.length >= 7 && phone.length <= 30 ? phone : "";
}

function writeContact(
  transaction: Transaction,
  contactRef: DocumentReference,
  providerId: string,
  phone: string,
) {
  if (phone) transaction.set(contactRef, { providerId, phone });
  else transaction.delete(contactRef);
}
