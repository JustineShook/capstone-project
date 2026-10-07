/**
 * Provider-chosen values that are allowed to leave a private verification
 * profile. These are reviewed/approved before the trusted backend projects a
 * `ProviderListing`; they never include an address or personal contact data.
 */
export interface PublicProviderListingInput {
  businessName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  availability: "available" | "busy" | "offline";
  serviceAreaLabel: string;
  description: string;
  contactPhone?: string;
  services: string[];
  vehicleTypes: string[];
  operatingHours: string;
  startingPrice: number | null;
  emergencyServiceAvailable: boolean;
  photoUrls?: string[];
  hoursType?: "24_7" | "same_daily" | "weekly";
  is24Hours?: boolean;
  weeklyHours?: { day: string; open: boolean; openingTime: string | null; closingTime: string | null }[];
  /** Parking-only capacity. Kept independent of provider availability. */
  totalSlots?: number;
  availableSlots?: number;
}

/**
 * The intentionally limited, customer-safe projection of a provider.
 *
 * This is the only shape intended for `providerListings/{providerId}`.
 * Verification documents and private profile details must remain in their
 * existing user-owned documents.
 */
export interface ProviderListing {
  providerId: string;
  role: "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage";
  category: "Onsite Mechanics" | "Towing" | "Auto Shops" | "Parking Lots";
  businessName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  serviceAreaLabel: string;
  description: string;
  contactPhone?: string;
  availability: "available" | "busy" | "offline";
  ratingSummary: {
    average: number;
    count: number;
  };
  services: string[];
  vehicleTypes: string[];
  startingPrice: number | null;
  operatingHours: string;
  emergencyServiceAvailable: boolean;
  photoUrls?: string[];
  hoursType?: "24_7" | "same_daily" | "weekly";
  is24Hours?: boolean;
  weeklyHours?: { day: string; open: boolean; openingTime: string | null; closingTime: string | null }[];
  totalSlots?: number;
  availableSlots?: number;
  visibility: "active";
}

/** Shop listings can only be published after admin approval (enforced by rules). */
export function isBookableShopListing(listing: ProviderListing | null | undefined): listing is ProviderListing {
  return Boolean(listing && listing.role === "shop-owner" && listing.category === "Auto Shops"
    && listing.visibility === "active" && listing.availability === "available"
    && listing.emergencyServiceAvailable === true);
}
