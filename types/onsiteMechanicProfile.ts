import type { PublicProviderListingInput } from "./providerListing";

export type VerificationStatus = "INCOMPLETE" | "PENDING" | "VERIFIED" | "REJECTED";

export interface OnsiteMechanicProviderProfile {
  uid: string;
  role: "onsite-mechanic";
  personal: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
    address: string;
    cityMunicipality: string;
  };
  professional: {
    yearsOfExperience: number;
    specializations?: string[];
    vehicleTypesServed?: string[];
    serviceArea: string;
    maxTravelDistanceKm?: number | null;
  };
  identification: {
    idType: string;
    idNumber: string;
    validIdUrl: string;
    validIdBackUrl?: string | null;
    profilePhotoUrl: string;
    facePhotoUrl?: string | null;
  };
  credentials: {
    tesdaCertificate: string;
    certificationNumber: string;
    certificateUrl: string | null;
  };
  serviceInfo: {
    serviceRate: number;
    emergencyServiceAvailable: boolean;
    availableDays: string[];
    availableHours: string;
  };
  /** Explicit provider-chosen data eligible for the public map after approval. */
  publicListing?: PublicProviderListingInput;
  verificationStatus: VerificationStatus;
}
