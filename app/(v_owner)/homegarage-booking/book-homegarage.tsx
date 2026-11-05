import { KeyboardAvoidingView, Platform } from "react-native";
import { homeColors } from "../../../constants/owner/homeTheme";
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
import type { ProviderListing } from "../../../types/providerListing";
import type { SavedVehicle } from "../../../types/owner/vehicle";
import { BookingTimingActions } from "../../../components/owner/BookingTimingActions";
import type { BookingTimingInput } from "../../../types/bookingTiming";
import { formatBookingTimingLabel, isBookingTimingReady } from "../../../utils/bookingTiming";

const C = { background: homeColors.background, bg: homeColors.background, card: homeColors.surface, text: homeColors.textPrimary, muted: homeColors.textSecondary, line: homeColors.border, red: homeColors.primary };

export default function BookHomeGarageScreen() {
  const { providerId, initialTimingMode } = useLocalSearchParams<{ providerId?: string | string[]; initialTimingMode?: "now" | "scheduled" }>();
  const id = Array.isArray(providerId) ? providerId[0] : providerId;
  return <BookHomeGarageForm key={id} providerId={id} initialTimingMode={initialTimingMode} />;
}

function BookHomeGarageForm({ providerId, initialTimingMode }: { providerId?: string; initialTimingMode?: "now" | "scheduled" }) {
  const router = useRouter();
  const focused = useIsFocused();
  const [provider, setProvider] = useState<ProviderListing | null>(null);
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [problem, setProblem] = useState("");
  const [notes, setNotes] = useState("");
  const [timing, setTiming] = useState<BookingTimingInput>(() => ({ timingMode: initialTimingMode === "scheduled" ? "scheduled" : "now", urgency: "standard" }));
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
      if (listing && listing.role === "homegarage" && listing.category === "Parking Lots"
        && listing.visibility === "active"
        && (initialTimingMode === "scheduled"
          ? listing.acceptsScheduledBookings === true
          : listing.availability === "available")) setProvider(listing);
      else { setProvider(null); setError("This Home Garage is not accepting service requests right now."); }
    }).catch(() => { if (active) { setProvider(null); setError("Unable to load this Home Garage listing."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providerId, focused, initialTimingMode]);

  useEffect(() => subscribeToMyVehicles((items) => {
    setVehicles(items); setVehicleLoading(false);
    setVehicleId((current) => items.some((item) => item.vehicleId === current) ? current : "");
  }, () => { setVehicleLoading(false); setError("Unable to load your saved vehicles."); }), []);

  const requiredFieldsValid = Boolean(provider && vehicle && problem.trim() && problem.trim().length <= 300 && notes.trim().length <= 1000 && !loading && !vehicleLoading);
  const timingAllowed = timing.timingMode === "scheduled" ? provider?.acceptsScheduledBookings === true
    : timing.urgency === "emergency" ? provider?.emergencyServiceAvailable === true : true;
  const canSubmit = Boolean(requiredFieldsValid && timingAllowed && isBookingTimingReady(timing));
  async function submit() {
    if (lock.current || !provider || !vehicle || !canSubmit) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const id = submittedId.current ?? await createHomeGarageBooking(provider.providerId, vehicle, problem, notes, timing);
      submittedId.current = id; setModal(null);
      router.replace({ pathname: "/(v_owner)/homegarage-booking/booking-detail", params: { bookingId: id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send the repair request."); }
    finally { lock.current = false; setSaving(false); }
  }

  return <ShopBookingScreen formAppearance sapphireHeader onBack={() => router.replace({ pathname: "/(v_owner)", params: providerId ? { selectedProviderId: providerId } : {} })} title="Request Home Garage Service" footer={provider && !loading ? <BookingTimingActions formAppearance value={timing}
    emergencyAvailable={provider.emergencyServiceAvailable === true} acceptsScheduled={provider.acceptsScheduledBookings === true}
    requiredFieldsValid={requiredFieldsValid} reviewDisabled={saving} onChange={setTiming}
    onEmergency={() => { const next = { timingMode: "now" as const, urgency: "emergency" as const }; setTiming(next); setError(""); if (requiredFieldsValid) setModal("review"); }}
    onReview={() => { setError(""); setModal("review"); }}
    validationMessage={!vehicle ? "Select a vehicle." : !problem.trim() ? "Describe the repair needed." : timing.timingMode === "scheduled" && !isBookingTimingReady(timing) ? "Choose a valid future hour." : undefined} /> : undefined}>
    {loading || vehicleLoading ? <View style={s.state}><ActivityIndicator color={C.red} /></View> : null}
    {error && !provider ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {provider && <>
      <View style={s.provider}><View style={s.icon}><Ionicons name="home-outline" size={25} color={C.red} /></View><View style={{ flex: 1 }}><Text style={s.heading}>{provider.businessName}</Text><Text style={s.muted}>{provider.serviceAreaLabel}</Text></View></View>
      <View style={s.block}><Text style={s.label}>Services offered</Text><Text style={s.body}>{provider.services.length ? provider.services.join(" · ") : "General repair service"}</Text></View>
      <Text style={[s.label, s.sectionLabel]}>YOUR VEHICLE</Text>
      <TouchableOpacity style={s.select} onPress={() => setModal("vehicle")}><Text style={vehicle ? s.body : s.muted}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Select a saved vehicle"}</Text><Ionicons name="chevron-down" size={18} color={C.muted} /></TouchableOpacity>
      {vehicles.length === 0 && !vehicleLoading ? <><Text style={s.muted}>Add a vehicle to your profile before requesting service.</Text><TouchableOpacity style={s.cancel} onPress={() => router.push("/(v_owner)/vehicle")}><Text style={s.link}>Add Vehicle</Text></TouchableOpacity></> : null}
      <Text style={[s.label, s.sectionLabel]}>REPAIR NEEDED</Text>
      <TextInput value={problem} onChangeText={setProblem} style={s.multiline} placeholder="Describe the problem" placeholderTextColor={C.muted} multiline maxLength={300} />
      <Text style={[s.label, s.sectionLabel]}>ADDITIONAL NOTES (OPTIONAL)</Text>
      <TextInput value={notes} onChangeText={setNotes} style={[s.multiline, { minHeight: 80 }]} placeholder="Anything else the garage should know" placeholderTextColor={C.muted} multiline maxLength={1000} />
      <Text style={s.muted}>The Home Garage will review the request and accept or decline it. Confirm the service schedule and final price directly with the provider.</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </>}
    <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => !saving && setModal(null)}>
      <KeyboardAvoidingView style={modal === "vehicle" ? s.overlay : s.reviewOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}><SafeAreaView style={modal === "vehicle" ? s.sheet : s.reviewSheet} edges={["bottom"]}>
        <Text style={s.heading}>{modal === "vehicle" ? "Select Vehicle" : "Confirm Repair Request"}</Text>
        <ScrollView style={modal === "vehicle" ? { flexShrink: 1 } : s.reviewScroll} contentContainerStyle={modal === "vehicle" ? { gap: 12 } : s.reviewContent} keyboardShouldPersistTaps="handled">
          {modal === "vehicle" ? vehicles.map((item) => <Pressable key={item.vehicleId} style={[s.option, item.vehicleId === vehicleId && s.selected]} onPress={() => { setVehicleId(item.vehicleId); setModal(null); }}><Text style={s.body}>{item.year} {item.make} {item.model}</Text><Text style={s.muted}>{item.type} · {item.plateNumber}</Text></Pressable>) : <>
            <View style={s.reviewGroup}>
              <Text style={s.reviewGroupTitle}>Home Garage & vehicle</Text>
              <Info label="Home Garage" value={provider?.businessName ?? ""} /><Info label="Vehicle" value={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}` : "Vehicle unavailable"} />
            </View>
            <View style={s.reviewGroup}>
              <Text style={s.reviewGroupTitle}>Repair details</Text>
              <Info label="Repair needed" value={problem} />{notes.trim() ? <Info label="Notes" value={notes} /> : null}
            </View>
            <View style={s.reviewGroup}>
              <Text style={s.reviewGroupTitle}>Schedule & notice</Text>
              <Info label="Timing" value={formatBookingTimingLabel(timing)} />
              <Text style={s.muted}>Scheduled times are subject to provider confirmation and reserve a start window, not service duration.</Text>
            </View>
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.button, saving && s.disabled]} disabled={saving} onPress={() => void submit()}><Text style={s.buttonText}>{saving ? "Sending…" : "Send Request"}</Text></TouchableOpacity>
          </>}
        </ScrollView>
        <TouchableOpacity style={[s.cancel, modal === "review" && s.reviewSecondary]} disabled={saving} onPress={() => setModal(null)}><Text style={s.muted}>{modal === "vehicle" ? "Close" : "Back to Edit"}</Text></TouchableOpacity>
      </SafeAreaView></KeyboardAvoidingView>
    </Modal>
  </ShopBookingScreen>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={s.info}><Text style={s.label}>{label}</Text><Text style={s.body}>{value}</Text></View>; }
const s = StyleSheet.create({
  sectionLabel: { marginTop: 12 },
  reviewSecondary: { borderWidth: 1, borderColor: homeColors.border, borderRadius: 10, backgroundColor: homeColors.surface },
  state: { padding: 22, alignItems: "center" }, provider: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 20, padding: 16 }, icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: homeColors.surfaceAlt, alignItems: "center", justifyContent: "center" }, heading: { color: homeColors.textPrimary, fontSize: 18, fontWeight: "700", lineHeight: 25}, label: { color: homeColors.textSecondary, fontSize: 13, fontWeight: "500", lineHeight: 19}, body: { color: homeColors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "400"}, muted: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19 , fontWeight: "400" }, link: { color: homeColors.primary, fontSize: 15, fontWeight: "700" }, block: { gap: 8, backgroundColor: homeColors.surface, borderRadius: 12, padding: 16 }, select: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 16 }, multiline: { maxHeight: 160, minHeight: 110, textAlignVertical: "top", color: homeColors.textPrimary, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 14, fontSize: 15 , lineHeight: 22 }, button: { minHeight: 54, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.primary, borderRadius: 10, padding: 14 }, buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15, lineHeight: 20}, disabled: { opacity: 0.5 }, error: { color: homeColors.busy, lineHeight: 19, fontSize: 13, fontWeight: "400", marginTop: 8, marginBottom: 8 }, overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.68)", justifyContent: "center", alignItems: "center", padding: 20 }, sheet: { width: "100%", maxWidth: 480, maxHeight: "86%", flexShrink: 1, backgroundColor: homeColors.background, borderWidth: 1, borderColor: homeColors.border, borderRadius: 22, padding: 16, gap: 12 }, option: { backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 16, gap: 4 }, selected: { borderColor: homeColors.primary, backgroundColor: homeColors.surfaceAlt }, info: { gap: 4, borderBottomWidth: 0, borderBottomColor: homeColors.border, paddingBottom: 0 , paddingTop: 0 , borderTopWidth: 0 }, cancel: { minHeight: 54, alignItems: "center", justifyContent: "center" }, reviewContent: { gap: 12, paddingBottom: 2 }, reviewGroup: { gap: 8, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 16 }, reviewGroupTitle: { color: homeColors.primary, fontSize: 16, fontWeight: "700", textTransform: "none", letterSpacing: 0, lineHeight: 22}, reviewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center", padding: 16 }, reviewSheet: { width: "100%", maxWidth: 520, maxHeight: "90%", flexShrink: 1, backgroundColor: homeColors.background, borderRadius: 20, padding: 16, gap: 12 }, reviewScroll: { flexShrink: 1 },
});
