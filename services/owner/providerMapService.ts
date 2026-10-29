import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

import type { MockProvider, ProviderCategory } from "../../data/owner/mockProviders";
import type { ProviderListing } from "../../types/providerListing";
import { auth, db } from "../firebase";
import { getProviderContactPhone } from "../providerContactService";
import { getProviderReviewSummary, type ProviderReviewSummary } from "./ratingService";

const LISTINGS_COLLECTION = "providerListings";
const DIRECTORY_COLLECTION = "publicProviderDirectory";
const GUEST_RETRY_INTERVAL_MS = 60_000;

/** Live shops; schedule discovery includes offline shops that opted in. */
export function subscribeToCustomerMapShops(callback: (shops: MockProvider[]) => void, onError: (error: Error) => void, scheduled = false) {
  if (!auth.currentUser) return subscribeToGuestDirectory(callback, onError, scheduled, true);

  let generation = 0;
  const stop = onSnapshot(query(collection(db, LISTINGS_COLLECTION), where("visibility", "==", "active"),
    where("role", "==", "shop-owner"), ...(scheduled ? [where("acceptsScheduledBookings", "==", true)] : [where("availability", "==", "available")])), (snapshot) => {
    const currentGeneration = ++generation;
    const listings = snapshot.docs.map((item) => item.data()).filter(isActiveListing);
    if (listings.length === 0) {
      callback([]);
      return;
    }

    // Publish the newest listing fields immediately. Review totals are loaded
    // separately and can take longer than the public listing snapshot.
    callback(listings.map((listing) => toMapProvider(listing, {
      average: listing.ratingSummary.average,
      count: listing.ratingSummary.count,
      reviews: [],
    }, undefined, "loading")));

    if (!auth.currentUser) return;
    void Promise.all(listings.map(async (listing) => {
      let reviewSummary: ProviderReviewSummary = { average: 0, count: 0, reviews: [] };
      let ratingStatus: NonNullable<MockProvider["ratingStatus"]> = "visible";
      try {
        reviewSummary = await getProviderReviewSummary(listing.providerId);
      } catch (error) {
        console.warn(`Failed to load reviews for auto shop ${listing.providerId}`, error);
        reviewSummary = { average: listing.ratingSummary.average, count: listing.ratingSummary.count, reviews: [] };
        ratingStatus = "unavailable";
      }
      const phone = await getProviderContactPhone(listing.providerId).catch(() => listing.contactPhone ?? "");
      return toMapProvider(listing, reviewSummary, phone, ratingStatus);
    })).then((shops) => {
      // Review requests from an older listing snapshot must never restore its
      // stale business details over the latest listener result.
      if (generation === currentGeneration) callback(shops);
    });
  }, onError);
  return () => {
    generation += 1;
    stop();
  };
}

/** Schedule mode queries only providers who opted in, regardless of current availability. */
export function subscribeToCustomerMapProviders(callback: (providers: MockProvider[]) => void, onError: (error: Error) => void, scheduled = false) {
  if (!auth.currentUser) return subscribeToGuestDirectory(callback, onError, scheduled, false);

  let generation = 0;
  const stop = onSnapshot(query(
    collection(db, LISTINGS_COLLECTION),
    where("visibility", "==", "active"),
    ...(scheduled ? [where("acceptsScheduledBookings", "==", true)] : [where("availability", "==", "available")]),
  ), (snapshot) => {
    const currentGeneration = ++generation;
    const listings = snapshot.docs
      .map((document) => document.data())
      .filter(isActiveListing)
      .filter((listing) => scheduled
        ? listing.acceptsScheduledBookings === true
        : listing.availability === "available");

    if (listings.length === 0) {
      callback([]);
      return;
    }

    if (!auth.currentUser) {
      callback(listings.map((listing) => toMapProvider(listing, {
        average: listing.ratingSummary.average, count: listing.ratingSummary.count, reviews: [],
      }, undefined, "hidden")));
      return;
    }
    void Promise.all(listings.map(async (listing) => {
      let reviewSummary: ProviderReviewSummary = { average: 0, count: 0, reviews: [] };
      let ratingStatus: NonNullable<MockProvider["ratingStatus"]> = "visible";
      try {
        reviewSummary = await getProviderReviewSummary(listing.providerId);
      } catch (error) {
        console.warn(`Failed to load reviews for provider ${listing.providerId}`, error);
        ratingStatus = "unavailable";
      }
      const phone = await getProviderContactPhone(listing.providerId).catch(() => listing.contactPhone ?? "");
      return toMapProvider(listing, reviewSummary, phone, ratingStatus);
    })).then((providers) => {
      if (generation === currentGeneration) callback(providers);
    });
  }, onError);

  return () => {
    generation += 1;
    stop();
  };
}

