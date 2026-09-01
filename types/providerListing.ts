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
  services: string[];
  vehicleTypes: string[];
  operatingHours: string;
  startingPrice: number | null;
  emergencyServiceAvailable: boolean;
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
  role: "onsite-mechanic" | "towing-company";
  category: "Onsite Mechanics" | "Towing";
  businessName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  serviceAreaLabel: string;
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
  visibility: "active";
}
