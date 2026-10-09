import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import type { ShopBookingRequest } from "../../types/shopBooking";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", red: "#F52239", border: "#303135" };
type HistoryFilter = "ALL" | "COMPLETED" | "CANCELLED";
function isCancelled(status: ShopBookingRequest["status"]) { return status === "cancelled" || status === "rejected"; }
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export default function ShopServiceHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requests, requestsLoading, requestsError, retry } = useShopDashboard();
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const history = useMemo(() => requests.filter((item) => item.status === "completed" || isCancelled(item.status)), [requests]);
  const completedCount = history.filter((item) => item.status === "completed").length;
  const cancelledCount = history.filter((item) => isCancelled(item.status)).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => {
      const matchFilter = filter === "ALL" || (filter === "COMPLETED" ? item.status === "completed" : isCancelled(item.status));
      const matchSearch = !query || `${item.customerName} ${item.vehicle} ${item.problem} ${item.shopAreaLabel}`.toLocaleLowerCase().includes(query);
      return matchFilter && matchSearch;
    });
  }, [history, filter, search]);
  const open = (item: ShopBookingRequest) => router.push({ pathname: "/(shop-owner)/request-details", params: { id: item.id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Requests" onPress={() => router.push("/(shop-owner)/requests")}><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>
      <View style={s.summary}><Text style={s.summaryTitle}>Service history</Text><Text style={s.summarySubtitle}>{completedCount} Completed  ·  {cancelledCount} Cancelled</Text></View>
      <View style={s.searchBox}><Feather name="search" size={20} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search customer or vehicle" placeholderTextColor={C.muted} style={s.searchInput} returnKeyType="search" clearButtonMode="while-editing" /></View>
      <View style={s.filters}>{(["ALL", "COMPLETED", "CANCELLED"] as HistoryFilter[]).map((key) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Text style={[s.filterText, filter === key && s.filterTextActive]}>{key === "ALL" ? "All" : key === "COMPLETED" ? "Completed" : "Cancelled"}</Text></TouchableOpacity>)}</View>

      {requestsLoading ? <View style={s.empty}><ActivityIndicator size="large" color={C.red} /><Text style={s.emptyTitle}>Loading service history…</Text></View> : requestsError ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="alert-circle" size={28} color={C.red} /></View><Text style={s.emptyTitle}>{requestsError}</Text><TouchableOpacity style={s.retry} onPress={retry}><Text style={s.retryText}>Try Again</Text></TouchableOpacity></View> : visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="clock" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>{search ? "No matching history" : "No service history yet"}</Text><Text style={s.emptyText}>{search ? "Try another customer, vehicle, or service." : "Completed and cancelled bookings will appear here."}</Text></View> : visible.map((item) => <View key={item.id} style={s.card}>
        <View style={s.cardHeader}><View style={s.person}><View style={s.avatar}><Feather name="user" size={20} color={C.text} /></View><View style={s.personCopy}><Text style={s.customerName} numberOfLines={1}>{item.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicle}</Text></View></View><View style={[s.status, item.status === "completed" ? s.completed : s.cancelled]}><Text style={s.statusText}>{item.status === "completed" ? "Completed" : "Cancelled"}</Text></View></View>
        <View style={s.infoRow}><Feather name="calendar" size={18} color="#D6D2D0" /><Text style={s.infoText}>{dateLabel(item.updatedAt || item.createdAt)}</Text></View>
        <View style={s.infoRow}><Feather name="map-pin" size={18} color="#D6D2D0" /><Text style={s.infoText} numberOfLines={1}>{item.shopAreaLabel || "Auto shop service"}</Text></View>
        <View style={s.infoRow}><Feather name="tool" size={18} color="#D6D2D0" /><Text style={s.infoText} numberOfLines={2}>{item.problem}</Text></View>
        <TouchableOpacity style={s.detailsButton} onPress={() => open(item)} activeOpacity={0.75}><Text style={s.detailsText}>View Details</Text><Feather name="chevron-right" size={19} color={C.text} /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 31, lineHeight: 36, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 19, fontWeight: "800" }, bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 108, borderRadius: 16, backgroundColor: C.red, justifyContent: "center", paddingHorizontal: 17, paddingVertical: 14 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 33, fontWeight: "800" }, summarySubtitle: { color: "#F7EFED", fontSize: 14, lineHeight: 20, marginTop: 3 },
  searchBox: { minHeight: 52, borderRadius: 27, backgroundColor: "#1C1F22", borderWidth: 1, borderColor: "#44464A", flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15, marginTop: 12 }, searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 10 },
  filters: { flexDirection: "row", gap: 9, marginTop: 12, marginBottom: 13 }, filter: { minHeight: 40, minWidth: 58, justifyContent: "center", alignItems: "center", borderRadius: 22, paddingHorizontal: 17, backgroundColor: "#202225", borderWidth: 1, borderColor: "#44464A" }, filterActive: { backgroundColor: C.red, borderColor: C.red }, filterText: { color: C.text, fontSize: 13, fontWeight: "600" }, filterTextActive: { color: "#F7EFED", fontWeight: "800" },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 0, marginBottom: 12 }, cardHeader: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#424347", alignItems: "center", justifyContent: "center" }, personCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, status: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }, completed: { backgroundColor: "#147A4A" }, cancelled: { backgroundColor: "#982E2E" }, statusText: { color: "#F7EFED", fontSize: 11, lineHeight: 15, fontWeight: "800" },
  infoRow: { minHeight: 37, flexDirection: "row", alignItems: "center", gap: 10 }, infoText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }, detailsButton: { minHeight: 47, borderTopWidth: 1, borderTopColor: "#3A3B3F", marginTop: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsText: { color: C.text, fontSize: 14, fontWeight: "600" },
  empty: { minHeight: 250, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, gap: 11 }, emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 3 }, emptyTitle: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: "700", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 12 }, retryText: { color: "#F7EFED", fontSize: 14, fontWeight: "700" },
});
