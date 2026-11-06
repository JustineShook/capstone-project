import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, BackHandler, Linking, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CancelRequestModal } from "./CancelRequestModal";
import { ReportProblemAction } from "./ReportProblemModal";
import { FinalPriceCompletionModal } from "../provider/FinalPriceCompletionModal";
import { BookingTimingBanner } from "./BookingTimingBanner";
import { CustomerRating } from "./CustomerRating";
import { ServiceProgress } from "./ServiceProgress";
import { colors } from "../../constants/owner/theme";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import { getProviderContactPhone } from "../../services/providerContactService";
import {
  completeHomeGarageRepair, saveHomeGarageAssessmentPrice, startHomeGarageRepair,
  subscribeToHomeGarageBooking, updateHomeGarageBookingStatus, updateHomeGarageRepairProgress,
} from "../../services/homeGarageBookingService";
import type { HomeGarageBooking, HomeGarageBookingStatus } from "../../types/homeGarageBooking";
import { OpenGoogleMapsModal } from "./OpenGoogleMapsModal";
import { DeclineRequestModal } from "../provider/DeclineRequestModal";

const FLOW: { key: HomeGarageBookingStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "vehicle_arrived", label: "Vehicle Arrived" },
  { key: "diagnosing", label: "Diagnosing" },
  { key: "repairing", label: "Repairing" },
  { key: "completed", label: "Completed" },
];
const LABELS: Record<HomeGarageBookingStatus, string> = {
  pending: "Waiting for Home Garage", accepted: "Request Accepted", vehicle_arrived: "Vehicle Arrived",
  diagnosing: "Diagnosing", repairing: "Repairing", in_progress: "In Progress (legacy)",
  rejected: "Request Declined", completed: "Repair Completed", cancelled: "Request Cancelled",
};

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Time not available";
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export function HomeGarageBookingDetail({ providerMode = false, providerAppearance = "default" }: { providerMode?: boolean; providerAppearance?: "default" | "mechanic" }) {
  const mechanicProviderAppearance = providerMode && providerAppearance === "mechanic";
  const homeAppearance = !providerMode || mechanicProviderAppearance;
  const colors = homeAppearance ? homeColors : defaultColors;
  const s = mechanicProviderAppearance ? mechanicProviderStyles : homeAppearance ? lightStyles : defaultStyles;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const id = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const [booking, setBooking] = useState<HomeGarageBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [declineVisible, setDeclineVisible] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [assessmentPriceInput, setAssessmentPriceInput] = useState("");
  const [completionFormVisible, setCompletionFormVisible] = useState(false);
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
      setLoading(false);
    }, (cause) => { setError(cause.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (providerMode || !booking?.providerId) { setProviderPhone(""); return; }
    let active = true;
    void getPublicProviderListing(booking.providerId)
      .then(async (listing) => {
        let phone = listing?.contactPhone?.trim() ?? "";
        try { phone = await getProviderContactPhone(booking.providerId) || phone; } catch { /* Legacy fallback during migration. */ }
        if (active) setProviderPhone(phone);
      })
      .catch(() => { if (active) setProviderPhone(""); });
    return () => { active = false; };
  }, [booking?.providerId, providerMode]);

  async function update(status: "accepted" | "rejected" | "cancelled", reason?: string) {
    if (!id || busy) return;
    setBusy(true);
    try { await updateHomeGarageBookingStatus(id, status, reason); setShowCancelConfirmation(false); setDeclineVisible(false); if (status === "cancelled") setCancelReason(""); if (status === "rejected") setDeclineReason(""); }
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

  async function progressRepair(status: "diagnosing" | "repairing") {
    if (!id || busy) return;
    setBusy(true);
    try { await updateHomeGarageRepairProgress(id, status); }
    catch (cause) { Alert.alert("Repair status not updated", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function finishRepair(price: number, completionNote: string) {
    if (!id || busy) return;
    setBusy(true);
    try { await completeHomeGarageRepair(id, price, completionNote); setCompletionFormVisible(false); }
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
    setShowMapsConfirmation(true);
  }

  if (loading) return <View style={s.loadingRoot}><StatusBar barStyle={homeAppearance ? "light-content" : homeAppearance ? "dark-content" : "light-content"} backgroundColor={homeAppearance ? "#0F52BA" : colors.background} /><ActivityIndicator color={colors.primary} /></View>;
  if (!booking) return <View style={s.loadingRoot}><StatusBar barStyle={homeAppearance ? "light-content" : homeAppearance ? "dark-content" : "light-content"} backgroundColor={homeAppearance ? "#0F52BA" : colors.background} /><Text style={s.notFoundText}>{error || "This request could not be found."}</Text><Pressable onPress={providerMode ? () => router.back() : returnToHistory} style={s.retryButton}><Text style={s.retryText}>Go Back</Text></Pressable></View>;

  const currentStep = booking.status === "in_progress" ? -1 : FLOW.findIndex((step) => step.key === booking.status);
  const isTerminalStatus = booking.status === "cancelled" || booking.status === "rejected";
  const isHistoryStatus = isTerminalStatus || booking.status === "completed";
  const vehicleSummary = `${booking.vehicleYear ? `${booking.vehicleYear} ` : ""}${booking.vehicle || "Vehicle not recorded"}${booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}`;
  const garageCoordinates = Number.isFinite(booking.garageLatitude) && Number.isFinite(booking.garageLongitude)
    ? `${booking.garageLatitude.toFixed(6)}, ${booking.garageLongitude.toFixed(6)}` : "Coordinates unavailable";

  if (providerMode && isHistoryStatus) {
    const statusDateLabel = booking.status === "completed" && booking.completedAt ? "Completed" : "Last updated";
    const statusDate = booking.status === "completed" && booking.completedAt
      ? booking.completedAt : booking.updatedAt || booking.createdAt;
    return <View style={s.root}>
      <StatusBar barStyle={homeAppearance ? "light-content" : homeAppearance ? "dark-content" : "light-content"} backgroundColor={homeAppearance ? "#0F52BA" : colors.background} />
      <SafeAreaView style={[s.header, homeAppearance && { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 0, paddingVertical: 0 }]} edges={homeAppearance ? ["top"] : ["top"]}>
        <View style={[s.headerRow, homeAppearance && { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, height: undefined }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to history">
            <Ionicons name="chevron-back" size={24} color={homeAppearance ? "#FFFFFF" : colors.textPrimary} />
          </Pressable>
          <Text style={[s.headerTitle, homeAppearance && { color: "#FFFFFF", fontSize: mechanicProviderAppearance ? 18 : 24, lineHeight: mechanicProviderAppearance ? 24 : 30, fontWeight: "700", flexShrink: 1 }]}>Past Booking Details</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView style={homeAppearance ? lightStyles.contentSurface : undefined} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.detailCard}>
          <Text style={s.archiveEyebrow}>PAST BOOKING RECORD</Text>
          <Text style={s.archiveTitle}>{LABELS[booking.status]}</Text>
          <Text style={s.priceHint}>{statusDateLabel} · {formatDateTime(statusDate)}</Text>
        </View>
        <View style={s.detailCard}>
          <Text style={s.detailCardTitle}>Customer and vehicle</Text>
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="person-outline" label="Customer" value={booking.customerName || "Customer"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="home-outline" label="Service" value="Home Garage" />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calendar-outline" label="Year" value={booking.vehicleYear ? String(booking.vehicleYear) : "Not recorded"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="car-outline" label="Vehicle" value={booking.vehicle || "Vehicle not recorded"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
        </View>
        <View style={s.detailCard}>
          <Text style={s.detailCardTitle}>Repair and location</Text>
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="construct-outline" label="Problem" value={booking.problem || "Not recorded"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="document-text-outline" label="Notes" value={booking.notes?.trim() || "No additional notes"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="navigate-outline" label="Service area" value={booking.serviceAreaLabel || "Not provided"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="navigate-outline" label="Garage coordinates" value={garageCoordinates} last />
        </View>
        <View style={s.detailCard}>
          <Text style={s.detailCardTitle}>Price information</Text>
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Starting price" value={booking.startingPrice || "Price on assessment"} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calculator-outline" label="Assessed price" value={booking.assessmentPrice != null ? formatPrice(booking.assessmentPrice) : "Not recorded"} />
          {booking.status === "completed" ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Final price" value={typeof booking.finalPrice === "number" ? formatPrice(booking.finalPrice) : "Final price not recorded"} last /> : null}
          {booking.status === "completed" && booking.completionNote ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="chatbox-ellipses-outline" label="Completion note" value={booking.completionNote} last /> : null}
        </View>
        {booking.cancellationReason ? <View style={s.detailCard}><Text style={s.detailCardTitle}>Owner cancellation reason</Text><Text style={s.priceHint}>{booking.cancellationReason}</Text></View> : null}
        {booking.declineReason ? <View style={s.detailCard}><Text style={s.detailCardTitle}>Provider decline reason</Text><Text style={s.priceHint}>{booking.declineReason}</Text></View> : null}
        <View style={s.detailCard}>
          <Text style={s.detailCardTitle}>Booking information</Text>
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="receipt-outline" label="Booking ID" value={booking.id} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
          <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="ellipse-outline" label="Status" value={LABELS[booking.status]} last />
        </View>
      </ScrollView>
    </View>;
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle={homeAppearance ? "light-content" : homeAppearance ? "dark-content" : "light-content"} backgroundColor={homeAppearance ? "#0F52BA" : colors.background} />
      <SafeAreaView style={[s.header, homeAppearance && { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 0, paddingVertical: 0 }]} edges={homeAppearance ? ["top"] : ["top"]}>
        <View style={[s.headerRow, homeAppearance && { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, height: undefined }]}>
          <Pressable onPress={providerMode ? () => router.back() : returnToHistory} hitSlop={10} accessibilityRole="button" accessibilityLabel={providerMode ? "Go back" : "Back to history"}>
            <Ionicons name="chevron-back" size={24} color={homeAppearance ? "#FFFFFF" : colors.textPrimary} />
          </Pressable>
          <Text style={[s.headerTitle, homeAppearance && { color: "#FFFFFF", fontSize: mechanicProviderAppearance ? 18 : 24, lineHeight: mechanicProviderAppearance ? 24 : 30, fontWeight: "700", flexShrink: 1 }]}>Request Status</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <View style={s.fixedTop}>
        {(providerMode || !["completed", "cancelled"].includes(booking.status)) && <View style={[s.providerCard, !providerMode && customerContactStyles.card]}>
          <View style={[s.avatar, providerMode && s.customerAvatar]}>
            <Ionicons name={providerMode ? "person" : "home"} size={25} color={colors.white} />
          </View>
          <View style={s.providerCopy}>
            <Text style={s.providerName} numberOfLines={homeAppearance ? undefined : 1}>{providerMode ? booking.customerName || "Customer" : booking.providerName}</Text>
            <Text style={s.problemText} numberOfLines={homeAppearance ? undefined : 1} ellipsizeMode="tail">{providerMode ? vehicleSummary : booking.problem}</Text>
          </View>
          {(providerMode ? !isHistoryStatus : !["completed", "cancelled"].includes(booking.status)) ? <View style={[s.providerActionsRow, !providerMode && customerContactStyles.actions]}>
            <Pressable style={[s.actionButton, !providerMode && customerContactStyles.button]} onPress={() => void (providerMode ? contactCustomer("tel") : contactProvider("tel"))} hitSlop={6} accessibilityRole="button" accessibilityLabel={providerMode ? "Call customer" : "Call Home Garage"}><Ionicons name={providerMode ? "call" : "call-outline"} size={providerMode ? 16 : 18} color={providerMode ? colors.white : colors.primary} /></Pressable>
            <Pressable style={[s.actionButton, !providerMode && customerContactStyles.button]} onPress={() => void (providerMode ? contactCustomer("sms") : contactProvider("sms"))} hitSlop={6} accessibilityRole="button" accessibilityLabel={providerMode ? "Message customer" : "Message Home Garage"}><Ionicons name={providerMode ? "chatbubble" : "chatbubble-outline"} size={providerMode ? 16 : 18} color={providerMode ? colors.white : colors.primary} /></Pressable>
          </View> : null}
        </View>}
        {booking.status === "in_progress"
          ? <View style={s.detailCard}><Text style={s.detailCardTitle}>Legacy service progress</Text><Text style={s.priceHint}>This existing booking keeps its original In Progress status. The provider can finish it through the final-price confirmation.</Text></View>
          : (providerMode || !["completed", "cancelled"].includes(booking.status)) && <ServiceProgress homeAppearance={homeAppearance} steps={FLOW} currentStep={currentStep} terminalLabel={isTerminalStatus ? LABELS[booking.status] : undefined} />}
        {!providerMode && booking.declineReason ? <Text style={s.priceHint}>Reason from Home Garage: {booking.declineReason}</Text> : null}
        {providerMode && booking.cancellationReason ? <Text style={s.priceHint}>Owner&apos;s cancellation reason: {booking.cancellationReason}</Text> : null}
        {providerMode && booking.declineReason ? <Text style={s.priceHint}>Provider decline reason: {booking.declineReason}</Text> : null}
        <BookingTimingBanner homeAppearance={homeAppearance} booking={booking} />
        {!providerMode && ["pending", "accepted"].includes(booking.status) && <Pressable style={[s.cancelRequestButton, busy && s.cancelRequestButtonDisabled]} onPress={() => setShowCancelConfirmation(true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel Home Garage request"><Text style={s.cancelRequestButtonText}>Cancel Request</Text></Pressable>}
        {!providerMode && !["pending", "accepted"].includes(booking.status) && booking.status !== "completed" && !isTerminalStatus && <Text style={s.priceHint}>After the provider marks Vehicle Arrived, contact the Home Garage to request cancellation.</Text>}
      </View>

      <ScrollView style={homeAppearance ? lightStyles.contentSurface : undefined} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {providerMode ? <>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Customer Details</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="person-outline" label="Customer" value={booking.customerName || "Customer"} />
            {!isHistoryStatus ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="call-outline" label="Contact Number" value={booking.customerPhone || "Not provided"} /> : null}
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="home-outline" label="Service" value="Home Garage" last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Vehicle Details</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calendar-outline" label="Year" value={String(booking.vehicleYear)} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="car-outline" label="Vehicle" value={booking.vehicle} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Repair Request</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="alert-circle-outline" label="Problem" value={booking.problem} />
            {booking.notes ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="document-text-outline" label="Notes" value={booking.notes} /> : null}
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Starting Price" value={booking.startingPrice || "Price on assessment"} last={booking.assessmentPrice == null && booking.finalPrice == null} />
            {booking.assessmentPrice != null ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calculator-outline" label="Assessed Price" value={formatPrice(booking.assessmentPrice)} last={booking.finalPrice == null} /> : null}
            {booking.status === "completed" ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Final Price" value={typeof booking.finalPrice === "number" ? formatPrice(booking.finalPrice) : "Final price not recorded"} last /> : null}
            {booking.status === "completed" && booking.completionNote ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="chatbox-ellipses-outline" label="Completion Note" value={booking.completionNote} last /> : null}
          </View>
          {booking.status === "accepted" && <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Service Assessment</Text>
            <Text style={s.priceHint}>Assessment is optional and stays separate from the final service price.</Text>
            <TextInput accessibilityLabel="Assessed service price" value={assessmentPriceInput} onChangeText={setAssessmentPriceInput} keyboardType="decimal-pad" placeholder="Enter amount in PHP" placeholderTextColor={colors.textMuted} style={s.priceInput} />
            <Pressable style={[s.providerSecondaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void saveAssessment()}><Text style={s.providerSecondaryText}>{busy ? "Saving…" : "Save Assessed Price"}</Text></Pressable>
            {booking.assessmentPrice != null && <Text style={s.savedPrice}>Saved assessment: {formatPrice(booking.assessmentPrice)}</Text>}
          </View>}
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Booking Information</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="receipt-outline" label="Request ID" value={booking.id} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
            {booking.status === "completed" ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="checkmark-circle-outline" label={booking.completedAt ? "Completed" : "Last updated"} value={formatDateTime(booking.completedAt || booking.updatedAt || booking.createdAt)} /> : isTerminalStatus ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="time-outline" label="Last updated" value={formatDateTime(booking.updatedAt || booking.createdAt)} /> : null}
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="ellipse-outline" label="Status" value={LABELS[booking.status]} last />
          </View>

        </> : <>
          {booking.status === "completed" && <CustomerRating homeAppearance={homeAppearance} bookingId={booking.id} bookingType="homegarage" providerName={booking.providerName} variant="towing" />}
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Provider Details</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="business-outline" label="Provider" value={booking.providerName} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="star-outline" label="Service" value="Home Garage" />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="navigate-outline" label="Service Area" value={booking.serviceAreaLabel || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Vehicle Details</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calendar-outline" label="Year" value={String(booking.vehicleYear)} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="car-outline" label="Vehicle" value={booking.vehicle} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Repair Request</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="construct-outline" label="Problem" value={booking.problem} />
            {booking.notes ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="document-text-outline" label="Notes" value={booking.notes} /> : null}
            {booking.completionNote ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="chatbox-ellipses-outline" label="Garage Note" value={booking.completionNote} /> : null}
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Starting Price" value={booking.startingPrice || "Price on assessment"} last={booking.assessmentPrice == null && booking.finalPrice == null} />
            {booking.assessmentPrice != null ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="calculator-outline" label="Assessed Price" value={formatPrice(booking.assessmentPrice)} last={booking.finalPrice == null} /> : null}
            {booking.status === "completed" ? <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="cash-outline" label="Final Price" value={typeof booking.finalPrice === "number" ? formatPrice(booking.finalPrice) : "Final price not recorded"} last /> : null}
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Location Details</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="business-outline" label="Service Area" value={booking.serviceAreaLabel || "Not provided"} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="navigate-outline" label="Garage Location" value={garageCoordinates} last />
            <Pressable style={s.mapButton} onPress={() => void openGarageMap()} accessibilityRole="button">
              <Ionicons name="map-outline" size={17} color={colors.primary} /><Text style={s.mapButtonText}>View Garage Location</Text>
            </Pressable>
          </View>
          <View style={s.detailCard}>
            <Text style={s.detailCardTitle}>Booking Information</Text>
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="receipt-outline" label="Booking ID" value={booking.id} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
            <DetailRow providerAppearance={mechanicProviderAppearance} homeAppearance={homeAppearance} icon="ellipse-outline" label="Status" value={LABELS[booking.status]} last />
          </View>
        </>}
      </ScrollView>

      {providerMode && !isHistoryStatus && <View style={[s.providerFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {booking.status === "pending" && <View style={s.providerActions}>
            <Pressable style={[s.providerSecondaryButton, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => setDeclineVisible(true)}><Text style={s.providerSecondaryText}>Decline</Text></Pressable>
            <Pressable style={[s.providerPrimaryButton, { marginBottom: 0 }, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void update("accepted")}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Accept Request"}</Text></Pressable>
          </View>}
          {booking.status === "accepted" && <Pressable style={[s.providerPrimaryButton, { marginBottom: 0 }, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void startRepair()}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Mark Vehicle Arrived"}</Text></Pressable>}
          {booking.status === "vehicle_arrived" && <Pressable style={[s.providerPrimaryButton, { marginBottom: 0 }, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void progressRepair("diagnosing")}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Start Diagnosing"}</Text></Pressable>}
          {booking.status === "diagnosing" && <Pressable style={[s.providerPrimaryButton, { marginBottom: 0 }, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => void progressRepair("repairing")}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Start Repairing"}</Text></Pressable>}
          {(booking.status === "repairing" || booking.status === "in_progress") && <Pressable style={[s.providerPrimaryButton, { marginBottom: 0 }, busy && s.cancelRequestButtonDisabled]} disabled={busy} onPress={() => setCompletionFormVisible(true)}><Text style={s.cancelRequestButtonText}>{busy ? "Saving…" : "Complete Service"}</Text></Pressable>}
      </View>}

      {!providerMode && <CancelRequestModal homeAppearance={homeAppearance} visible={showCancelConfirmation} serviceName="Home Garage repair" explanation="You can cancel before the provider marks Vehicle Arrived. After that, contact the provider to request cancellation." isCancelling={busy} reason={cancelReason} onReasonChange={setCancelReason} onKeep={() => setShowCancelConfirmation(false)} onConfirm={() => void update("cancelled", cancelReason)} />}
      {providerMode && <DeclineRequestModal appearance={mechanicProviderAppearance ? "light" : "default"} visible={declineVisible} reason={declineReason} saving={busy} onReasonChange={setDeclineReason} onCancel={() => setDeclineVisible(false)} onConfirm={() => void update("rejected", declineReason)} />}
      {providerMode && <FinalPriceCompletionModal appearance={mechanicProviderAppearance ? "mechanic" : "default"} visible={completionFormVisible} estimatedPrice={booking.assessmentPrice} referencePriceLabel="Assessed Price" saving={busy} onCancel={() => setCompletionFormVisible(false)} onReview={finishRepair} />}
      <View style={!providerMode ? { backgroundColor: homeColors.surface } : undefined}><ReportProblemAction homeAppearance={homeAppearance} booking={booking} /></View>
      <OpenGoogleMapsModal homeAppearance={homeAppearance} visible={showMapsConfirmation} url={`https://www.google.com/maps/search/?api=1&query=${booking.garageLatitude},${booking.garageLongitude}`} onCancel={() => setShowMapsConfirmation(false)} />
    </View>
  );
}

function DetailRow({ homeAppearance = false, providerAppearance = false, icon, label, value, last = false }: { homeAppearance?: boolean; providerAppearance?: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  const colors = homeAppearance ? homeColors : defaultColors;
  const s = providerAppearance ? mechanicProviderStyles : homeAppearance ? lightStyles : defaultStyles;
  return <View style={[s.detailRow, last && s.detailRowLast]}>
    <Ionicons name={icon} size={16} color={homeAppearance ? homeColors.primary : colors.textSecondary} />
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

const defaultColors = colors;
const makeStyles = (colors: typeof defaultColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  archiveEyebrow: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1, marginBottom: 5 },
  archiveTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
  loadingRoot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  notFoundText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: "center" },
  retryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  retryText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  fixedTop: { paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.background, paddingBottom: 16 },
  providerFooter: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
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
const defaultStyles = makeStyles(defaultColors);
const lightStyles = { ...makeStyles(homeColors), ...StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F52BA" },
  contentSurface: { flex: 1, backgroundColor: homeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { backgroundColor: homeColors.background, borderBottomWidth: 1, borderBottomColor: homeColors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: homeColors.textPrimary, lineHeight: 30, minWidth: 0, flexShrink: 1},
  archiveEyebrow: { fontSize: 10, fontWeight: "800", color: homeColors.primary, letterSpacing: 1, marginBottom: 5 },
  archiveTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800", color: homeColors.textPrimary, marginBottom: 4 },
  loadingRoot: { flex: 1, backgroundColor: homeColors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  notFoundText: { fontSize: 15, lineHeight: 22, color: homeColors.textSecondary, textAlign: "center", fontWeight: "400"},
  retryButton: { backgroundColor: homeColors.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  retryText: { color: homeColors.white, fontSize: 15, fontWeight: "700", lineHeight: 20},
  fixedTop: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: homeColors.background, paddingBottom: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  providerCard: { shadowColor: "#172B4D", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2, minHeight: 92, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: homeColors.surface, borderRadius: 20, borderWidth: 1, borderColor: homeColors.border, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.primary, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  customerAvatar: { backgroundColor: "#293A48" },
  providerCopy: { flex: 1, minWidth: 0 },
  providerName: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: homeColors.textPrimary , minWidth: 0, flexShrink: 1},
  problemText: { fontSize: 15, lineHeight: 22, color: homeColors.textSecondary, marginTop: 3, fontWeight: "400"},
  providerActionsRow: { flexDirection: "row", gap: 8 , flexWrap: "wrap", maxWidth: 92},
  actionButton: { width: 42, height: 42, borderRadius: 20, backgroundColor: homeColors.primary, alignItems: "center", justifyContent: "center" },
  cancelRequestButton: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#B42318", borderRadius: 13, paddingHorizontal: 16, marginTop: 16 },
  cancelRequestButtonDisabled: { opacity: 0.65 },
  cancelRequestButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", lineHeight: 20},
  content: { padding: 16, paddingBottom: 24 },
  detailCard: { shadowColor: "#172B4D", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1, backgroundColor: homeColors.surfaceAlt, borderRadius: 20, padding: 16, marginBottom: 16 },
  detailCardTitle: { fontSize: 16, fontWeight: "700", color: homeColors.primary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 22},
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 10, borderBottomWidth: 0, borderBottomColor: homeColors.border },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { fontSize: 13, color: homeColors.textSecondary, width: "32%", flexShrink: 1, lineHeight: 19, fontWeight: "500"},
  detailValue: { flex: 1, fontSize: 15, fontWeight: "600", color: homeColors.textPrimary, textAlign: "right", lineHeight: 22, minWidth: 0, flexShrink: 1},
  priceHint: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10, fontWeight: "400"},
  priceInput: { minHeight: 54, borderWidth: 1, borderColor: homeColors.border, borderRadius: 10, backgroundColor: homeColors.background, color: homeColors.textPrimary, fontSize: 16, paddingHorizontal: 13, marginBottom: 10 },
  savedPrice: { color: homeColors.success, fontSize: 13, lineHeight: 19, marginTop: 10, fontWeight: "400"},
  mapButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: homeColors.primary, borderRadius: 12, marginTop: 10 },
  mapButtonText: { color: homeColors.primary, fontSize: 15, fontWeight: "700", lineHeight: 20},
  error: { fontSize: 13, lineHeight: 19, color: homeColors.busy, marginTop: 8, fontWeight: "400"},
  providerActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  providerPrimaryButton: { minHeight: 54, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.primary, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  providerSecondaryButton: { minHeight: 54, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12 },
  providerSecondaryText: { color: homeColors.textPrimary, fontSize: 14, fontWeight: "800" },
}) };

const mechanicProviderStyles = { ...lightStyles, ...StyleSheet.create({
  root: { flex: 1, backgroundColor: homeColors.primary },
  customerAvatar: { backgroundColor: homeColors.primary },
  providerCard: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: homeColors.surface, borderRadius: 20, borderWidth: 1, borderColor: homeColors.border, padding: 16, marginBottom: 14 },
  providerName: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: homeColors.textPrimary, flexShrink: 1 },
  problemText: { fontSize: 14, lineHeight: 20, color: homeColors.textMuted, marginTop: 3 },
  detailCard: { backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  detailCardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: homeColors.textPrimary, marginBottom: 10 },
  detailLabel: { fontSize: 13, lineHeight: 19, color: homeColors.textMuted, width: "32%", flexShrink: 1 },
  detailValue: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", color: homeColors.textPrimary, textAlign: "right", minWidth: 0, flexShrink: 1 },
  archiveTitle: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: homeColors.textPrimary, marginBottom: 4 },
  priceInput: { minHeight: 54, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, backgroundColor: homeColors.surface, color: homeColors.textPrimary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  providerPrimaryButton: { minHeight: 54, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  providerSecondaryButton: { minHeight: 54, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  providerSecondaryText: { color: homeColors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 19, color: homeColors.busy, marginTop: 8 },
}) };

const customerContactStyles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8, flexWrap: "nowrap", maxWidth: 116, flexShrink: 0 },
  card: { minHeight: 72, gap: 10, backgroundColor: homeColors.surfaceAlt, borderRadius: 14, borderWidth: 0, paddingHorizontal: 12, paddingVertical: 10, shadowOpacity: 0, elevation: 0 },
  button: { width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: homeColors.primary, backgroundColor: homeColors.surface },
});