/** Guests enumerate stable provider IDs, then fetch only individually authorized listings. */
function subscribeToGuestDirectory(
  callback: (providers: MockProvider[]) => void,
  onError: (error: Error) => void,
  scheduled: boolean,
  shopsOnly: boolean,
) {
  const providers = new Map<string, MockProvider>();
  const listingStops = new Map<string, () => void>();
  const deniedIds = new Set<string>();
  let retryTimer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const publish = () => callback([...providers.values()]);
  const clearRetryTimerIfIdle = () => {
    if (deniedIds.size === 0 && retryTimer !== undefined) {
      clearInterval(retryTimer);
      retryTimer = undefined;
    }
  };
  const startListingListener = (providerId: string) => {
    if (stopped || listingStops.has(providerId) || deniedIds.has(providerId)) return;
    const stopListing = onSnapshot(doc(db, LISTINGS_COLLECTION, providerId), (snapshot) => {
      deniedIds.delete(providerId);
      clearRetryTimerIfIdle();
      if (!snapshot.exists()) {
        providers.delete(providerId);
        publish();
        return;
      }

      const listing = snapshot.data() as ProviderListing;
      const modeEligible = scheduled
        ? listing.acceptsScheduledBookings === true
        : listing.availability === "available";
      const categoryEligible = !shopsOnly || listing.role === "shop-owner";
      if (listing.providerId !== providerId || !isActiveListing(listing) || !modeEligible || !categoryEligible) {
        providers.delete(providerId);
      } else {
        providers.set(providerId, toMapProvider(listing, {
          average: listing.ratingSummary.average,
          count: listing.ratingSummary.count,
          reviews: [],
        }, undefined, "hidden"));
      }
      publish();
    }, (error) => {
      listingStops.delete(providerId);
      providers.delete(providerId);
      publish();
      if (isPermissionDenied(error)) {
        deniedIds.add(providerId);
        if (retryTimer === undefined) {
          retryTimer = setInterval(() => {
            for (const deniedId of [...deniedIds]) {
              void getDoc(doc(db, LISTINGS_COLLECTION, deniedId)).then((snapshot) => {
                if (stopped || !snapshot.exists()) return;
                deniedIds.delete(deniedId);
                startListingListener(deniedId);
                clearRetryTimerIfIdle();
              }).catch((retryError) => {
                if (!isPermissionDenied(retryError)) onError(retryError as Error);
              });
            }
          }, GUEST_RETRY_INTERVAL_MS);
        }
      } else {
        onError(error);
      }
    });
    listingStops.set(providerId, stopListing);
  };

  const stopDirectory = onSnapshot(collection(db, DIRECTORY_COLLECTION), (snapshot) => {
    const providerIds = new Set(snapshot.docs.map((entry) => entry.id));
    for (const [providerId, stopListing] of listingStops) {
      if (!providerIds.has(providerId)) {
        stopListing();
        listingStops.delete(providerId);
        providers.delete(providerId);
      }
    }
    for (const providerId of [...deniedIds]) {
      if (!providerIds.has(providerId)) deniedIds.delete(providerId);
    }
    clearRetryTimerIfIdle();
    for (const providerId of providerIds) startListingListener(providerId);
    publish();
  }, onError);

  return () => {
    stopped = true;
    stopDirectory();
    for (const stopListing of listingStops.values()) stopListing();
    listingStops.clear();
    deniedIds.clear();
    if (retryTimer !== undefined) clearInterval(retryTimer);
  };
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "code" in error && (error as { code?: unknown }).code === "permission-denied";
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "V";
}

