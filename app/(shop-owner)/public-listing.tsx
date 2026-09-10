import { useEffect, useState } from "react";
import { Text } from "react-native";
import { PublicListingForm } from "../../components/provider/PublicListingForm";
import { LoadState, ShopScreen, s } from "../../components/shop-owner/ShopUI";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import type { PublicProviderListingInput } from "../../types/providerListing";

export default function ShopPublicListing() {
  const { account, profile, profileLoading, profileError, retry } = useShopDashboard();
  const [initial, setInitial] = useState<Partial<PublicProviderListingInput> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!profile?.verified) return;
    let active = true;
    setError(null);
    getPublicProviderListing(account.uid).then((existing) => {
      if (active) setInitial({ ...existing, businessName: profile.businessName,
        location: { latitude: profile.latitude, longitude: profile.longitude },
        availability: profile.status === "open" ? "available" : "offline", emergencyServiceAvailable: true });
    }).catch(() => { if (active) setError("Unable to load your listing. Please try again."); });
    return () => { active = false; };
  }, [account.uid, profile, attempt]);
  if (profileLoading || profileError || !profile?.verified || !initial || error) return <ShopScreen title="Public Listing" back>
    <LoadState loading={profileLoading || Boolean(profile?.verified && !initial && !error)} error={profileError || error} retry={() => { retry(); setAttempt((value) => value + 1); }} />
    {!profileLoading && !profileError && !profile?.verified && <Text style={s.text}>Your shop needs administrator approval before publishing a public listing.</Text>}
  </ShopScreen>;
  return <PublicListingForm role="shop-owner" initialListing={initial} defaultBusinessName={profile.businessName} />;
}
