import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShopBookingScreen, styles as s } from "../../../components/owner/ShopBookingScreen";
import { useMyLocation } from "../../../hooks/useMyLocation";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { createShopBooking } from "../../../services/shopOwnerService";
import type { SavedVehicle } from "../../../types/owner/vehicle";
import { isBookableShopListing, type ProviderListing } from "../../../types/providerListing";

const C = { background: "#FFFFFF", card: "#FFFFFF", text: "#1A1A1A", muted: "#6B6B6B", line: "#EEE0E0", red: "#D32F2F" };

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
        setVehicleId((current) => items.some((item) => item.vehicleId === current) ? current : "");
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

  return <ShopBookingScreen title="Request Auto Shop Service">
    <RequestLoadState loading={loading} error={providerError} retry={() => setAttempt((value) => value + 1)} />
    {providerError && <RequestButton title="Choose Another Shop" secondary onPress={() => router.replace("/(v_owner)")} />}
    {provider && !loading && !providerError && <>
      <View style={s.providerCard}><View style={s.providerIcon}><Ionicons name="storefront-outline" size={24} color={C.red} /></View><View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title}>{provider.businessName}</Text><View style={s.metaRow}><Ionicons name="checkmark-circle" size={14} color="#2E7D32" /><Text style={s.metaText}>Verified auto shop</Text></View><Text style={s.muted}>{provider.serviceAreaLabel}</Text>
      </View></View>
      <View style={s.priceCard}><View><Text style={s.priceLabel}>Starting price</Text><Text style={s.priceValue}>{provider.startingPrice == null ? "Price on assessment" : `₱${provider.startingPrice.toLocaleString("en-PH")}`}</Text></View><Ionicons name="pricetag-outline" size={21} color={C.red} /></View>
      <View style={s.noticeCard}><Ionicons name="information-circle-outline" size={18} color={C.red} /><Text style={[s.muted, { flex: 1 }]}>The shop will review your request first. Bring your vehicle only after it accepts.</Text></View>
      <Text style={s.label}>Vehicle</Text><Text style={s.sectionSubtitle}>Which vehicle needs service?</Text>
      <RequestLoadState loading={vehicleLoading} error={vehicleError} retry={() => setAttempt((value) => value + 1)} />
      {vehicle && <Pressable accessibilityRole="button" style={s.card} onPress={() => setModal("vehicle")}>
        <View style={s.vehicleRow}><View style={s.vehicleIcon}><Ionicons name="car-outline" size={22} color={C.red} /></View><View style={{ flex: 1, gap: 4 }}><Text style={s.title}>{vehicle.year} {vehicle.make} {vehicle.model}</Text><Text style={s.muted}>{vehicle.type} · {vehicle.plateNumber}</Text></View><Text style={s.changeLabel}>Change</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></View>
        {!provider.vehicleTypes.includes(vehicle.type) && <Text style={s.muted}>This shop may not typically service this vehicle type. The shop will review your request.</Text>}
      </Pressable>}
      {!vehicleLoading && !vehicleError && vehicles.length > 0 && !vehicle && <Pressable accessibilityRole="button" style={s.emptyVehicleCard} onPress={() => setModal("vehicle")}><Ionicons name="car-outline" size={22} color={C.red} /><Text style={s.emptyVehicleText}>Please select a vehicle</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>}
      {!vehicleLoading && !vehicleError && !vehicles.length && <View style={s.card}><Text style={s.muted}>Add a vehicle in My Vehicles, then return here to continue.</Text>
        <RequestButton title="Add a Vehicle" secondary onPress={() => router.push("/(v_owner)/vehicle")} /></View>}
      <Text style={s.label}>Service Problem</Text><Text style={s.sectionSubtitle}>Tell the shop what needs attention.</Text>
      <TextInput accessibilityLabel="Reported problem" style={s.input} value={problem} onChangeText={setProblem} maxLength={300} multiline placeholder="Describe what happened and the help you need" placeholderTextColor={C.muted} />
      <Text style={s.label}>Additional Notes</Text><Text style={s.sectionSubtitle}>Share any other details that may help.</Text>
      <TextInput accessibilityLabel="Additional notes" style={s.input} value={notes} onChangeText={setNotes} maxLength={1000} multiline placeholder="Any other information for the shop" placeholderTextColor={C.muted} />
      <Text style={s.label}>Your Location</Text><Text style={s.sectionSubtitle}>Shared with the shop with your request.</Text>
      <View style={s.addressCard}><Ionicons name="location-outline" size={20} color={C.red} /><View style={{ flex: 1, gap: 4 }}><Text style={s.addressLabel}>Current location</Text><Text style={s.addressValue}>{location.loading ? "Finding your location…" : location.error || (location.location ? `${location.location.lat.toFixed(6)}, ${location.location.lng.toFixed(6)}` : "Location not available")}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh location" disabled={location.loading} onPress={() => void location.refresh()}><Ionicons name="refresh-outline" size={20} color={C.red} /></TouchableOpacity></View>
      {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <RequestButton title="Review Request" disabled={!canSubmit || saving} onPress={() => { setError(null); setModal("review"); }} />
    </>}
    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => { if (!saving) setModal(null); }}>
      <View style={s.modalOverlay}><SafeAreaView style={s.modalSheet} edges={["bottom"]}>
        <Text style={s.title}>{modal === "vehicle" ? "Select Vehicle" : "Confirm Service Request"}</Text>
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          {modal === "vehicle" ? vehicles.map((item) => <Pressable key={item.vehicleId} style={[s.card, item.vehicleId === vehicleId && s.selected]}
            onPress={() => { setVehicleId(item.vehicleId); setModal(null); }}>
            <Text style={s.text}>{item.year} {item.make} {item.model}</Text><Text style={s.muted}>{item.type} Â· {item.plateNumber}</Text>
          </Pressable>) : <>
            <RequestInfo label="Shop" value={provider?.businessName ?? ""} /><RequestInfo label="Vehicle" value={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} Â· ${vehicle.plateNumber}` : "Vehicle no longer available"} />
            <RequestInfo label="Problem" value={problem} />{notes.trim() && <RequestInfo label="Notes" value={notes} />}
            <Text style={s.muted}>The shop will review your request and accept or reject it. This does not reserve a date or time. Bring the vehicle only after acceptance. Agree on the final repair cost with the shop after its assessment.</Text>
            {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <RequestButton title={saving ? "Sendingâ€¦" : "Confirm Request"} disabled={!canSubmit || saving} onPress={() => void submit()} />
          </>}
        </ScrollView>
        <RequestButton title={modal === "vehicle" ? "Close" : "Back to Edit"} secondary disabled={saving} onPress={() => setModal(null)} />
      </SafeAreaView></View>
    </Modal>
  </ShopBookingScreen>;
}

function RequestButton({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondaryButton, disabled && ui.disabled]}><Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text></TouchableOpacity>;
}
function RequestInfo({ label, value }: { label: string; value: string }) { return <View style={ui.info}><Text style={ui.infoLabel}>{label}</Text><Text selectable style={ui.infoValue}>{value || "Not provided"}</Text></View>; }
function RequestLoadState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (!loading && !error) return null;
  return <View style={ui.loadCard}>{loading ? <ActivityIndicator color={C.red} /> : <><Text style={ui.loadError}>{error}</Text><RequestButton title="Try Again" onPress={retry} /></>}</View>;
}
const ui = StyleSheet.create({ button: { minHeight: 52, borderRadius: 10, backgroundColor: C.red, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }, buttonText: { color: "#F7EFED", fontSize: 16, fontWeight: "800" }, secondaryButton: { backgroundColor: C.card, borderWidth: 1, borderColor: "#45464A" }, secondaryText: { color: C.text }, disabled: { opacity: 0.5 }, info: { gap: 4, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }, infoLabel: { color: C.muted, fontSize: 13, fontWeight: "600" }, infoValue: { color: C.text, fontSize: 16, lineHeight: 22 }, loadCard: { minHeight: 64, backgroundColor: C.card, borderRadius: 12, padding: 14, gap: 10 }, loadError: { color: "#FF9AA8", fontSize: 14, lineHeight: 20 } });