function categoryColor(category: Exclude<ProviderCategory, "All">) {
  switch (category) {
    case "Towing":
      return "#D32F2F";
    case "Onsite Mechanics":
      return "#6A1B9A";
    case "Auto Shops":
      return "#1E88E5";
    case "Parking Lots":
      return "#00897B";
  }
}

function isActiveListing(value: unknown): value is ProviderListing {
  if (!value || typeof value !== "object") return false;

  const listing = value as Partial<ProviderListing>;
  return listing.visibility === "active"
    && ((listing.role === "onsite-mechanic" && listing.category === "Onsite Mechanics")
      || (listing.role === "towing-company" && listing.category === "Towing")
      || (listing.role === "homegarage" && listing.category === "Parking Lots")
      || (listing.role === "shop-owner" && listing.category === "Auto Shops"
        && listing.emergencyServiceAvailable === true
        && (listing.availability === "available" || listing.acceptsScheduledBookings === true)))
    && typeof listing.providerId === "string"
    && typeof listing.businessName === "string"
    && typeof listing.location?.latitude === "number"
    && Number.isFinite(listing.location.latitude)
    && typeof listing.location?.longitude === "number"
    && Number.isFinite(listing.location.longitude)
    && (listing.availability === "available" || listing.availability === "busy" || listing.availability === "offline")
    && Array.isArray(listing.services)
    && Array.isArray(listing.vehicleTypes)
    && typeof listing.ratingSummary?.average === "number"
    && typeof listing.ratingSummary?.count === "number";
}

/** Converts the safe public listing document into the existing map UI model. */
function toMapProvider(
  listing: ProviderListing,
  reviewSummary: ProviderReviewSummary,
  privatePhone?: string,
  ratingStatus: NonNullable<MockProvider["ratingStatus"]> = auth.currentUser ? "visible" : "hidden",
): MockProvider {
  const category = listing.category;
  const services = listing.services.filter((service): service is string => typeof service === "string");
  const serviceArea = listing.serviceAreaLabel.trim();
  const startingPrice = listing.startingPrice == null
    ? "Contact for price"
    : `\u20B1${listing.startingPrice.toLocaleString("en-PH")}`;

  return {
    id: listing.providerId,
    name: listing.businessName.trim(),
    category,
    rating: reviewSummary.average,
    reviewCount: reviewSummary.count,
    ratingStatus,
    // The dashboard replaces this with Haversine distance whenever GPS is available.
    distanceKm: 0,
    startingPrice,
    isPositiveStatus: listing.availability === "available",
    initials: buildInitials(listing.businessName),
    color: categoryColor(category),
    lat: listing.location.latitude,
    lng: listing.location.longitude,
    description: listing.description?.trim() || (services.length
      ? `${listing.businessName} offers ${services.slice(0, 2).join(" and ")} in ${serviceArea || "its service area"}.`
      : `${listing.businessName} serves ${serviceArea || "its service area"}.`),
    services,
    hours: listing.operatingHours ?? "Hours not provided",
    emergencyServiceAvailable: listing.emergencyServiceAvailable,
    acceptsScheduledBookings: listing.acceptsScheduledBookings === true,
    phone: auth.currentUser ? privatePhone ?? listing.contactPhone ?? "" : "",
    vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"],
    photoUrls: listing.photoUrls ?? [],
    reviews: reviewSummary.reviews,
  };
}

/**
 * Customer map queries select active listings that are available now or have
 * explicitly enabled scheduling. Private profile collections are never read.
 */
