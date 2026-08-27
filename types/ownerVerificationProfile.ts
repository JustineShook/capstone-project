import type { VerificationStatus } from "./onsiteMechanicProfile";

export interface OwnerVerificationProfile {
  uid: string;
  role: "owner";
  personal: {
    fullName: string;
    phone: string;
    address: string;
    cityMunicipality: string;
  };
  identification: {
    idType: string;
    idNumber: string;
    validIdUrl: string;
    profilePhotoUrl: string;
  };
  vehicleDocuments: {
    orCrUrl: string | null;
  };
  verificationStatus: VerificationStatus;
}
