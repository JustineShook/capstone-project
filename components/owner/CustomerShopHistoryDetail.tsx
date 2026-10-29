import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";
import { useCustomerShopBooking } from "../../hooks/useCustomerShopBooking";
import { getPublicProviderListing } from "../../services/publicProviderListingService";
import { getProviderContactPhone } from "../../services/providerContactService";
import { SHOP_STATUS_FLOW, SHOP_STATUS_LABELS } from "../../types/shopBooking";
import { CustomerRating } from "./CustomerRating";
import { ServiceProgress } from "./ServiceProgress";
import { formatPesoAmount } from "../../utils/finalPrice";
import { OpenGoogleMapsModal } from "./OpenGoogleMapsModal";

export function CustomerShopHistoryDetail() {
  const router = useRouter();
  const returnToHistory = useCallback(() => router.replace("/(v_owner)/history"), [router]);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      returnToHistory();
      return true;
    });
    return () => sub.remove();
  }, [returnToHistory]));

  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const id = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const { booking, loading, error, retry } = useCustomerShopBooking(id);
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false);
  const [providerPhone, setProviderPhone] = useState("");
  const step = booking ? SHOP_STATUS_FLOW.findIndex((status) => status === booking.status) : -1;

  useFocusEffect(useCallback(() => {
    if (!booking?.providerId) {
      setProviderPhone("");
      return;
    }
    let active = true;
    void getPublicProviderListing(booking.providerId)
      .then(async (listing) => {
        let phone = listing?.contactPhone?.trim() ?? "";
        try { phone = await getProviderContactPhone(booking.providerId) || phone; } catch { /* Legacy fallback during migration. */ }
        if (active) setProviderPhone(phone);
      })
      .catch(() => { if (active) setProviderPhone(""); });
    return () => { active = false; };
  }, [booking?.providerId]));

  const handleCall = async () => {
    if (!providerPhone) {
      Alert.alert("Phone number unavailable", "This shop has not added a contact number.");
      return;
    }
    try { await Linking.openURL(`tel:${providerPhone}`); }
    catch { Alert.alert("Unable to call", "This device could not open the phone app."); }
  };

  const handleText = async () => {
    if (!providerPhone) {
      Alert.alert("Phone number unavailable", "This shop has not added a contact number.");
      return;
    }
    try { await Linking.openURL(`sms:${providerPhone}`); }
    catch { Alert.alert("Unable to text", "This device could not open the messaging app."); }
  };

  const openShopMap = async () => {
    if (!booking) return;
    setShowMapsConfirmation(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView style={s.header} edges={["top"]}>
        <View style={s.headerRow}>
          <Pressable onPress={returnToHistory} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to history">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Request Status</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {loading ? <View style={s.loadingRoot}><ActivityIndicator color={colors.primary} /></View>
        : error ? <View style={s.loadingRoot}><Text style={s.notFoundText}>{error}</Text><Pressable onPress={retry} style={s.retryButton}><Text style={s.retryText}>Try Again</Text></Pressable></View>
          : !booking ? <View style={s.loadingRoot}><Text style={s.notFoundText}>This request could not be found.</Text></View>
            : <>
              <View style={s.fixedTop}>
                <View style={s.providerCard}>
                  <View style={s.avatar}><Ionicons name="storefront" size={26} color={colors.white} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.providerName}>{booking.providerName}</Text>
                    <Text style={s.problemText} numberOfLines={1} ellipsizeMode="tail">{booking.problem}</Text>
                  </View>
                  <View style={s.providerActionsRow}>
                    <Pressable style={s.actionButton} onPress={() => void handleCall()} hitSlop={6} accessibilityRole="button" accessibilityLabel="Call shop">
                      <Ionicons name="call" size={17} color={colors.white} />
                    </Pressable>
                    <Pressable style={s.actionButton} onPress={() => void handleText()} hitSlop={6} accessibilityRole="button" accessibilityLabel="Text shop">
                      <Ionicons name="chatbubble" size={17} color={colors.white} />
                    </Pressable>
                  </View>
                </View>
                <ServiceProgress
                  steps={SHOP_STATUS_FLOW.map((status) => ({ key: status, label: status.replace(/_/g, " ") }))}
                  currentStep={step}
                  terminalLabel={booking.status === "cancelled" || booking.status === "rejected" ? SHOP_STATUS_LABELS[booking.status] : undefined}
                />
              </View>

              <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                {booking.status === "completed" && <CustomerRating bookingId={booking.id} bookingType="shop" providerName={booking.providerName} />}

                <View style={s.detailCard}>
                  <Text style={s.detailCardTitle}>Provider Details</Text>
                  <DetailRow icon="business-outline" label="Provider" value={booking.providerName} />
                  <DetailRow icon="storefront-outline" label="Service" value="Auto Shop" last />
                </View>

                <View style={s.detailCard}>
                  <Text style={s.detailCardTitle}>Vehicle Details</Text>
                  <DetailRow icon="calendar-outline" label="Year" value={String(booking.vehicleYear)} />
                  <DetailRow icon="car-outline" label="Vehicle" value={booking.vehicle} />
                  <DetailRow icon="pricetag-outline" label="Plate" value={booking.vehiclePlate || "Not provided"} last />
                </View>

                <View style={s.detailCard}>
                  <Text style={s.detailCardTitle}>Service Request</Text>
                  <DetailRow icon="alert-circle-outline" label="Problem" value={booking.problem} />
                  {booking.notes ? <DetailRow icon="document-text-outline" label="Notes" value={booking.notes} /> : null}
                  {booking.completionNote?.trim() ? <DetailRow icon="chatbox-ellipses-outline" label="Shop Note" value={booking.completionNote} /> : null}
                  <DetailRow icon="cash-outline" label="Starting Price" value={booking.startingPrice} last />
                  {booking.status === "completed" ? <DetailRow icon="cash-outline" label="Final Price" value={typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded"} last /> : null}
                </View>

                <View style={s.detailCard}>
                  <Text style={s.detailCardTitle}>Location Details</Text>
                  <DetailRow icon="location-outline" label="Customer" value={`${booking.latitude.toFixed(6)}, ${booking.longitude.toFixed(6)}`} />
                  <DetailRow icon="business-outline" label="Shop Area" value={booking.shopAreaLabel || "Not provided"} />
                  {Number.isFinite(booking.shopLatitude) && Number.isFinite(booking.shopLongitude) && <>
                    <DetailRow icon="navigate-outline" label="Shop Location" value={`${booking.shopLatitude!.toFixed(6)}, ${booking.shopLongitude!.toFixed(6)}`} last />
                    <Pressable style={s.mapButton} onPress={() => void openShopMap()} accessibilityRole="button">
                      <Ionicons name="map-outline" size={17} color={colors.primary} />
                      <Text style={s.mapButtonText}>View Shop Location</Text>
                    </Pressable>
                  </>}
                </View>

                <View style={s.detailCard}>
                  <Text style={s.detailCardTitle}>Booking Information</Text>
                  <DetailRow icon="receipt-outline" label="Booking ID" value={booking.id} />
                  <DetailRow icon="time-outline" label="Requested" value={formatDateTime(booking.createdAt)} />
                  <DetailRow icon="ellipse-outline" label="Status" value={SHOP_STATUS_LABELS[booking.status]} last />
                </View>
              </ScrollView>
            </>}
      {booking && <OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/search/?api=1&query=${booking.shopLatitude},${booking.shopLongitude}`} onCancel={() => setShowMapsConfirmation(false)} />}
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

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Time not available";
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  notFoundText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: "center" },
  retryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  retryText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  fixedTop: { paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.background, paddingBottom: 16 },
  content: { padding: 16, paddingBottom: 24, gap: 0 },
  providerCard: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  providerName: { fontSize: 19, lineHeight: 25, fontWeight: "800", color: colors.textPrimary },
  problemText: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  providerActionsRow: { flexDirection: "row", gap: 8 },
  actionButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  detailCard: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, marginBottom: 16 },
  detailCardTitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { fontSize: 12.5, color: colors.textSecondary, width: 90 },
  detailValue: { flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.textPrimary, textAlign: "right" },
  mapButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, marginTop: 10 },
  mapButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 19, color: "#FF9AA8", marginTop: 8 },
});
