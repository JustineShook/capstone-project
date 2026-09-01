import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
    MOCK_PROVIDERS,
    type MockProvider,
    type ProviderCategory,
} from "../../data/owner/mockProviders";
import type { OnsiteMechanicProviderProfile } from "../../types/onsiteMechanicProfile";
import type { TowingCompanyProfile } from "../../types/towingCompanyProfile";
import { db } from "../firebase";

type MapProviderRole = "onsite-mechanic" | "towing-company";

type AddressableProfile =
  | { role: "onsite-mechanic"; profile: OnsiteMechanicProviderProfile }
  | { role: "towing-company"; profile: TowingCompanyProfile };

const GEOCODE_CACHE = new Map<string, { lat: number; lng: number } | null>();
const FALLBACK_POINTS: Record<Exclude<ProviderCategory, "All">, { lat: number; lng: number }[]> = {
  Towing: [
    { lat: 10.3201, lng: 123.9021 },
    { lat: 10.317, lng: 123.904 },
    { lat: 10.311, lng: 123.91 },
  ],
  "Auto Shops": [
    { lat: 10.3195, lng: 123.9095 },
    { lat: 10.3156, lng: 123.915 },
    { lat: 10.323, lng: 123.896 },
  ],
  "Onsite Mechanics": [
    { lat: 10.3155, lng: 123.9012 },
    { lat: 10.3182, lng: 123.9134 },
    { lat: 10.3097, lng: 123.9088 },
  ],
};

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const normalized = address.trim();
  if (!normalized) {
    return null;
  }

  const cached = GEOCODE_CACHE.get(normalized.toLowerCase());
  if (cached !== undefined) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalized)}`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );

    const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const firstMatch = payload[0];
    const lat = Number(firstMatch?.lat ?? NaN);
    const lng = Number(firstMatch?.lon ?? NaN);
    const result = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    GEOCODE_CACHE.set(normalized.toLowerCase(), result);
    return result;
  } catch (error) {
    console.warn("Failed to geocode provider address for map", error);
    GEOCODE_CACHE.set(normalized.toLowerCase(), null);
    return null;
  }
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "V";
}

function pickFallbackLocation(category: Exclude<ProviderCategory, "All">, index: number) {
  const points = FALLBACK_POINTS[category];
  return points[index % points.length];
}

function buildReviewCount(index: number) {
  return 42 + index * 19;
}

function buildDistanceKm(index: number) {
  return Number((0.4 + (index % 5) * 0.7 + (index % 3) * 0.2).toFixed(1));
}

async function normalizeProfile(role: MapProviderRole, uid: string, profile: unknown): Promise<MockProvider | null> {
  if (role === "onsite-mechanic") {
    const mechanic = profile as OnsiteMechanicProviderProfile;
    const fullName = mechanic.personal?.fullName?.trim() || "Onsite Mechanic";
    const city = mechanic.personal?.cityMunicipality?.trim() || mechanic.professional?.serviceArea?.trim() || "Cebu City";
    const address = [mechanic.personal?.address, city].filter(Boolean).join(", ");
    const services = mechanic.professional?.specializations?.length
      ? mechanic.professional.specializations
      : ["Battery Jumpstart", "Flat Tire Repair", "Minor Engine Diagnostics"];
    const rate = mechanic.serviceInfo?.serviceRate ?? 450;
    const vehicleTypes = mechanic.professional?.vehicleTypesServed?.length
      ? mechanic.professional.vehicleTypesServed
      : ["Sedan", "SUV"];
    const location = (await geocodeAddress(address || city)) ?? pickFallbackLocation("Onsite Mechanics", uid.length);

    return {
      id: `live-mechanic-${uid}`,
      name: fullName,
      category: "Onsite Mechanics",
      rating: 4.7 + (uid.length % 3) * 0.05,
      reviewCount: buildReviewCount(uid.length),
      distanceKm: buildDistanceKm(uid.length),
      startingPrice: `₱${rate}`,
      isPositiveStatus: mechanic.verificationStatus === "VERIFIED" || mechanic.verificationStatus === "PENDING",
      initials: buildInitials(fullName),
      color: "#6A1B9A",
      lat: location.lat,
      lng: location.lng,
      description:
        `${fullName} provides mobile repairs across ${city} and nearby areas, including ${services.slice(0, 2).join(" and ")}.`,
      services,
      hours: mechanic.serviceInfo?.availableHours?.trim() || "Daily, 7:00 AM - 9:00 PM",
      phone: mechanic.personal?.phone?.trim() || "+63 917 000 0000",
      vehicleTypes: vehicleTypes as MockProvider["vehicleTypes"],
      reviews: [
        {
          id: `${uid}-review-1`,
          customerName: "Verified customer",
          rating: 5,
          comment: "Fast and reliable onsite repair service.",
          date: "Recently",
        },
      ],
    };
  }

  const tow = profile as TowingCompanyProfile;
  const companyName = tow.company?.companyName?.trim() || "Towing Company";
  const city = tow.company?.cityMunicipality?.trim() || tow.services?.serviceArea?.trim() || "Cebu City";
  const address = [tow.company?.address, city].filter(Boolean).join(", ");
  const services = tow.services?.towingServices?.length
    ? tow.services.towingServices
    : ["Emergency Towing", "Roadside Assistance", "Vehicle Recovery"];
  const location = (await geocodeAddress(address || city)) ?? pickFallbackLocation("Towing", uid.length);

  return {
    id: `live-tow-${uid}`,
    name: companyName,
    category: "Towing",
    rating: 4.8 + (uid.length % 3) * 0.06,
    reviewCount: buildReviewCount(uid.length + 5),
    distanceKm: buildDistanceKm(uid.length + 2),
    startingPrice: "₱1,200",
    isPositiveStatus: tow.verificationStatus === "VERIFIED" || tow.verificationStatus === "PENDING",
    initials: buildInitials(companyName),
    color: "#D32F2F",
    lat: location.lat,
    lng: location.lng,
    description:
      `${companyName} provides emergency towing and recovery in ${city}, with ${services.slice(0, 2).join(" and ")} available on demand.`,
    services,
    hours: tow.company?.operatingHours?.trim() || "Open 24 hours",
    phone: tow.company?.phone?.trim() || "+63 917 000 0000",
    vehicleTypes: tow.services?.vehicleTypesSupported?.length
      ? (tow.services.vehicleTypesSupported as MockProvider["vehicleTypes"])
      : ["Sedan", "SUV", "Pickup"],
    reviews: [
      {
        id: `${uid}-review-1`,
        customerName: "Verified client",
        rating: 5,
        comment: "Quick response and professional towing support.",
        date: "Recently",
      },
    ],
  };
}

async function readProfileForRole(uid: string, role: MapProviderRole): Promise<unknown | null> {
  const profilePath = role === "onsite-mechanic"
    ? doc(db, "users", uid, "providerProfile", "profile")
    : doc(db, "users", uid, "towingCompanyProfile", "profile");

  const snapshot = await getDoc(profilePath);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}

export async function loadCustomerMapProviders(): Promise<MockProvider[]> {
  try {
    const userDocs = await getDocs(collection(db, "users"));
    const liveProviders: MockProvider[] = [];

    for (const userDoc of userDocs.docs) {
      const userData = userDoc.data() as { role?: string };
      const role = userData.role;
      if (role !== "onsite-mechanic" && role !== "towing-company") {
        continue;
      }

      const profile = await readProfileForRole(userDoc.id, role as MapProviderRole);
      if (!profile) {
        continue;
      }

      const nextProvider = await normalizeProfile(role as MapProviderRole, userDoc.id, profile);
      if (nextProvider) {
        liveProviders.push(nextProvider);
      }
    }

    if (liveProviders.length > 0) {
      return liveProviders;
    }
  } catch (error) {
    console.error("Failed to load real map providers", error);
  }

  return MOCK_PROVIDERS;
}
