export type ShopVerificationStatus = "INCOMPLETE" | "PENDING" | "VERIFIED" | "REJECTED";
export interface ShopVerificationProfile {
  uid: string;
  role: "shop-owner";
  business: { name: string; contactPerson: string; phone: string; address: string; latitude: number; longitude: number; operatingHours: string; description: string; startingPrice: string };
  services: string[];
  vehicleTypes: string[];
  documents: { businessPermitUrl: string; supportingDocumentUrl: string | null };
  shopPhotos: string[];
  verificationStatus: ShopVerificationStatus;
}
