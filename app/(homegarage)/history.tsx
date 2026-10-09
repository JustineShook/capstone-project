import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToProviderParkingBookings } from "../../services/parkingBookingService";
import type { ParkingBooking } from "../../types/parkingBooking";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#303135" };
type HistoryFilter = "ALL" | "COMPLETED" | "CANCELLED";
function historyDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export default function ParkingHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  useEffect(() => subscribeToProviderParkingBookings(setBookings, () => undefined), []);

  const history = useMemo(() => bookings.filter((item) => item.status === "completed" || item.status === "cancelled"), [bookings]);
  const completedCount = history.filter((item) => item.status === "completed").length;
  const cancelledCount = history.filter((item) => item.status === "cancelled").length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => {
      const matchesFilter = filter === "ALL" || (filter === "COMPLETED" ? item.status === "completed" : item.status === "cancelled");
      const matchesSearch = !query || `${item.customerName} ${item.vehicle} ${item.vehiclePlate} ${item.vehicleType} ${item.slotNumber}`.toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [history, filter, search]);
  const open = (id: string) => router.push({ pathname: "/(homegarage)/parking-session-detail", params: { bookingId: id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Bookings" onPress={() => router.push("/(homegarage)/parking-sessions")}><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>
      <View style={s.summary}><Text style={s.summaryTitle}>Parking history</Text><Text style={s.summarySubtitle}>{completedCount} Completed  ·  {cancelledCount} Cancelled</Text></View>
      <View style={s.searchBox}><Feather name="search" size={19} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search customer, vehicle, or slot" placeholderTextColor={C.muted} style={s.searchInput} returnKeyType="search" clearButtonMode="while-editing" /></View>
      <View style={s.filters}>{(["ALL", "COMPLETED", "CANCELLED"] as HistoryFilter[]).map((key) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Text style={[s.filterText, filter === key && s.filterTextActive]}>{key === "ALL" ? "All" : key === "COMPLETED" ? "Completed" : "Cancelled"}</Text></TouchableOpacity>)}</View>
      {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="clock" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>{search ? "No matching history" : "No parking history yet"}</Text><Text style={s.emptyText}>{search ? "Try another customer, vehicle, or slot number." : "Completed and cancelled parking bookings will appear here."}</Text></View> : visible.map((booking) => <View key={booking.id} style={s.card}>
        <View style={s.cardHeader}><View style={s.person}><View style={s.avatar}><Feather name="user" size={20} color="#FFFFFF" /></View><View style={s.personCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}</Text></View></View><View style={[s.status, booking.status === "completed" ? s.completed : s.cancelled]}><Text style={s.statusText}>{booking.status === "completed" ? "Completed" : "Cancelled"}</Text></View></View>
        <View style={s.infoRow}><Feather name="calendar" size={18} color="#D6D7D9" /><Text style={s.infoText}>{historyDate(booking.parkingEndedAt || booking.updatedAt || booking.bookedAt)}</Text></View>
        <View style={s.infoRow}><Feather name="grid" size={18} color="#D6D7D9" /><Text style={s.infoText}>Slot #{String(booking.slotNumber).padStart(2, "0")} · {booking.vehicleType || "Vehicle"}</Text></View>
        <TouchableOpacity style={s.detailsButton} onPress={() => open(booking.id)} activeOpacity={0.75}><Text style={s.detailsText}>View Details</Text><Feather name="chevron-right" size={18} color="#FFFFFF" /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 122, borderRadius: 17, backgroundColor: C.red, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 17 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 32, fontWeight: "800" }, summarySubtitle: { color: "#F7EFED", fontSize: 14, lineHeight: 20, marginTop: 4 }, searchBox: { minHeight: 50, borderRadius: 26, backgroundColor: "#1C1F22", borderWidth: 1, borderColor: "#44464A", flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, marginTop: 13 }, searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 9 }, filters: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 13 }, filter: { minHeight: 42, minWidth: 58, justifyContent: "center", alignItems: "center", borderRadius: 22, paddingHorizontal: 18, backgroundColor: "#202225", borderWidth: 1, borderColor: "#44464A" }, filterActive: { backgroundColor: C.red, borderColor: C.red }, filterText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" }, filterTextActive: { color: "#FFFFFF", fontWeight: "800" },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 0, marginBottom: 13 }, cardHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 }, person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { width: 49, height: 49, borderRadius: 25, backgroundColor: "#424347", alignItems: "center", justifyContent: "center" }, personCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, completed: { backgroundColor: "#147A4A" }, cancelled: { backgroundColor: "#982E2E" }, statusText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "800" }, infoRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 11 }, infoText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, flex: 1 }, detailsButton: { minHeight: 49, borderTopWidth: 1, borderTopColor: "#3A3B3F", marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  empty: { minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 }, emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 19, fontWeight: "700" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
