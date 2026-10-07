import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { PublicListingForm } from "../../components/provider/PublicListingForm";
import { auth, db } from "../../services/firebase";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import { getShopVerificationProfile, syncApprovedShopProviderProfile } from "../../services/shopVerificationService";
import type { PublicProviderListingInput } from "../../types/providerListing";
import type { ProviderProfile } from "../../types/user";

function verifiedPrice(value: string | undefined) {
  if (!value?.trim()) return null;
  const price = Number(value?.trim());
  return Number.isFinite(price) && price >= 0 ? price : null;
}

/**
 * Mirrors the mechanic and towing public-listing bootstrap: start with an
 * existing providerListings document when one exists, otherwise prefill from
 * the approved provider profile and its verified shop submission.
 */
export default function ShopPublicListing() {
  const [initialListing, setInitialListing] = useState<Partial<PublicProviderListingInput> | null>();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setInitialListing(null); return; }
    let active = true;
    void (async () => {
      try {
        let providerSnapshot = await getDoc(doc(db, "providers", uid));
        const verification = await getShopVerificationProfile(uid).catch(() => null);
        if (!providerSnapshot.exists() || !verification) { if (active) setInitialListing(null); return; }
        let provider = providerSnapshot.data() as ProviderProfile;
        if (provider.uid !== uid || provider.role !== "shop-owner") { if (active) setInitialListing(null); return; }

        // Admin approval lives on shopVerification/profile. Project it once to
        // the existing provider profile before using the shared listing flow.
        if (!provider.verified && verification.verificationStatus === "VERIFIED") {
          await syncApprovedShopProviderProfile(uid, verification);
          providerSnapshot = await getDoc(doc(db, "providers", uid));
          provider = providerSnapshot.data() as ProviderProfile;
        }
        if (!provider.verified) { if (active) setInitialListing(null); return; }

        const existing = await getPublicProviderListing(uid).catch(() => null);
        if (!active) return;
        setInitialListing({
          businessName: existing?.businessName || provider.businessName,
          contactPhone: provider.phone,
          location: existing?.location ?? { latitude: provider.latitude, longitude: provider.longitude },
          availability: existing?.availability ?? (provider.status === "open" ? "available" : "offline"),
          services: existing?.services.length ? existing.services : verification.services,
          vehicleTypes: existing?.vehicleTypes.length ? existing.vehicleTypes : verification.vehicleTypes ?? [],
          serviceAreaLabel: existing?.serviceAreaLabel || verification.business.address || provider.address,
          operatingHours: existing?.operatingHours || verification.business.operatingHours || "",
          startingPrice: existing ? existing.startingPrice : verifiedPrice(verification.business.startingPrice),
          emergencyServiceAvailable: existing?.emergencyServiceAvailable ?? true,
        });
      } catch {
        if (active) setInitialListing(null);
      }
    })();
    return () => { active = false; };
  }, []);

  if (initialListing === undefined) return <View style={styles.state}><StatusBar barStyle="light-content" backgroundColor="#0B1115" /><ActivityIndicator color="#F51F3B" /></View>;
  if (initialListing === null) return <View style={styles.state}><StatusBar barStyle="light-content" backgroundColor="#0B1115" /><Text style={styles.error}>An administrator-approved Auto Shop profile is required.</Text></View>;

  return <PublicListingForm role="shop-owner" initialListing={initialListing} defaultBusinessName="" />;
}

const styles = StyleSheet.create({ state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0B1115" }, error: { color: "#A1ABB2", textAlign: "center", fontSize: 16 } });
