import { collection, onSnapshot, query, where } from "firebase/firestore";

import type { MockProvider, ProviderCategory } from "../../data/owner/mockProviders";
import { isBookableShopListing, type ProviderListing } from "../../types/providerListing";
import { db } from "../firebase";
import { getProviderReviewSummary, type ProviderReviewSummary } from "./ratingService";

const LISTINGS_COLLECTION = "providerListings";

/** Live shop availability; only currently open shops are discoverable. */
export function subscribeToCustomerMapShops(callback: (shops: MockProvider[]) => void, onError: (error: Error) => void) {
  let generation = 0;
  const stop = onSnapshot(query(collection(db, LISTINGS_COLLECTION), where("visibility", "==", "active"),
    where("role", "==", "shop-owner"), where("availability", "==", "available")), (snapshot) => {
    const currentGeneration = ++generation;
    const listings = snapshot.docs.map((item) => item.data()).filter(isActiveListing);
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
      if (generation === currentGeneration) callback(shops);
    });
  }, onError);
  return () => {
    generation += 1;
    stop();
  };
}

/** Live listings for all other provider types; offline providers leave the map immediately. */
export function subscribeToCustomerMapProviders(callback: (providers: MockProvider[]) => void, onError: (error: Error) => void) {
  let generation = 0;
  const stop = onSnapshot(query(
    collection(db, LISTINGS_COLLECTION),
    where("visibility", "==", "active"),
    where("availability", "==", "available")
  ), (snapshot) => {
    const currentGeneration = ++generation;
    const listings = snapshot.docs
      .map((document) => document.data())
      .filter(isActiveListing)
      .filter((listing) => listing.availability === "available");

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
      || isBookableShopListing(listing as ProviderListing))
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
    // Provider listing phone numbers are explicitly published by providers.
    phone: listing.contactPhone ?? "",
    vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"],
    photoUrls: listing.photoUrls ?? [],
    reviews: reviewSummary.reviews,
  };
}

/**
 * Customer map access is constrained by the Firestore query to listings that
 * are active and currently available. Private profile collections are never read.
 */
