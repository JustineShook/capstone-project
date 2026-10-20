import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToHomeGarageRequests } from "../../services/homeGarageBookingService";
import type { HomeGarageBooking } from "../../types/homeGarageBooking";

const C = { canvas: "#08090B", card: "#17191C", text: "#F5F2F0", muted: "#B7B2B0", red: "#F52239", border: "#303135", green: "#25C47A" };
type HistoryFilter = "ALL" | "COMPLETED" | "CANCELLED";
function isCancelled(status: HomeGarageBooking["status"]) { return status === "cancelled" || status === "rejected"; }
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function recordedPrice(item: HomeGarageBooking) {
  if (item.finalPrice != null) return `Final service price: ₱${item.finalPrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (item.assessmentPrice != null) return `Assessed price: ₱${item.assessmentPrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return "";
}

export default function HomeGarageHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HomeGarageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => subscribeToHomeGarageRequests((next) => { setItems(next); setLoading(false); setError(""); }, (reason) => { setError(reason.message || "Could not load repair history."); setLoading(false); }), []);

  const history = useMemo(() => items.filter((item) => item.status === "completed" || isCancelled(item.status)), [items]);
  const completedCount = history.filter((item) => item.status === "completed").length;
  const cancelledCount = history.filter((item) => isCancelled(item.status)).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => {
      const matchFilter = filter === "ALL" || (filter === "COMPLETED" ? item.status === "completed" : isCancelled(item.status));
      const matchSearch = !query || `${item.customerName} ${item.vehicleYear} ${item.vehicle} ${item.vehiclePlate} ${item.problem} ${item.serviceAreaLabel}`.toLocaleLowerCase().includes(query);
      return matchFilter && matchSearch;
    });
  }, [history, filter, search]);
  const open = (item: HomeGarageBooking) => router.push({ pathname: "/(homegarage)/repair-request-detail", params: { bookingId: item.id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><View style={s.headerIcon}><Feather name="home" size={20} color={C.text} /></View></View>
      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} style={s.summary} imageStyle={s.summaryImage}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}><Text style={s.summaryEyebrow}>HOME GARAGE WORKSPACE</Text><Text style={s.summaryTitle}>Repair history</Text><Text style={s.summarySubtitle}>Review completed and closed repair requests.</Text></View>
      </ImageBackground>
      <View style={s.statsRow}>
        <View style={s.statCard}><View style={[s.statIcon, { backgroundColor: "rgba(37,196,122,0.15)" }]}><Feather name="check-circle" size={20} color={C.green} /></View><Text style={s.statLabel}>COMPLETED</Text><Text style={s.statValue}>{completedCount}</Text></View>
        <View style={s.statCard}><View style={[s.statIcon, { backgroundColor: "rgba(245,34,57,0.15)" }]}><Feather name="x-circle" size={20} color={C.red} /></View><Text style={s.statLabel}>CANCELLED</Text><Text style={s.statValue}>{cancelledCount}</Text></View>
      </View>
      <View style={s.sectionHeading}><View><Text style={s.sectionTitle}>Past repair requests</Text><Text style={s.sectionSubtitle}>Search and open a request to see its full details.</Text></View><View style={s.historyCount}><Feather name="archive" size={15} color={C.red} /><Text style={s.historyCountText}>{history.length}</Text></View></View>
      <View style={s.searchBox}><Feather name="search" size={20} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search customer or vehicle" placeholderTextColor={C.muted} style={s.searchInput} returnKeyType="search" clearButtonMode="while-editing" /></View>
      <View style={s.filters}>{(["ALL", "COMPLETED", "CANCELLED"] as HistoryFilter[]).map((key) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Feather name={key === "ALL" ? "list" : key === "COMPLETED" ? "check-circle" : "x-circle"} size={16} color={filter === key ? "#FFFFFF" : C.muted} /><Text style={[s.filterText, filter === key && s.filterTextActive]}>{key === "ALL" ? "All" : key === "COMPLETED" ? "Completed" : "Cancelled"}</Text>{key === "ALL" && <Text style={[s.filterCount, filter === key && s.filterTextActive]}>{history.length}</Text>}</TouchableOpacity>)}</View>

      {loading ? <View style={s.empty}><ActivityIndicator size="large" color={C.red} /><Text style={s.emptyTitle}>Loading repair history…</Text></View> : error ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="alert-circle" size={28} color={C.red} /></View><Text style={s.emptyTitle}>{error}</Text></View> : visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="clock" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>{search ? "No matching history" : "No repair history yet"}</Text><Text style={s.emptyText}>{search ? "Try another customer, vehicle, or repair." : "Completed and cancelled repair requests will appear here."}</Text></View> : visible.map((item) => <View key={item.id} style={s.card}>
        <View style={s.cardHeader}><View style={s.person}><View style={s.avatar}><Feather name="user" size={20} color={C.text} /></View><View style={s.personCopy}><Text style={s.customerName} numberOfLines={1}>{item.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicleYear} {item.vehicle} · {item.vehiclePlate}</Text></View></View><View style={[s.status, item.status === "completed" ? s.completed : s.cancelled]}><Text style={s.statusText}>{item.status === "completed" ? "Completed" : item.status === "rejected" ? "Declined" : "Cancelled"}</Text></View></View>
        <View style={s.infoRow}><Feather name="calendar" size={18} color="#D6D2D0" /><Text style={s.infoText}>{dateLabel(item.updatedAt || item.createdAt)}</Text></View>
        {recordedPrice(item) ? <View style={s.infoRow}><Feather name="dollar-sign" size={18} color="#D6D2D0" /><Text style={s.infoText}>{recordedPrice(item)}</Text></View> : null}
        <View style={s.infoRow}><Feather name="map-pin" size={18} color="#D6D2D0" /><Text style={s.infoText} numberOfLines={1}>{item.serviceAreaLabel || "Home garage service"}</Text></View>
        <View style={s.infoRow}><Feather name="tool" size={18} color="#D6D2D0" /><Text style={s.infoText} numberOfLines={2}>{item.problem}</Text></View>
        <TouchableOpacity style={s.detailsButton} onPress={() => open(item)} activeOpacity={0.75}><Text style={s.detailsText}>View Details</Text><Feather name="chevron-right" size={19} color={C.text} /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 5 },
  header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginBottom: 8 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 34, lineHeight: 39, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 21, fontWeight: "900" }, brandRed: { color: C.red }, headerIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  summary: { minHeight: 155, borderRadius: 20, overflow: "hidden", backgroundColor: "#28292B", justifyContent: "flex-end", padding: 20 }, summaryImage: { borderRadius: 20 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,8,10,0.66)" }, summaryCopy: { gap: 4 }, summaryEyebrow: { color: "#FF9A9D", fontSize: 12, letterSpacing: 1.5, fontWeight: "800" }, summaryTitle: { color: "#FFFFFF", fontSize: 29, lineHeight: 36, fontWeight: "900" }, summarySubtitle: { color: "#F0EDEB", fontSize: 15, lineHeight: 21, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 11, marginTop: 13 }, statCard: { flex: 1, minHeight: 105, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 12 }, statIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 7 }, statLabel: { color: C.muted, fontSize: 11, letterSpacing: 0.7, fontWeight: "800" }, statValue: { color: C.text, fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 1 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 }, sectionTitle: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: "900" }, sectionSubtitle: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, historyCount: { minWidth: 50, height: 38, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, historyCountText: { color: C.text, fontSize: 15, fontWeight: "800" },
  searchBox: { minHeight: 56, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16 }, searchInput: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 12 },
  filters: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 14 }, filter: { minHeight: 43, flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center", borderRadius: 13, paddingHorizontal: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, filterActive: { backgroundColor: C.red, borderColor: C.red }, filterText: { color: C.muted, fontSize: 13, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF", fontWeight: "900" }, filterCount: { color: C.muted, fontSize: 12, fontWeight: "800" },
  card: { borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 0, marginBottom: 14 }, cardHeader: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 }, person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#30343A", alignItems: "center", justifyContent: "center" }, personCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: "800" }, vehicle: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 2 }, status: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 }, completed: { backgroundColor: "#147A4A" }, cancelled: { backgroundColor: "#982E2E" }, statusText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  infoRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 11 }, infoText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 }, detailsButton: { minHeight: 53, borderTopWidth: 1, borderTopColor: "#3A3B3F", marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsText: { color: C.text, fontSize: 16, fontWeight: "800" },
  empty: { minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, gap: 12 }, emptyIcon: { width: 76, height: 76, borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 3 }, emptyTitle: { color: C.text, fontSize: 20, lineHeight: 27, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
