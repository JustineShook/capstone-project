import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { PublicListingForm } from "../../components/provider/PublicListingForm";
import { getProviderProfile } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getHomeGarageVerificationProfile } from "../../services/homeGarageVerificationService";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import type { PublicProviderListingInput } from "../../types/providerListing";

export default function HomeGaragePublicListing() {
  const [initialListing, setInitialListing] = useState<Partial<PublicProviderListingInput> | null>();
  useEffect(() => { const uid = auth.currentUser?.uid; if (!uid) return setInitialListing(null); Promise.all([getProviderProfile(uid), getHomeGarageVerificationProfile(uid), getPublicProviderListing(uid).catch(() => null)]).then(([profile, verification, existing]) => { if (!profile || profile.uid !== uid || profile.role !== "homegarage" || verification?.verificationStatus !== "VERIFIED") return setInitialListing(null); setInitialListing({ businessName: verification.business.name, contactPhone: verification.business.phone, location: existing?.location, availability: existing?.availability ?? "offline", description: existing?.description ?? "", services: existing?.services ?? [], vehicleTypes: existing?.vehicleTypes ?? [], serviceAreaLabel: existing?.serviceAreaLabel ?? "", operatingHours: existing?.operatingHours ?? "", startingPrice: existing?.startingPrice ?? null, emergencyServiceAvailable: existing?.emergencyServiceAvailable ?? false, photoUrls: existing?.photoUrls ?? [], totalSlots: existing?.totalSlots, availableSlots: existing?.availableSlots }); }).catch(() => setInitialListing(null)); }, []);
  if (initialListing === undefined) return <View style={styles.state}><ActivityIndicator color="#F51F3B" /></View>;
  if (initialListing === null) return <View style={styles.state}><Text style={styles.error}>Your Parking Space profile must be verified by an administrator before you can publish a public listing.</Text></View>;
  return <PublicListingForm role="homegarage" initialListing={initialListing} defaultBusinessName="Unnamed Parking Space" />;
}
const styles = StyleSheet.create({ state: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1115", padding: 24 }, error: { color: "#A1ABB2", textAlign: "center" } });
