import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CustomerRating } from "./CustomerRating";
import { useCustomerShopBooking } from "../../hooks/useCustomerShopBooking";
import { SHOP_STATUS_FLOW, SHOP_STATUS_LABELS } from "../../types/shopBooking";
import { ShopBookingScreen } from "./ShopBookingScreen";

export function CustomerShopHistoryDetail() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const id = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const { booking, loading, error, retry } = useCustomerShopBooking(id);
  const [mapError, setMapError] = useState<string | null>(null);
  const step = booking ? SHOP_STATUS_FLOW.findIndex((status) => status === booking.status) : -1;
  const openShopMap = async () => {
    if (!booking) return;
    try { setMapError(null); await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${booking.shopLatitude},${booking.shopLongitude}`); }
    catch { setMapError("Could not open maps. Use the shop coordinates shown here."); }
  };
  const title = booking?.status === "completed" ? "Service History" : "Service Details";

  return <ShopBookingScreen title={title} scrollable={false}>
    {loading ? <View style={s.state}><ActivityIndicator size="large" color={C.red} /><Text style={s.muted}>Loading service details...</Text></View>
      : error ? <View style={s.state}><Text style={s.error}>{error}</Text><Pressable style={s.button} onPress={retry}><Text style={s.buttonText}>Try Again</Text></Pressable></View>
      : !booking ? <View style={s.state}><Text style={s.title}>Request not found</Text><Text style={s.muted}>This service record may have been removed or is not linked to your account.</Text></View>
        : <>
          <View style={s.summary}>
            <View style={s.summaryTop}><View style={s.shopIcon}><Ionicons name="storefront-outline" size={24} color={C.red} /></View><View style={{ flex: 1, gap: 3 }}><Text style={s.providerName}>{booking.providerName}</Text><Text style={s.muted}>Auto shop service</Text></View><View style={s.badge}><Text style={s.badgeText}>{SHOP_STATUS_LABELS[booking.status]}</Text></View></View>
            <Text style={s.statusMessage}>{statusMessage(booking.status)}</Text>
          </View>
          {step >= 0 && <View style={s.progressCard}><Text style={s.sectionTitle}>Service progress</Text><View style={s.progressRow}>
            {SHOP_STATUS_FLOW.map((status, index) => <View key={status} style={s.progressStep}><View style={[s.dot, index < step || booking.status === "completed" ? s.dotDone : null, index === step && booking.status !== "completed" ? s.dotCurrent : null]}>{(index < step || booking.status === "completed") && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}</View>{index < SHOP_STATUS_FLOW.length - 1 && <View style={[s.connector, index < step && s.connectorDone]} />}<Text style={[s.stepLabel, index === step && s.stepLabelCurrent]} numberOfLines={2}>{SHOP_STATUS_LABELS[status]}</Text></View>)}
          </View></View>}
          <ScrollView style={s.detailsScroll} contentContainerStyle={s.detailsContent} showsVerticalScrollIndicator={false}>
            {booking.status === "completed" && <CustomerRating bookingId={booking.id} bookingType="shop" providerName={booking.providerName} />}
            <View style={s.card}><Text style={s.sectionTitle}>Vehicle details</Text><Detail icon="car-sport-outline" label="Vehicle" value={`${booking.vehicleYear} ${booking.vehicle}`} /><Detail icon="pricetag-outline" label="Plate number" value={booking.vehiclePlate || "Not provided"} /></View>
            <View style={s.card}><Text style={s.sectionTitle}>Service details</Text><Detail icon="construct-outline" label="Problem / service requested" value={booking.problem} /><Detail icon="document-text-outline" label="Additional notes" value={booking.notes || "No additional notes"} /><Detail icon="cash-outline" label="Starting price (not a final bill)" value={booking.startingPrice} /></View>
            <View style={s.card}><Text style={s.sectionTitle}>Location</Text><Detail icon="location-outline" label="Your location when requested" value={`${booking.latitude.toFixed(6)}, ${booking.longitude.toFixed(6)}`} /><Detail icon="business-outline" label="Shop area" value={booking.shopAreaLabel || "Not provided"} />
              {Number.isFinite(booking.shopLatitude) && Number.isFinite(booking.shopLongitude) && <><Detail icon="navigate-outline" label="Shop coordinates" value={`${booking.shopLatitude!.toFixed(6)}, ${booking.shopLongitude!.toFixed(6)}`} /><Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => void openShopMap()}><Ionicons name="map-outline" size={18} color={C.red} /><Text style={s.outlineText}>View Shop Location</Text></Pressable></>}
              {mapError && <Text accessibilityRole="alert" style={s.error}>{mapError}</Text>}
            </View>
            <View style={s.card}><Text style={s.sectionTitle}>Request details</Text><Detail icon="finger-print-outline" label="Request ID" value={booking.id} /><Detail icon="time-outline" label="Requested" value={formatTime(booking.createdAt)} /><Detail icon="refresh-outline" label="Last updated" value={formatTime(booking.updatedAt)} /></View>
          </ScrollView>
          <View style={s.footer}><Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => router.replace("/(v_owner)/history")}><Text style={s.outlineText}>Back to History</Text></Pressable></View>
        </>}
  </ShopBookingScreen>;
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={s.detail}><Ionicons name={icon} size={17} color="#777777" /><View style={{ flex: 1, gap: 3 }}><Text style={s.detailLabel}>{label}</Text><Text selectable style={s.detailValue}>{value || "Not provided"}</Text></View></View>;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Time not available";
}

function statusMessage(status: keyof typeof SHOP_STATUS_LABELS) {
  if (status === "completed") return "Service completed. Thank you for choosing this auto shop.";
  if (status === "pending") return "Waiting for the shop to review and accept your request.";
  if (status === "accepted") return "The shop accepted your request. Bring your vehicle to the shop.";
  if (status === "rejected") return "The shop could not accept this request. You can choose another shop.";
  if (status === "cancelled") return "This service request was cancelled.";
  return `Your service is ${SHOP_STATUS_LABELS[status].toLowerCase()}.`;
}

const C = { red: "#D32F2F", text: "#1A1A1A", muted: "#6B6B6B", border: "#EEE0E0", card: "#FFFFFF" };
const s = StyleSheet.create({
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 13, padding: 22 },
  title: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  summary: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 15, gap: 12 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  shopIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },
  providerName: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: "800" },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
  badge: { backgroundColor: "#FFF3F4", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: C.red, fontSize: 12, fontWeight: "800" },
  statusMessage: { color: "#4E4E4E", fontSize: 14, lineHeight: 20, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  progressCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 14, gap: 13 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressStep: { flex: 1, alignItems: "center", position: "relative", gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#B9B9B9", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotDone: { backgroundColor: C.red, borderColor: C.red },
  dotCurrent: { backgroundColor: "#FFF3F4", borderColor: C.red },
  connector: { position: "absolute", height: 2, backgroundColor: "#E5E5E5", left: "50%", right: "-50%", top: 10 },
  connectorDone: { backgroundColor: C.red },
  stepLabel: { color: C.muted, fontSize: 9, lineHeight: 12, textAlign: "center" },
  stepLabelCurrent: { color: C.red, fontWeight: "800" },
  detailsScroll: { flex: 1, minHeight: 0 },
  detailsContent: { gap: 12, paddingBottom: 4 },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 15, gap: 12 },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailLabel: { color: C.muted, fontSize: 12, fontWeight: "600" },
  detailValue: { color: C.text, fontSize: 15, lineHeight: 21 },
  outlineButton: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: C.red, paddingHorizontal: 14, paddingVertical: 10 },
  outlineText: { color: C.red, fontSize: 14, fontWeight: "700" },
  error: { color: "#B3261E", fontSize: 14, lineHeight: 20, textAlign: "center" },
  button: { minHeight: 47, backgroundColor: C.red, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  footer: { paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
});
