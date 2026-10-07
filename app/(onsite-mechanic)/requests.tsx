import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToMechanicRequests } from "../../services/owner/bookingService";
import type { BookingRequest } from "../../types/owner/booking";

const COLORS = { canvas: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", status: "#2A363E", red: "#F51F3B", line: "#53616A" };
type Filter = "ALL" | "NEW" | "ONGOING" | "COMPLETED" | "CANCELLED";
type BookingStatus = Exclude<Filter, "ALL">;

interface DisplayBooking { id: string; status: BookingStatus; time: string; vehicle: string; location: string; }

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "NEW", label: "New" }, { key: "ONGOING", label: "Ongoing" }, { key: "COMPLETED", label: "Completed" }, { key: "CANCELLED", label: "Cancelled" },
];

function statusLabel(status: BookingStatus) {
  if (status === "NEW") return "New request";
  if (status === "ONGOING") return "On the way";
  if (status === "COMPLETED") return "Completed";
  return "Cancelled";
}

function toDisplayBooking(booking: BookingRequest): DisplayBooking {
  const status: BookingStatus = booking.status === "pending" ? "NEW"
    : booking.status === "completed" ? "COMPLETED"
    : booking.status === "cancelled" || booking.status === "rejected" ? "CANCELLED"
    : "ONGOING";
  const date = new Date(booking.createdAt);
  const time = Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const location = booking.customerAddress?.trim() || (Number.isFinite(booking.latitude) && Number.isFinite(booking.longitude)
    ? `${booking.latitude.toFixed(4)}, ${booking.longitude.toFixed(4)}`
    : "Customer location");
  return { id: booking.id, status, time, vehicle: booking.vehicle, location };
}

export default function RequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [bookings, setBookings] = useState<DisplayBooking[]>([]);
  useEffect(() => subscribeToMechanicRequests((items) => setBookings(items.map(toDisplayBooking))), []);
  const filteredBookings = useMemo(() => filter === "ALL" ? bookings : bookings.filter((booking) => booking.status === filter), [bookings, filter]);
  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.canvas} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>My Bookings</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(({ key, label }) => <TouchableOpacity key={key} style={[styles.filter, filter === key && styles.filterActive]} onPress={() => setFilter(key)}><Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      {filteredBookings.length === 0 ? <View style={styles.empty}><Feather name="inbox" size={28} color={COLORS.muted} /><Text style={styles.emptyText}>No {filter === "ALL" ? "bookings" : filter.toLowerCase() + " bookings"}.</Text></View> : filteredBookings.map((booking) => <TouchableOpacity key={booking.id} style={styles.bookingCard} onPress={() => router.push({ pathname: "/(onsite-mechanic)/request-details", params: { id: booking.id } })} activeOpacity={0.75}>
        <View style={styles.cardTop}><View style={styles.status}><Text style={styles.statusText}>{statusLabel(booking.status)}</Text></View><Text style={styles.time}>{booking.time}</Text></View>
        <View style={styles.vehicleRow}><Text style={styles.vehicle}>{booking.vehicle}</Text><Feather name="chevron-right" size={24} color={COLORS.muted} /></View>
        <View style={styles.locationRow}><View style={styles.locationIcon}><Feather name="map-pin" size={18} color={COLORS.text} /></View><Text style={styles.location}>{booking.location}</Text></View>
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas }, content: { paddingHorizontal: 16, paddingTop: 14 }, title: { color: COLORS.text, fontSize: 24, fontWeight: "700" }, filterRow: { gap: 9, paddingTop: 18, paddingBottom: 16 }, filter: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderRadius: 7, backgroundColor: COLORS.card }, filterActive: { backgroundColor: COLORS.red }, filterText: { color: COLORS.text, fontSize: 14, fontWeight: "600" }, filterTextActive: { color: "#FFFFFF" }, bookingCard: { borderRadius: 10, backgroundColor: COLORS.card, padding: 16, marginBottom: 12 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, status: { borderRadius: 6, backgroundColor: COLORS.status, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: COLORS.text, fontSize: 13, fontWeight: "600" }, time: { color: COLORS.muted, fontSize: 14 }, vehicleRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, vehicle: { color: COLORS.text, fontSize: 19, fontWeight: "700" }, locationRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 9 }, locationIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#39444C" }, location: { color: COLORS.text, fontSize: 15 }, empty: { alignItems: "center", gap: 12, paddingTop: 72 }, emptyText: { color: COLORS.muted, fontSize: 16 },
});
