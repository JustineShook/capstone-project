import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { PublicListingForm } from "../../components/provider/PublicListingForm";
import { auth } from "../../services/firebase";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import type { PublicProviderListingInput } from "../../types/providerListing";

export default function TowingPublicListingScreen() {
  const [initialListing, setInitialListing] = useState<Partial<PublicProviderListingInput> | null>();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setInitialListing(null);

    Promise.all([
      getTowingCompanyProfile(uid),
      getPublicProviderListing(uid).catch(() => null),
    ]).then(([profile, existing]) => {
      if (!profile || profile.uid !== uid || profile.role !== "towing-company" || profile.verificationStatus !== "VERIFIED") {
        setInitialListing(null);
        return;
      }

      setInitialListing({
        businessName: existing?.businessName || profile.company.companyName,
        location: existing?.location,
        availability: existing?.availability ?? "offline",
        services: existing?.services.length ? existing.services : profile.services.towingServices,
        vehicleTypes: existing?.vehicleTypes.length ? existing.vehicleTypes : profile.services.vehicleTypesSupported,
        serviceAreaLabel: existing?.serviceAreaLabel || profile.services.serviceArea,
        operatingHours: existing?.operatingHours || profile.company.operatingHours,
        startingPrice: existing?.startingPrice ?? null,
        emergencyServiceAvailable: existing?.emergencyServiceAvailable ?? profile.services.emergencyServiceAvailable,
      });
    }).catch(() => setInitialListing(null));
  }, []);

  if (initialListing === undefined) return <View style={styles.state}><ActivityIndicator color="#D32F2F" /></View>;
  if (initialListing === null) return <View style={styles.state}><Text style={styles.error}>A verified towing company profile is required.</Text></View>;

  return (
    <PublicListingForm
      role="towing-company"
      initialListing={initialListing}
      defaultBusinessName=""
    />
  );
}

const styles = StyleSheet.create({ state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, error: { color: "#6B7280", textAlign: "center" } });
