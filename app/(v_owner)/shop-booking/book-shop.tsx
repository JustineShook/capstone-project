import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShopBookingScreen, styles as s } from "../../../components/owner/ShopBookingScreen";
import { Button, Info, LoadState } from "../../../components/shop-owner/ShopUI";
import { colors } from "../../../constants/owner/theme";
import { useMyLocation } from "../../../hooks/useMyLocation";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { createShopBooking } from "../../../services/shopOwnerService";
import type { SavedVehicle } from "../../../types/owner/vehicle";
import { isBookableShopListing, type ProviderListing } from "../../../types/providerListing";

export default function BookShopScreen() {
  const { providerId } = useLocalSearchParams<{ providerId?: string | string[] }>();
  const id = Array.isArray(providerId) ? providerId[0] : providerId;
  return <ShopBookingForm key={id} providerId={id} />;
}

function ShopBookingForm({ providerId }: { providerId?: string }) {
  const router = useRouter();
  const focused = useIsFocused();
  const [provider, setProvider] = useState<ProviderListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [problem, setProblem] = useState("");
  const [notes, setNotes] = useState("");
  const [modal, setModal] = useState<"vehicle" | "review" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const submittedId = useRef<string | null>(null);
  const location = useMyLocation({ watch: false });
  const vehicle = vehicles.find((item) => item.vehicleId === vehicleId);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    setLoading(true); setProviderError(null);
    if (!providerId) { setProviderError("No shop selected. Choose an Auto Shop from Home."); setLoading(false); return; }
    getPublicProviderListing(providerId).then((listing) => {
      if (!active) return;
      if (!isBookableShopListing(listing) || listing.providerId !== providerId) {
        setProvider(null); setProviderError("This shop is no longer available. Choose another Auto Shop.");
      } else setProvider(listing);
    }).catch(() => { if (active) { setProvider(null); setProviderError("Unable to load this shop. It may no longer be publicly available."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providerId, attempt, focused]);

  useEffect(() => {
    setVehicleLoading(true); setVehicleError(null);
    try {
      return subscribeToMyVehicles((items) => {
        setVehicles(items); setVehicleLoading(false);
        setVehicleId((current) => items.some((item) => item.vehicleId === current) ? current : items[0]?.vehicleId ?? "");
      }, () => { setVehicleError("Unable to load your vehicles. Please try again."); setVehicleLoading(false); });
    } catch (cause) { setVehicleError((cause as Error).message); setVehicleLoading(false); }
  }, [attempt]);

  const canSubmit = Boolean(provider && vehicle && problem.trim() && !loading && !providerError && !vehicleLoading && !vehicleError
    && location.location && !location.error && !location.loading);
  async function submit() {
    if (lock.current || !canSubmit || !provider || !vehicle || !location.location) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const id = submittedId.current ?? await createShopBooking({ providerId: provider.providerId, providerName: provider.businessName,
        vehicleId: vehicle.vehicleId, vehicle: `${vehicle.make} ${vehicle.model}`, vehicleYear: vehicle.year, vehiclePlate: vehicle.plateNumber,
        problem, notes, latitude: location.location.lat, longitude: location.location.lng, startingPrice: "Price on assessment" });
      submittedId.current = id;
      setModal(null);
      router.replace({ pathname: "/(v_owner)/shop-booking/booking-confirmation", params: { bookingId: id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send your request. Please try again."); }
    finally { lock.current = false; setSaving(false); }
  }

  return <ShopBookingScreen title="Request Emergency Repair">
    <LoadState loading={loading} error={providerError} retry={() => setAttempt((value) => value + 1)} />
    {providerError && <Button title="Choose Another Shop" secondary onPress={() => router.replace("/(v_owner)")} />}
    {provider && !loading && !providerError && <>
      <View style={s.card}><View style={s.row}><Ionicons name="storefront-outline" size={28} color={colors.primary} /><Text style={[s.title, { flex: 1 }]}>{provider.businessName}</Text></View>
        <Text style={s.muted}>Open · Approved shop</Text><Text style={s.text}>{provider.serviceAreaLabel}</Text>
        <Text style={s.muted}>You will bring your vehicle to the shop after the request is accepted.</Text>
        <Info label="Starting price" value={provider.startingPrice == null ? "Price on assessment" : `₱${provider.startingPrice.toLocaleString("en-PH")}`} />
      </View>
      <Text style={s.label}>VEHICLE</Text>
      <LoadState loading={vehicleLoading} error={vehicleError} retry={() => setAttempt((value) => value + 1)} />
      {vehicle && <Pressable accessibilityRole="button" style={s.card} onPress={() => setModal("vehicle")}>
        <Text style={s.title}>{vehicle.year} {vehicle.make} {vehicle.model}</Text><Text style={s.muted}>{vehicle.type} · {vehicle.plateNumber}</Text>
        <Text style={{ color: colors.primary }}>Change vehicle</Text>
        {!provider.vehicleTypes.includes(vehicle.type) && <Text style={s.muted}>This shop may not typically service this vehicle type. The shop will review your request.</Text>}
      </Pressable>}
      {!vehicleLoading && !vehicleError && !vehicles.length && <View style={s.card}><Text style={s.muted}>Add a vehicle in My Vehicles, then return here to continue.</Text>
        <Button title="Add a Vehicle" secondary onPress={() => router.push("/(v_owner)/vehicle")} /></View>}
      <Text style={s.label}>WHAT IS THE PROBLEM?</Text>
      <TextInput accessibilityLabel="Reported problem" style={s.input} value={problem} onChangeText={setProblem} maxLength={300} multiline placeholder="Describe what happened and the help you need" />
      <Text style={s.label}>ADDITIONAL NOTES (OPTIONAL)</Text>
      <TextInput accessibilityLabel="Additional notes" style={s.input} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Any other information for the shop" />
      <View style={s.card}><Text style={s.label}>YOUR LOCATION</Text>
        <Text style={s.muted}>{location.loading ? "Finding your location…" : location.error || (location.location ? `${location.location.lat.toFixed(6)}, ${location.location.lng.toFixed(6)}` : "Location not available")}</Text>
        <Text style={s.muted}>Your current location is shared with the shop. Repairs take place at the shop.</Text>
        <Button title="Refresh Location" secondary disabled={location.loading} onPress={() => void location.refresh()} />
      </View>
      {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button title="Review Request" disabled={!canSubmit || saving} onPress={() => { setError(null); setModal("review"); }} />
    </>}
    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => { if (!saving) setModal(null); }}>
      <View style={s.modalOverlay}><SafeAreaView style={s.modalSheet} edges={["bottom"]}>
        <Text style={s.title}>{modal === "vehicle" ? "Select Vehicle" : "Confirm Emergency Request"}</Text>
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          {modal === "vehicle" ? vehicles.map((item) => <Pressable key={item.vehicleId} style={[s.card, item.vehicleId === vehicleId && s.selected]}
            onPress={() => { setVehicleId(item.vehicleId); setModal(null); }}>
            <Text style={s.text}>{item.year} {item.make} {item.model}</Text><Text style={s.muted}>{item.type} · {item.plateNumber}</Text>
          </Pressable>) : <>
            <Info label="Shop" value={provider?.businessName ?? ""} /><Info label="Vehicle" value={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Vehicle no longer available"} />
            <Info label="Problem" value={problem} />{notes.trim() && <Info label="Notes" value={notes} />}
            <Text style={s.muted}>The shop will review your request. Bring the vehicle after acceptance. Final repair costs are agreed with the shop after assessment.</Text>
            {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <Button title={saving ? "Sending…" : "Confirm Request"} disabled={!canSubmit || saving} onPress={() => void submit()} />
          </>}
        </ScrollView>
        <Button title={modal === "vehicle" ? "Close" : "Back to Edit"} secondary disabled={saving} onPress={() => setModal(null)} />
      </SafeAreaView></View>
    </Modal>
  </ShopBookingScreen>;
}
