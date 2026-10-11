import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";

const C = { canvas: "#08090B", card: "#151D24", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#2C3944" };
type HistoryFilter = "ALL" | "COMPLETED" | "CANCELLED";

function isCancelled(status: TowingBookingRequest["status"]) { return status === "cancelled" || status === "rejected"; }
function statusLabel(status: TowingBookingRequest["status"]) { return isCancelled(status) ? "Cancelled" : "Completed"; }
function historyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TowingHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  useEffect(() => subscribeToTowingRequests(setBookings), []);

  const history = useMemo(() => bookings.filter((booking) => booking.status === "completed" || isCancelled(booking.status)), [bookings]);
  const completedCount = history.filter((booking) => booking.status === "completed").length;
  const cancelledCount = history.filter((booking) => isCancelled(booking.status)).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((booking) => {
      const matchesFilter = filter === "ALL" || (filter === "COMPLETED" ? booking.status === "completed" : isCancelled(booking.status));
      const matchesSearch = !query || `${booking.customerName} ${booking.vehicle} ${booking.pickupLocation} ${booking.destination}`.toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [history, filter, search]);

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/notifications")}><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>

      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.summaryImage} style={s.summary}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}><View style={s.summaryEyebrow}><Feather name="clock" size={13} color="#FF8995" /><Text style={s.summaryEyebrowText}>YOUR JOURNEY</Text></View><Text style={s.summaryTitle}>Service history</Text><Text style={s.summarySubtitle}>{completedCount} Completed  ·  {cancelledCount} Cancelled</Text></View>
      </ImageBackground>

      <View style={s.statsRow}><View style={s.statCard}><View style={s.statIconGreen}><Feather name="check" size={17} color="#76E0A4" /></View><Text style={s.statLabel}>Completed jobs</Text><Text style={s.statValue}>{completedCount}</Text></View><View style={s.statCardBlue}><View style={s.statIconBlue}><Feather name="x" size={17} color="#76C9FF" /></View><Text style={s.statLabel}>Cancelled jobs</Text><Text style={s.statValue}>{cancelledCount}</Text></View></View>

      <View style={s.searchBox}><Feather name="search" size={19} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search customer or vehicle" placeholderTextColor={C.muted} style={s.searchInput} returnKeyType="search" clearButtonMode="while-editing" /></View>

      <View style={s.historyHeading}><View><Text style={s.historyTitle}>Past jobs</Text><Text style={s.historyHint}>Your completed and cancelled towing services</Text></View><View style={s.historyCount}><Text style={s.historyCountText}>{visible.length} records</Text></View></View>

      <View style={s.filters}>{(["ALL", "COMPLETED", "CANCELLED"] as HistoryFilter[]).map((key) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Text style={[s.filterText, filter === key && s.filterTextActive]}>{key === "ALL" ? "All" : key === "COMPLETED" ? "Completed" : "Cancelled"}</Text></TouchableOpacity>)}</View>

      {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="clock" size={29} color={C.muted} /></View><Text style={s.emptyTitle}>{search ? "No matching history" : "No service history yet"}</Text><Text style={s.emptyText}>{search ? "Try another customer or vehicle name." : "Completed and cancelled towing jobs will appear here."}</Text></View> : visible.map((booking) => (
        <View key={booking.id} style={s.card}>
          <View style={s.cardHeader}><View style={s.person}><View style={s.avatar}><Feather name="user" size={20} color="#FFFFFF" /></View><View style={s.personCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehicleYear ? ` · ${booking.vehicleYear}` : ""}</Text></View></View><View style={[s.status, booking.status === "completed" ? s.completed : s.cancelled]}><Text style={s.statusText}>{statusLabel(booking.status)}</Text></View></View>
          <View style={s.infoRow}><Feather name="calendar" size={18} color="#D6D7D9" /><Text style={s.infoText}>{historyDate(booking.updatedAt || booking.createdAt)}</Text></View>
          <View style={s.infoRow}><Feather name="map-pin" size={18} color={C.red} /><Text style={s.infoText} numberOfLines={2}>{booking.pickupLocation}</Text><Text style={s.routeLabel}>Pickup</Text></View>
          <View style={s.infoRow}><Feather name="flag" size={18} color="#D6D7D9" /><Text style={s.infoText} numberOfLines={2}>{booking.destination}</Text><Text style={s.routeLabel}>Drop-off</Text></View>
          <TouchableOpacity style={s.detailsButton} onPress={() => router.push({ pathname: "/(towing-company)/request-details", params: { id: booking.id } })} activeOpacity={0.75}><Text style={s.detailsText}>View Details</Text><Feather name="chevron-right" size={18} color="#FFFFFF" /></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 132, borderRadius: 17, backgroundColor: "#171C23", borderWidth: 1, borderColor: "#333B44", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 17, overflow: "hidden" }, summaryImage: { borderRadius: 17, opacity: 0.58 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,13,18,0.58)" }, summaryCopy: { flex: 1, justifyContent: "center" }, summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: "#FFC0C6", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 32, fontWeight: "800" }, summarySubtitle: { color: "#E3E5E7", fontSize: 14, lineHeight: 20, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 }, statCard: { flex: 1, minHeight: 98, borderRadius: 15, backgroundColor: "#14251D", borderWidth: 1, borderColor: "#28513B", paddingHorizontal: 14, paddingVertical: 11, justifyContent: "center" }, statCardBlue: { flex: 1, minHeight: 98, borderRadius: 15, backgroundColor: "#15232D", borderWidth: 1, borderColor: "#2A465A", paddingHorizontal: 14, paddingVertical: 11, justifyContent: "center" }, statIconGreen: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#1B3A2A", alignItems: "center", justifyContent: "center", marginBottom: 5 }, statIconBlue: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#1C3444", alignItems: "center", justifyContent: "center", marginBottom: 5 }, statLabel: { color: C.muted, fontSize: 12, lineHeight: 17 }, statValue: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: "800", marginTop: 1 },
  searchBox: { minHeight: 50, borderRadius: 26, backgroundColor: "#172029", borderWidth: 1, borderColor: "#33424E", flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, marginTop: 13 }, searchInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 9 },
  historyHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 2, paddingHorizontal: 2 }, historyTitle: { color: C.text, fontSize: 20, fontWeight: "800" }, historyHint: { color: C.muted, fontSize: 12, marginTop: 3 }, historyCount: { borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#202A33", borderWidth: 1, borderColor: "#33424E" }, historyCountText: { color: "#C7D5DF", fontSize: 11, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 10 }, filter: { flex: 1, minHeight: 42, justifyContent: "center", alignItems: "center", borderRadius: 13, paddingHorizontal: 8, backgroundColor: "#172029", borderWidth: 1, borderColor: "#33424E" }, filterActive: { backgroundColor: C.red, borderColor: C.red }, filterText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" }, filterTextActive: { color: "#FFFFFF", fontWeight: "800" },
  card: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 0, marginBottom: 13 }, cardHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 }, person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { width: 49, height: 49, borderRadius: 16, backgroundColor: "#293A48", alignItems: "center", justifyContent: "center" }, personCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, completed: { backgroundColor: "#17452F" }, cancelled: { backgroundColor: "#48262B" }, statusText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  infoRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 11 }, infoText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, flex: 1 }, routeLabel: { color: C.muted, fontSize: 11 }, detailsButton: { minHeight: 49, borderTopWidth: 1, borderTopColor: "#3A3B3F", marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  empty: { minHeight: 260, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 24, gap: 12 }, emptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: "#263541", alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
