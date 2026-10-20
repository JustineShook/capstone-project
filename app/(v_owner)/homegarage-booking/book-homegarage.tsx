import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShopBookingScreen } from "../../../components/owner/ShopBookingScreen";
import { createHomeGarageBooking } from "../../../services/homeGarageBookingService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { isBookableHomeGarageListing, type ProviderListing } from "../../../types/providerListing";
import type { SavedVehicle } from "../../../types/owner/vehicle";

const C = { bg: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", line: "#28313A", red: "#F52239" };

export default function BookHomeGarageScreen() {
  const { providerId } = useLocalSearchParams<{ providerId?: string | string[] }>();
  const id = Array.isArray(providerId) ? providerId[0] : providerId;
  return <BookHomeGarageForm key={id} providerId={id} />;
}

function BookHomeGarageForm({ providerId }: { providerId?: string }) {
  const router = useRouter();
  const focused = useIsFocused();
  const [provider, setProvider] = useState<ProviderListing | null>(null);
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [problem, setProblem] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"vehicle" | "review" | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const submittedId = useRef<string | null>(null);
  const vehicle = vehicles.find((item) => item.vehicleId === vehicleId);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    setLoading(true); setError("");
    if (!providerId) { setError("Choose a Home Garage from the provider list."); setLoading(false); return; }
    getPublicProviderListing(providerId).then((listing) => {
      if (!active) return;
      if (isBookableHomeGarageListing(listing)) setProvider(listing);
      else { setProvider(null); setError("This Home Garage is not accepting service requests right now."); }
    }).catch(() => { if (active) { setProvider(null); setError("Unable to load this Home Garage listing."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providerId, focused]);

  useEffect(() => subscribeToMyVehicles((items) => {
    setVehicles(items); setVehicleLoading(false);
    setVehicleId((current) => items.some((item) => item.vehicleId === current) ? current : "");
  }, () => { setVehicleLoading(false); setError("Unable to load your saved vehicles."); }), []);

  const canSubmit = Boolean(provider && vehicle && problem.trim() && problem.trim().length <= 300 && notes.trim().length <= 1000 && !loading && !vehicleLoading);
  async function submit() {
    if (lock.current || !provider || !vehicle || !canSubmit) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const id = submittedId.current ?? await createHomeGarageBooking(provider.providerId, vehicle, problem, notes);
      submittedId.current = id; setModal(null);
      router.replace({ pathname: "/(v_owner)/homegarage-booking/booking-detail", params: { bookingId: id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send the repair request."); }
    finally { lock.current = false; setSaving(false); }
  }

  return <ShopBookingScreen title="Request Home Garage Service">
    {loading || vehicleLoading ? <View style={s.state}><ActivityIndicator color={C.red} /></View> : null}
    {error && !provider ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {provider && <>
      <View style={s.provider}><View style={s.icon}><Ionicons name="home-outline" size={25} color={C.red} /></View><View style={{ flex: 1 }}><Text style={s.heading}>{provider.businessName}</Text><Text style={s.muted}>{provider.serviceAreaLabel}</Text></View></View>
      <View style={s.block}><Text style={s.label}>Services offered</Text><Text style={s.body}>{provider.services.length ? provider.services.join(" · ") : "General repair service"}</Text></View>
      <Text style={s.label}>YOUR VEHICLE</Text>
      <TouchableOpacity style={s.select} onPress={() => setModal("vehicle")}><Text style={vehicle ? s.body : s.muted}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Select a saved vehicle"}</Text><Ionicons name="chevron-down" size={18} color={C.muted} /></TouchableOpacity>
      {vehicles.length === 0 && !vehicleLoading ? <><Text style={s.muted}>Add a vehicle to your profile before requesting service.</Text><TouchableOpacity style={s.cancel} onPress={() => router.push("/(v_owner)/vehicle")}><Text style={s.link}>Add Vehicle</Text></TouchableOpacity></> : null}
      <Text style={s.label}>REPAIR NEEDED</Text>
      <TextInput value={problem} onChangeText={setProblem} style={s.multiline} placeholder="Describe the problem" placeholderTextColor={C.muted} multiline maxLength={300} />
      <Text style={s.label}>ADDITIONAL NOTES (OPTIONAL)</Text>
      <TextInput value={notes} onChangeText={setNotes} style={[s.multiline, { minHeight: 80 }]} placeholder="Anything else the garage should know" placeholderTextColor={C.muted} multiline maxLength={1000} />
      <Text style={s.muted}>The Home Garage will review the request and accept or decline it. Confirm the service schedule and final price directly with the provider.</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.button, !canSubmit && s.disabled]} disabled={!canSubmit} onPress={() => { setError(""); setModal("review"); }}><Text style={s.buttonText}>Review Request</Text></TouchableOpacity>
    </>}
    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => !saving && setModal(null)}>
      <View style={s.overlay}><SafeAreaView style={s.sheet} edges={["bottom"]}>
        <Text style={s.heading}>{modal === "vehicle" ? "Select Vehicle" : "Confirm Repair Request"}</Text>
        <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          {modal === "vehicle" ? vehicles.map((item) => <Pressable key={item.vehicleId} style={[s.option, item.vehicleId === vehicleId && s.selected]} onPress={() => { setVehicleId(item.vehicleId); setModal(null); }}><Text style={s.body}>{item.year} {item.make} {item.model}</Text><Text style={s.muted}>{item.type} · {item.plateNumber}</Text></Pressable>) : <>
            <Info label="Home Garage" value={provider?.businessName ?? ""} /><Info label="Vehicle" value={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Vehicle unavailable"} /><Info label="Repair needed" value={problem} />{notes.trim() ? <Info label="Notes" value={notes} /> : null}
            <Text style={s.muted}>This sends a service request. It does not reserve a date or time.</Text>
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.button, saving && s.disabled]} disabled={saving} onPress={() => void submit()}><Text style={s.buttonText}>{saving ? "Sending…" : "Send Request"}</Text></TouchableOpacity>
          </>}
        </ScrollView>
        <TouchableOpacity style={s.cancel} disabled={saving} onPress={() => setModal(null)}><Text style={s.muted}>{modal === "vehicle" ? "Close" : "Back to Edit"}</Text></TouchableOpacity>
      </SafeAreaView></View>
    </Modal>
  </ShopBookingScreen>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={s.info}><Text style={s.label}>{label}</Text><Text style={s.body}>{value}</Text></View>; }
const s = StyleSheet.create({
  state: { padding: 22, alignItems: "center" }, provider: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 }, icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#3A2025", alignItems: "center", justifyContent: "center" }, heading: { color: C.text, fontSize: 18, fontWeight: "800" }, label: { color: C.muted, fontSize: 13, fontWeight: "700" }, body: { color: C.text, fontSize: 15, lineHeight: 21 }, muted: { color: C.muted, fontSize: 14, lineHeight: 20 }, link: { color: C.red, fontSize: 15, fontWeight: "800" }, block: { gap: 7, backgroundColor: C.card, borderRadius: 12, padding: 14 }, select: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14 }, multiline: { minHeight: 110, textAlignVertical: "top", color: C.text, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 15 }, button: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: C.red, borderRadius: 12, padding: 14 }, buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 }, disabled: { opacity: 0.5 }, error: { color: "#FF9AA8", lineHeight: 20 }, overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "flex-end" }, sheet: { maxHeight: "85%", backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 }, option: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 4 }, selected: { borderColor: C.red }, info: { gap: 4, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8 }, cancel: { minHeight: 42, alignItems: "center", justifyContent: "center" },
});
