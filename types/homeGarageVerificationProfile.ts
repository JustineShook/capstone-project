export interface HomeGarageVerificationProfile {
  uid: string;
  role: "homegarage";
  business: {
    name: string;
    contactPerson: string;
    phone: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  documents: { validIdUrl: string };
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
}
