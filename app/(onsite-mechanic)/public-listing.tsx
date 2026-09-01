import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { PublicListingForm } from "../../components/provider/PublicListingForm";
import { auth } from "../../services/firebase";
import { getProviderProfile } from "../../services/providerProfileService";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import type { PublicProviderListingInput } from "../../types/providerListing";

export default function MechanicPublicListingScreen() {
  const [initialListing, setInitialListing] = useState<Partial<PublicProviderListingInput> | null>();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return setInitialListing(null);

    Promise.all([
      getProviderProfile(uid),
      getPublicProviderListing(uid).catch(() => null),
    ]).then(([profile, existing]) => {
      if (!profile || profile.uid !== uid || profile.role !== "onsite-mechanic" || profile.verificationStatus !== "VERIFIED") {
        setInitialListing(null);
        return;
      }

      setInitialListing({
        businessName: existing?.businessName ?? "",
        location: existing?.location,
        availability: existing?.availability ?? "offline",
        services: existing?.services.length ? existing.services : profile.professional.specializations,
        vehicleTypes: existing?.vehicleTypes.length ? existing.vehicleTypes : profile.professional.vehicleTypesServed,
        serviceAreaLabel: existing?.serviceAreaLabel || profile.professional.serviceArea,
        operatingHours: existing?.operatingHours || profile.serviceInfo.availableHours,
        startingPrice: existing ? existing.startingPrice : profile.serviceInfo.serviceRate,
        emergencyServiceAvailable: existing?.emergencyServiceAvailable ?? profile.serviceInfo.emergencyServiceAvailable,
      });
    }).catch(() => setInitialListing(null));
  }, []);

  if (initialListing === undefined) return <View style={styles.state}><ActivityIndicator color="#D32F2F" /></View>;
  if (initialListing === null) return <View style={styles.state}><Text style={styles.error}>A verified onsite mechanic profile is required.</Text></View>;

  return (
    <PublicListingForm
      role="onsite-mechanic"
      initialListing={initialListing}
      defaultBusinessName=""
    />
  );
}

const styles = StyleSheet.create({ state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, error: { color: "#6B7280", textAlign: "center" } });
