import { collection, onSnapshot, query, where } from "firebase/firestore";

import type { MockProvider, ProviderCategory } from "../../data/owner/mockProviders";
import type { ProviderListing } from "../../types/providerListing";
import { db } from "../firebase";
import { getProviderReviewSummary, type ProviderReviewSummary } from "./ratingService";

const LISTINGS_COLLECTION = "providerListings";

/** Live shops; schedule discovery includes offline shops that opted in. */
export function subscribeToCustomerMapShops(callback: (shops: MockProvider[]) => void, onError: (error: Error) => void, scheduled = false) {
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
    })));

    void Promise.all(listings.map(async (listing) => {
      let reviewSummary: ProviderReviewSummary = { average: 0, count: 0, reviews: [] };
      try {
        reviewSummary = await getProviderReviewSummary(listing.providerId);
      } catch (error) {
        console.warn(`Failed to load reviews for auto shop ${listing.providerId}`, error);
        reviewSummary = { average: listing.ratingSummary.average, count: listing.ratingSummary.count, reviews: [] };
      }
      return toMapProvider(listing, reviewSummary);
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
  let generation = 0;
  const stop = onSnapshot(query(
    collection(db, LISTINGS_COLLECTION),
    where("visibility", "==", "active"),
    ...(scheduled ? [where("acceptsScheduledBookings", "==", true)] : [where("availability", "==", "available")])
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

    void Promise.all(listings.map(async (listing) => {
      let reviewSummary: ProviderReviewSummary = { average: 0, count: 0, reviews: [] };
      try {
        reviewSummary = await getProviderReviewSummary(listing.providerId);
      } catch (error) {
        console.warn(`Failed to load reviews for provider ${listing.providerId}`, error);
      }
      return toMapProvider(listing, reviewSummary);
    })).then((providers) => {
      if (generation === currentGeneration) callback(providers);
    });
  }, onError);

  return () => {
    generation += 1;
    stop();
  };
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
function toMapProvider(listing: ProviderListing, reviewSummary: ProviderReviewSummary): MockProvider {
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
    // Provider listing phone numbers are explicitly published by providers.
    phone: listing.contactPhone ?? "",
    vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"],
    photoUrls: listing.photoUrls ?? [],
    reviews: reviewSummary.reviews,
  };
}

/**
 * Customer map queries select active listings that are available now or have
 * explicitly enabled scheduling. Private profile collections are never read.
 */
