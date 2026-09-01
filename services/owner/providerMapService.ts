import { collection, getDocs, query, where } from "firebase/firestore";

import {
  MOCK_PROVIDERS,
  type MockProvider,
  type ProviderCategory,
} from "../../data/owner/mockProviders";
import type { ProviderListing } from "../../types/providerListing";
import { db } from "../firebase";
import { getProviderReviewSummary, type ProviderReviewSummary } from "./ratingService";

const LISTINGS_COLLECTION = "providerListings";

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
  }
}

function isActiveListing(value: unknown): value is ProviderListing {
  if (!value || typeof value !== "object") return false;

  const listing = value as Partial<ProviderListing>;
  return listing.visibility === "active"
    && (listing.role === "onsite-mechanic" || listing.role === "towing-company")
    && (listing.category === "Onsite Mechanics" || listing.category === "Towing")
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
    description: services.length
      ? `${listing.businessName} offers ${services.slice(0, 2).join(" and ")} in ${serviceArea || "its service area"}.`
      : `${listing.businessName} serves ${serviceArea || "its service area"}.`,
    services,
    hours: listing.operatingHours ?? "Hours not provided",
    emergencyServiceAvailable: listing.emergencyServiceAvailable,
    // ProviderListing deliberately contains no contact number; reviews come
    // from the public, rule-validated providerReviews collection.
    phone: "",
    vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"],
    reviews: reviewSummary.reviews,
  };
}

/**
 * Loads only trusted, active public listing documents. Private `users` and
 * profile collections are never read by the customer map.
 */
export async function loadCustomerMapProviders(): Promise<MockProvider[]> {
  try {
    const listingQuery = query(
      collection(db, LISTINGS_COLLECTION),
      where("visibility", "==", "active")
    );
    const snapshot = await getDocs(listingQuery);
    const listings = snapshot.docs
      .map((document) => document.data())
      .filter(isActiveListing);

    if (listings.length === 0) return MOCK_PROVIDERS;

    const providers = await Promise.all(listings.map(async (listing) => {
      let reviewSummary: ProviderReviewSummary = { average: 0, count: 0, reviews: [] };
      try {
        reviewSummary = await getProviderReviewSummary(listing.providerId);
      } catch (error) {
        console.warn(`Failed to load reviews for provider ${listing.providerId}`, error);
      }
      return toMapProvider(listing, reviewSummary);
    }));

    return providers;
  } catch (error) {
    console.error("Failed to load public provider listings", error);
    return MOCK_PROVIDERS;
  }
}
