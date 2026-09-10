import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { colors } from "../../constants/owner/theme";
import { useCustomerShopBooking } from "../../hooks/useCustomerShopBooking";
import { SHOP_STATUS_FLOW, SHOP_STATUS_LABELS } from "../../types/shopBooking";
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
      {confirmation && <View style={s.card}><Ionicons name="checkmark-circle" size={42} color={colors.success} /><Text style={s.title}>Your request has been sent.</Text><Text style={s.muted}>You can return to this request from History at any time.</Text></View>}
      <View style={s.card}><Text style={s.title}>{booking.providerName}</Text><StatusBadge status={booking.status} />
        <Text accessibilityLiveRegion="polite" style={s.text}>{booking.status === "rejected" ? "The shop rejected this request. Please choose another available shop."
          : booking.status === "pending" ? "Waiting for the shop to accept your request."
          : booking.status === "accepted" ? "The shop accepted your request. Bring your vehicle to the shop."
          : booking.status === "completed" ? "Your service is completed."
          : booking.status === "cancelled" ? "This request was cancelled."
          : `Your service is now ${SHOP_STATUS_LABELS[booking.status]?.toLowerCase() ?? booking.status}.`}</Text>
      </View>
      {!confirmation && step >= 0 && <View style={s.card}><Text style={s.label}>SERVICE PROGRESS</Text>
        {SHOP_STATUS_FLOW.map((status, index) => <View key={status} style={s.row}>
          <Ionicons name={index < step || booking.status === "completed" ? "checkmark-circle" : "ellipse-outline"} size={20} color={index <= step ? colors.primary : colors.textMuted} />
          <Text style={[s.text, index === step && { fontWeight: "700", color: colors.primary }]}>{SHOP_STATUS_LABELS[status]}</Text>
        </View>)}
      </View>}
      <View style={s.card}><Info label="Vehicle" value={`${booking.vehicleYear} ${booking.vehicle}`} /><Info label="Plate" value={booking.vehiclePlate} />
        <Info label="Problem" value={booking.problem} />{booking.notes ? <Info label="Notes" value={booking.notes} /> : null}
        <Info label="Starting price (not a final bill)" value={booking.startingPrice} />
      </View>
      <View style={s.card}><Info label="Customer" value={booking.customerName} /><Info label="Email" value={booking.customerEmail} />
        <Info label="Your location at request time" value={`${booking.latitude}, ${booking.longitude}`} />
        <Info label="Shop area" value={booking.shopAreaLabel ?? ""} />
        {Number.isFinite(booking.shopLatitude) && Number.isFinite(booking.shopLongitude) && <>
          <Info label="Shop location" value={`${booking.shopLatitude}, ${booking.shopLongitude}`} /><Button title="View Shop Location" secondary onPress={() => void openShopMap()} />
        </>}{mapError && <Text style={s.error}>{mapError}</Text>}
      </View>
      <View style={s.card}><Info label="Request ID" value={booking.id} /><Info label="Requested" value={formatTime(booking.createdAt)} /><Info label="Last updated" value={formatTime(booking.updatedAt)} /></View>
      {confirmation && <Button title="View Request Status" onPress={() => router.replace({ pathname: "/(v_owner)/shop-booking/booking-detail", params: { bookingId: booking.id } })} />}
      {(booking.status === "rejected" || booking.status === "cancelled") && <Button title="Find Another Shop" onPress={() => router.replace("/(v_owner)")} />}
    </>}
    <Button title="Back to History" secondary onPress={() => router.replace("/(v_owner)/history")} />
    <Button title="Back to Home" secondary onPress={() => router.replace("/(v_owner)")} />
  </ShopBookingScreen>;
}
