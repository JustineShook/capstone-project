import type { VerificationStatus } from "./onsiteMechanicProfile";
import type { PublicProviderListingInput } from "./providerListing";

export interface TowingCompanyProfile {
  uid: string;
  role: "towing-company";
  company: {
    companyName: string;
    phone: string;
    address: string;
    cityMunicipality: string;
    operatingHours: string;
  };
  services: {
    towingServices: string[];
    vehicleTypesSupported: string[];
    serviceArea: string;
    emergencyServiceAvailable: boolean;
  };
  representative: {
    fullName: string;
    governmentIdType: string;
    governmentIdNumber: string;
    validIdUrl: string;
    profilePhotoUrl: string;
  };
  businessDocuments: {
    permitOrRegistrationNumber: string;
    permitOrRegistrationUrl: string;
  };
  /** Explicit provider-chosen data eligible for the public map after approval. */
  publicListing?: PublicProviderListingInput;
  verificationStatus: VerificationStatus;
}
