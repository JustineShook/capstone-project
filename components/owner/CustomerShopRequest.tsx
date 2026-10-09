import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/owner/theme";
import { useCustomerShopBooking } from "../../hooks/useCustomerShopBooking";
import { SHOP_STATUS_FLOW, SHOP_STATUS_LABELS } from "../../types/shopBooking";
import { CustomerRating } from "./CustomerRating";
import { Button, formatTime, Info, LoadState, StatusBadge } from "../shop-owner/ShopUI";
import { ShopBookingScreen, styles as s } from "./ShopBookingScreen";

export function CustomerShopRequest({ confirmation = false }: { confirmation?: boolean }) {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const id = Array.isArray(bookingId) ? bookingId[0] : bookingId;
  const { booking, loading, error, retry } = useCustomerShopBooking(id);
  const [mapError, setMapError] = useState<string | null>(null);
  const step = booking ? SHOP_STATUS_FLOW.findIndex((status) => status === booking.status) : -1;
  const openShopMap = async () => {
    if (!booking) return;
    try { setMapError(null); await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${booking.shopLatitude},${booking.shopLongitude}`); }
    catch { setMapError("Unable to open maps. Please use the shop coordinates shown above."); }
  };
  return <ShopBookingScreen title={confirmation ? "Request Sent" : "Request Status"}>
    <LoadState loading={loading} error={error} retry={retry} />
    {!loading && !error && !booking && <Text style={s.text}>This shop request was not found or does not belong to your account.</Text>}
    {!loading && !error && booking && <>
      {confirmation && <View style={d.confirmation}><View style={d.confirmIcon}><Ionicons name="checkmark" size={24} color="#FFFFFF" /></View><View style={{ flex: 1 }}><Text style={d.confirmTitle}>Request sent</Text><Text style={d.confirmText}>The shop will review your service request.</Text></View></View>}
      <View style={d.statusCard}><View style={d.statusTop}><View style={d.shopIcon}><Ionicons name="storefront-outline" size={24} color={colors.primary} /></View><View style={{ flex: 1, gap: 4 }}><Text style={d.shopName}>{booking.providerName}</Text><Text style={d.sectionHint}>Auto shop service request</Text></View><StatusBadge status={booking.status} /></View>
        <Text accessibilityLiveRegion="polite" style={d.statusMessage}>{booking.status === "rejected" ? "The shop rejected this request. Please choose another available shop."
          : booking.status === "pending" ? "Waiting for the shop to accept your request. No appointment time is reserved; bring your vehicle only after acceptance."
          : booking.status === "accepted" ? "The shop accepted your request. Bring your vehicle to the shop; contact the shop if you need to confirm when to arrive."
          : booking.status === "completed" ? "Your service is completed."
          : booking.status === "cancelled" ? "This request was cancelled."
          : `Your service is now ${SHOP_STATUS_LABELS[booking.status]?.toLowerCase() ?? booking.status}.`}</Text>
      </View>
      {!confirmation && step >= 0 && <View style={s.card}><Text style={d.sectionTitle}>Service progress</Text>
        <View style={d.progressList}>{SHOP_STATUS_FLOW.map((status, index) => <View key={status} style={d.progressRow}>
          <View style={d.progressMarker}>{index < step || booking.status === "completed" ? <Ionicons name="checkmark-circle" size={21} color={colors.primary} /> : <View style={[d.progressDot, index === step && d.progressDotActive]} />}{index < SHOP_STATUS_FLOW.length - 1 && <View style={[d.progressLine, index < step && d.progressLineActive]} />}</View>
          <Text style={[d.progressText, index === step && d.progressTextActive]}>{SHOP_STATUS_LABELS[status]}</Text>
        </View>)}</View>
      </View>}
      <View style={s.card}><Text style={d.sectionTitle}>Vehicle and service</Text><View style={d.vehicleSummary}><Ionicons name="car-sport-outline" size={22} color={colors.primary} /><Text style={d.vehicleName}>{booking.vehicleYear} {booking.vehicle}</Text></View><Info label="Plate number" value={booking.vehiclePlate} />
        <Info label="Problem" value={booking.problem} />{booking.notes ? <Info label="Notes" value={booking.notes} /> : null}
        <Info label="Starting price (not a final bill)" value={booking.startingPrice} />
      </View>
      <View style={s.card}><Text style={d.sectionTitle}>Location</Text><Info label="Your location when requested" value={`${booking.latitude}, ${booking.longitude}`} />
        <Info label="Shop area" value={booking.shopAreaLabel ?? ""} />
        {Number.isFinite(booking.shopLatitude) && Number.isFinite(booking.shopLongitude) && <>
          <Info label="Shop location" value={`${booking.shopLatitude}, ${booking.shopLongitude}`} /><Button title="View Shop Location" secondary onPress={() => void openShopMap()} />
        </>}{mapError && <Text style={s.error}>{mapError}</Text>}
      </View>
      <View style={s.card}><Text style={d.sectionTitle}>Request details</Text><Info label="Customer" value={booking.customerName} /><Info label="Email" value={booking.customerEmail} /><Info label="Request ID" value={booking.id} /><Info label="Requested" value={formatTime(booking.createdAt)} /><Info label="Last updated" value={formatTime(booking.updatedAt)} /></View>
      {booking.status === "completed" && <CustomerRating bookingId={booking.id} bookingType="shop" providerName={booking.providerName} />}
      {confirmation && <Button title="View Request Status" onPress={() => router.replace({ pathname: "/(v_owner)/shop-booking/booking-detail", params: { bookingId: booking.id } })} />}
      {(booking.status === "rejected" || booking.status === "cancelled") && <Button title="Find Another Shop" onPress={() => router.replace("/(v_owner)")} />}
    </>}
    <Button title="Back to History" secondary onPress={() => router.replace("/(v_owner)/history")} />
    <Button title="Back to Home" secondary onPress={() => router.replace("/(v_owner)")} />
  </ShopBookingScreen>;
}

const d = StyleSheet.create({
  confirmation: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#FFF3F4", borderWidth: 1, borderColor: "#F6DCDD", borderRadius: 14, padding: 15 },
  confirmIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#D32F2F", alignItems: "center", justifyContent: "center" },
  confirmTitle: { color: "#1A1A1A", fontSize: 17, fontWeight: "700" },
  confirmText: { color: "#6B6B6B", fontSize: 14, lineHeight: 20, marginTop: 3 },
  statusCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEE0E0", borderRadius: 14, padding: 16, gap: 14 },
  statusTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  shopIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },
  shopName: { color: "#1A1A1A", fontSize: 17, fontWeight: "700" },
  sectionHint: { color: "#6B6B6B", fontSize: 13 },
  statusMessage: { color: "#4E4E4E", fontSize: 14, lineHeight: 21, borderTopWidth: 1, borderTopColor: "#EEE0E0", paddingTop: 12 },
  sectionTitle: { color: "#1A1A1A", fontSize: 16, fontWeight: "700" },
  progressList: { gap: 2 },
  progressRow: { minHeight: 36, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  progressMarker: { width: 22, alignItems: "center", position: "relative", minHeight: 36 },
  progressDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: "#B9B9B9", backgroundColor: "#FFFFFF", marginTop: 3 },
  progressDotActive: { borderColor: "#D32F2F", backgroundColor: "#D32F2F" },
  progressLine: { position: "absolute", top: 20, bottom: -2, width: 2, backgroundColor: "#E5E5E5" },
  progressLineActive: { backgroundColor: "#D32F2F" },
  progressText: { color: "#6B6B6B", fontSize: 14, lineHeight: 20 },
  progressTextActive: { color: "#D32F2F", fontWeight: "700" },
  vehicleSummary: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF8F8", borderRadius: 10, padding: 12 },
  vehicleName: { flex: 1, color: "#1A1A1A", fontSize: 15, fontWeight: "700" },
});
