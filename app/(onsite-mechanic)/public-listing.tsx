import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
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
        contactPhone: existing?.contactPhone ?? profile.personal.phone,
        location: existing?.location,
        availability: existing?.availability ?? "offline",
        services: existing?.services ?? [],
        vehicleTypes: existing?.vehicleTypes ?? [],
        serviceAreaLabel: existing?.serviceAreaLabel || profile.professional.serviceArea,
        operatingHours: existing?.operatingHours || profile.serviceInfo.availableHours,
        hoursType: existing?.hoursType,
        weeklyHours: existing?.weeklyHours,
        startingPrice: existing ? existing.startingPrice : profile.serviceInfo.serviceRate > 0 ? profile.serviceInfo.serviceRate : null,
        // Retain an explicitly enabled listing value; fall back to the
        // verified profile to recover listings saved false by the old bug.
        emergencyServiceAvailable: existing?.emergencyServiceAvailable === true
          || profile.serviceInfo.emergencyServiceAvailable,
        acceptsScheduledBookings: existing?.acceptsScheduledBookings === true,
      });
    }).catch(() => setInitialListing(null));
  }, []);

  if (initialListing === undefined) return <View style={styles.state}><StatusBar barStyle="light-content" backgroundColor="#0B1115"/><ActivityIndicator color="#F51F3B" /></View>;
  if (initialListing === null) return <View style={styles.state}><StatusBar barStyle="light-content" backgroundColor="#0B1115"/><Text style={styles.error}>A verified onsite mechanic profile is required.</Text></View>;

  return (
    <PublicListingForm
      role="onsite-mechanic"
      initialListing={initialListing}
      defaultBusinessName=""
    />
  );
}

const styles = StyleSheet.create({ state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0B1115" }, error: { color: "#A1ABB2", textAlign: "center", fontSize: 16 } });
