import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, BackHandler, Linking, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CancelRequestModal } from "./CancelRequestModal";
import { CustomerRating } from "./CustomerRating";
import { ServiceProgress } from "./ServiceProgress";
import { colors } from "../../constants/owner/theme";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import {
  completeHomeGarageRepair, saveHomeGarageAssessmentPrice, startHomeGarageRepair,
  subscribeToHomeGarageBooking, updateHomeGarageBookingStatus,
} from "../../services/homeGarageBookingService";
import type { HomeGarageBooking, HomeGarageBookingStatus } from "../../types/homeGarageBooking";

const FLOW: { key: HomeGarageBookingStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];
const LABELS: Record<HomeGarageBookingStatus, string> = {
  pending: "Waiting for Home Garage", accepted: "Request Accepted", in_progress: "Repair In Progress",
  rejected: "Request Declined", completed: "Repair Completed", cancelled: "Request Cancelled",
};

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Time not available";
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export function HomeGarageBookingDetail({ providerMode = false }: { providerMode?: boolean }) {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const id = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const [booking, setBooking] = useState<HomeGarageBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [mapError, setMapError] = useState("");
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [assessmentPriceInput, setAssessmentPriceInput] = useState("");
  const [finalPriceInput, setFinalPriceInput] = useState("");
  const returnToHistory = useCallback(() => router.replace("/(v_owner)/history"), [router]);

  useFocusEffect(useCallback(() => {
    if (providerMode) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { returnToHistory(); return true; });
    return () => subscription.remove();
  }, [providerMode, returnToHistory]));

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return subscribeToHomeGarageBooking(id, (item) => {
      setBooking(item);
      setAssessmentPriceInput(item?.assessmentPrice != null ? String(item.assessmentPrice) : "");
      setFinalPriceInput(item?.finalPrice != null ? String(item.finalPrice) : item?.assessmentPrice != null ? String(item.assessmentPrice) : "");
      setLoading(false);
    }, (cause) => { setError(cause.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (providerMode || !booking?.providerId) { setProviderPhone(""); return; }
    let active = true;
    void getPublicProviderListing(booking.providerId)
      .then((listing) => { if (active) setProviderPhone(listing?.contactPhone?.trim() ?? ""); })
      .catch(() => { if (active) setProviderPhone(""); });
    return () => { active = false; };
  }, [booking?.providerId, providerMode]);

  async function update(status: "accepted" | "rejected" | "cancelled") {
    if (!id || busy) return;
    setBusy(true);
    try { await updateHomeGarageBookingStatus(id, status); setShowCancelConfirmation(false); }
    catch (cause) { Alert.alert("Request not updated", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function saveAssessment() {
    const price = parsePrice(assessmentPriceInput);
    if (price == null) { Alert.alert("Price required", "Enter a valid assessed service price with up to two decimal places."); return; }
    if (!id || busy) return;
    setBusy(true);
    try { await saveHomeGarageAssessmentPrice(id, price); Alert.alert("Assessment price saved", "The assessed price is recorded on this request."); }
    catch (cause) { Alert.alert("Assessment not saved", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function startRepair() {
    if (!id || busy) return;
    setBusy(true);
    try { await startHomeGarageRepair(id); }
    catch (cause) { Alert.alert("Repair not started", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  function confirmFinalPrice() {
    const price = parsePrice(finalPriceInput);
    if (price == null) { Alert.alert("Final price required", "Enter a valid final service price with up to two decimal places."); return; }
    Alert.alert("Confirm final price", `Record ${formatPrice(price)} and mark this repair completed?`, [
      { text: "Review price", style: "cancel" },
      { text: "Confirm & Complete", onPress: () => { void finishRepair(price); } },
    ]);
  }

  async function finishRepair(price: number) {
    if (!id || busy) return;
    setBusy(true);
    try { await completeHomeGarageRepair(id, price); }
    catch (cause) { Alert.alert("Repair not completed", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function contactProvider(method: "tel" | "sms") {
    if (!providerPhone) { Alert.alert("Phone number unavailable", "This Home Garage has not added a contact number."); return; }
    try { await Linking.openURL(`${method}:${providerPhone}`); }
    catch { Alert.alert(method === "tel" ? "Unable to call" : "Unable to message", "This device could not open the app."); }
  }

  async function contactCustomer(method: "tel" | "sms") {
    const phone = booking?.customerPhone?.trim();
    if (!phone) { Alert.alert("Phone number unavailable", "This request was created before customer contact details were added."); return; }
    try { await Linking.openURL(`${method}:${phone}`); }
    catch { Alert.alert(method === "tel" ? "Unable to call" : "Unable to message", "This device could not open the app."); }
  }

  async function openGarageMap() {
    if (!booking) return;
    try {
      setMapError("");
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${booking.garageLatitude},${booking.garageLongitude}`);
    } catch { setMapError("Unable to open maps. Use the service area details shown below."); }
  }

  if (loading) return <View style={s.loadingRoot}><StatusBar barStyle="light-content" backgroundColor={colors.background} /><ActivityIndicator color={colors.primary} /></View>;
  if (!booking) return <View style={s.loadingRoot}><StatusBar barStyle="light-content" backgroundColor={colors.background} /><Text style={s.notFoundText}>{error || "This request could not be found."}</Text><Pressable onPress={providerMode ? () => router.back() : returnToHistory} style={s.retryButton}><Text style={s.retryText}>Go Back</Text></Pressable></View>;

  const currentStep = FLOW.findIndex((step) => step.key === booking.status);
  const isTerminalStatus = booking.status === "cancelled" || booking.status === "rejected";
  const vehicleSummary = `${booking.vehicleYear} ${booking.vehicle}${booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}`;
  const garageCoordinates = Number.isFinite(booking.garageLatitude) && Number.isFinite(booking.garageLongitude)
    ? `${booking.garageLatitude.toFixed(6)}, ${booking.garageLongitude.toFixed(6)}` : "Coordinates unavailable";

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView style={s.header} edges={["top"]}>
        <View style={s.headerRow}>
          <Pressable onPress={providerMode ? () => router.back() : returnToHistory} hitSlop={10} accessibilityRole="button" accessibilityLabel={providerMode ? "Go back" : "Back to history"}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Request Status</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <View style={s.fixedTop}>
        <View style={s.providerCard}>
          <View style={[s.avatar, providerMode && s.customerAvatar]}>
            <Ionicons name={providerMode ? "person" : "home"} size={25} color={colors.white} />
          </View>
          <View style={s.providerCopy}>
            <Text style={s.providerName} numberOfLines={1}>{providerMode ? booking.customerName || "Customer" : booking.providerName}</Text>
            <Text style={s.problemText} numberOfLines={1} ellipsizeMode="tail">{providerMode ? vehicleSummary : booking.problem}</Text>
          </View>
          <View style={s.providerActionsRow}>
            <Pressable style={s.actionButton} onPress={() => void (providerMode ? contactCustomer("tel") : contactProvider("tel"))} hitSlop={6} accessibilityRole="button" accessibilityLabel={providerMode ? "Call customer" : "Call Home Garage"}><Ionicons name="call" size={16} color={colors.white} /></Pressable>
            <Pressable style={s.actionButton} onPress={() => void (providerMode ? contactCustomer("sms") : contactProvider("sms"))} hitSlop={6} accessibilityRole="button" accessibilityLabel={providerMode ? "Message customer" : "Message Home Garage"}><Ionicons name="chatbubble" size={16} color={colors.white} /></Pressable>
          </View>
        </View>
        <ServiceProgress steps={FLOW} currentStep={currentStep} terminalLabel={isTerminalStatus ? LABELS[booking.status] : undefined} />
        {!providerMode && booking.status === "pending" && <Pressable style={[s.cancelRequestButton, busy && s.cancelRequestButtonDisabled]} onPress={() => setShowCancelConfirmation(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel Home Garage request"><Text style={s.cancelRequestButtonText}>Cancel Request</Text></Pressable>}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {providerMode ? <>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Customer Details</Text>
            <DetailRow icon="person-outline" label="Customer" value={booking.customerName || "Customer"} />
            <DetailRow icon="call-outline" label="Contact Number" value={booking.customerPhone || "Not provided"} />
            <DetailRow icon="home-outline" label="Service" value="Home Garage" last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Vehicle Details</Text>
            <DetailRow icon="calendar-outline" label="Year" value={String(booking.vehicleYear)} />
            <DetailRow icon="car-outline" label="Vehicle" value={booking.vehicle} />
            <DetailRow icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Repair Request</Text>
            <DetailRow icon="alert-circle-outline" label="Problem" value={booking.problem} />
            {booking.notes ? <DetailRow icon="document-text-outline" label="Notes" value={booking.notes} /> : null}
            <DetailRow icon="cash-outline" label="Starting Price" value={booking.startingPrice || "Price on assessment"} last={booking.assessmentPrice == null && booking.finalPrice == null} />
            {booking.assessmentPrice != null ? <DetailRow icon="calculator-outline" label="Assessed Price" value={formatPrice(booking.assessmentPrice)} last={booking.finalPrice == null} /> : null}
            {booking.finalPrice != null ? <DetailRow icon="cash-outline" label="Final Price" value={formatPrice(booking.finalPrice)} last /> : null}
          </View>
          {booking.status === "accepted" && <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Service Assessment</Text>
            <Text style={s.priceHint}>Enter and save the assessed service price before starting the repair.</Text>
            <TextInput accessibilityLabel="Assessed service price" value={assessmentPriceInput} onChangeText={setAssessmentPriceInput} keyboardType="decimal-pad" placeholder="Enter amount in PHP" placeholderTextColor={colors.textMuted} style={s.priceInput} />
            <Pressable style={[s.providerSecondaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void saveAssessment()}><Text style={s.providerSecondaryText}>{busy ? "Saving…" : "Save Assessed Price"}</Text></Pressable>
            {booking.assessmentPrice != null && <Text style={s.savedPrice}>Saved assessment: {formatPrice(booking.assessmentPrice)}</Text>}
          </View>}
          {booking.status === "in_progress" && <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Final Service Price</Text>
            {booking.assessmentPrice != null && <Text style={s.priceHint}>Assessed price: {formatPrice(booking.assessmentPrice)}. Confirm it or enter the final amount.</Text>}
            <TextInput accessibilityLabel="Final service price" value={finalPriceInput} onChangeText={setFinalPriceInput} keyboardType="decimal-pad" placeholder="Enter final amount in PHP" placeholderTextColor={colors.textMuted} style={s.priceInput} />
          </View>}
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Booking Information</Text>
            <DetailRow icon="receipt-outline" label="Request ID" value={booking.id} />
            <DetailRow icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
            <DetailRow icon="ellipse-outline" label="Status" value={LABELS[booking.status]} last />
          </View>
          {booking.status === "pending" && <View style={s.providerActions}>
            <Pressable style={[s.providerSecondaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void update("rejected")}><Text style={s.providerSecondaryText}>Decline</Text></Pressable>
            <Pressable style={[s.providerPrimaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void update("accepted")}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Accept Request"}</Text></Pressable>
          </View>}
          {booking.status === "accepted" && <Pressable style={[s.providerPrimaryButton, (busy || booking.assessmentPrice == null) && s.cancelRequestButtonDisabled]} disabled={busy || booking.assessmentPrice == null} onPress={() => void startRepair()}><Text style={s.cancelRequestButtonText}>{busy ? "Starting…" : "Start Repair"}</Text></Pressable>}
          {booking.status === "in_progress" && <Pressable style={[s.providerPrimaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={confirmFinalPrice}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Confirm Final Price & Complete"}</Text></Pressable>}
        </> : <>
          {booking.status === "completed" && <CustomerRating bookingId={booking.id} bookingType="homegarage" providerName={booking.providerName} variant="towing" />}
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Provider Details</Text>
            <DetailRow icon="business-outline" label="Provider" value={booking.providerName} />
            <DetailRow icon="star-outline" label="Service" value="Home Garage" />
            <DetailRow icon="navigate-outline" label="Service Area" value={booking.serviceAreaLabel || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Vehicle Details</Text>
            <DetailRow icon="calendar-outline" label="Year" value={String(booking.vehicleYear)} />
            <DetailRow icon="car-outline" label="Vehicle" value={booking.vehicle} />
            <DetailRow icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Repair Request</Text>
            <DetailRow icon="construct-outline" label="Problem" value={booking.problem} />
            {booking.notes ? <DetailRow icon="document-text-outline" label="Notes" value={booking.notes} /> : null}
            {booking.completionNote ? <DetailRow icon="chatbox-ellipses-outline" label="Garage Note" value={booking.completionNote} /> : null}
            <DetailRow icon="cash-outline" label="Starting Price" value={booking.startingPrice || "Price on assessment"} last={booking.assessmentPrice == null && booking.finalPrice == null} />
            {booking.assessmentPrice != null ? <DetailRow icon="calculator-outline" label="Assessed Price" value={formatPrice(booking.assessmentPrice)} last={booking.finalPrice == null} /> : null}
            {booking.finalPrice != null ? <DetailRow icon="cash-outline" label="Final Price" value={formatPrice(booking.finalPrice)} last /> : null}
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Location Details</Text>
            <DetailRow icon="business-outline" label="Service Area" value={booking.serviceAreaLabel || "Not provided"} />
            <DetailRow icon="navigate-outline" label="Garage Location" value={garageCoordinates} last />
            <Pressable style={s.mapButton} onPress={() => void openGarageMap()} accessibilityRole="button">
              <Ionicons name="map-outline" size={17} color={colors.primary} /><Text style={s.mapButtonText}>View Garage Location</Text>
            </Pressable>
            {mapError ? <Text accessibilityRole="alert" style={s.error}>{mapError}</Text> : null}
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Booking Information</Text>
            <DetailRow icon="receipt-outline" label="Booking ID" value={booking.id} />
            <DetailRow icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
            <DetailRow icon="ellipse-outline" label="Status" value={LABELS[booking.status]} last />
          </View>
        </>}
      </ScrollView>

      {!providerMode && <CancelRequestModal visible={showCancelConfirmation} serviceName="Home Garage" explanation="You can cancel while the Home Garage has not started the repair." isCancelling={busy} onKeep={() => setShowCancelConfirmation(false)} onConfirm={() => void update("cancelled")} />}
    </View>
  );
}

function DetailRow({ icon, label, value, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[s.detailRow, last && s.detailRowLast]}>
    <Ionicons name={icon} size={16} color={colors.textSecondary} />
    <Text style={s.detailLabel}>{label}</Text>
    <Text selectable style={s.detailValue}>{value || "Not provided"}</Text>
  </View>;
}

function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price <= 100_000_000 ? price : null;
}

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  loadingRoot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  notFoundText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: "center" },
  retryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  retryText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  fixedTop: { paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.background, paddingBottom: 16 },
  providerCard: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  customerAvatar: { backgroundColor: "#293A48" },
  providerCopy: { flex: 1, minWidth: 0 },
  providerName: { fontSize: 19, lineHeight: 25, fontWeight: "800", color: colors.textPrimary },
  problemText: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  providerActionsRow: { flexDirection: "row", gap: 8 },
  actionButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  cancelRequestButton: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#B42318", borderRadius: 13, paddingHorizontal: 16, marginTop: 16 },
  cancelRequestButtonDisabled: { opacity: 0.65 },
  cancelRequestButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 24 },
  detailCard: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, marginBottom: 16 },
  detailCardTitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { fontSize: 12.5, color: colors.textSecondary, width: 90 },
  detailValue: { flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.textPrimary, textAlign: "right" },
  priceHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  priceInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, color: colors.textPrimary, fontSize: 16, paddingHorizontal: 13, marginBottom: 10 },
  savedPrice: { color: colors.success, fontSize: 13, lineHeight: 19, marginTop: 10 },
  mapButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, marginTop: 10 },
  mapButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 19, color: "#FF9AA8", marginTop: 8 },
  providerActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  providerPrimaryButton: { minHeight: 50, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  providerSecondaryButton: { minHeight: 50, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  providerSecondaryText: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
});
