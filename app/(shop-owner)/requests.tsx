import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { isActiveShopService, SHOP_STATUS_LABELS, type ShopBookingRequest } from "../../types/shopBooking";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", red: "#F52239", border: "#303135" };
type Filter = "ALL" | "NEW" | "ONGOING" | "COMPLETED" | "CANCELLED";
const FILTERS: [Filter, string][] = [["ALL", "All"], ["NEW", "New"], ["ONGOING", "Active"]];
function group(status: ShopBookingRequest["status"]): Filter { if (status === "pending") return "NEW"; if (status === "completed") return "COMPLETED"; if (status === "rejected" || status === "cancelled") return "CANCELLED"; return "ONGOING"; }

export default function ShopRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requests, requestsLoading, requestsError, retry } = useShopDashboard();
  const [filter, setFilter] = useState<Filter>("NEW");
  const pending = requests.filter((item) => item.status === "pending");
  const active = requests.filter((item) => isActiveShopService(item.status));
  const visible = useMemo(() => filter === "ALL" ? requests : requests.filter((item) => group(item.status) === filter), [requests, filter]);
  const open = (item: ShopBookingRequest) => router.push({ pathname: isActiveShopService(item.status) ? "/(shop-owner)/active-service" : "/(shop-owner)/request-details", params: { id: item.id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Notifications"><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>

      <View style={s.summary}><View style={s.summaryCopy}><Text style={s.summaryTitle}>Service requests</Text><Text style={s.summaryHint}>Review and manage customer bookings</Text></View><View style={s.summaryDivider} /><View style={s.countBox}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{`\n`}requests</Text></View></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{FILTERS.map(([key, text]) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Text style={[s.filterText, filter === key && s.filterTextActive]}>{text}{key === "NEW" ? ` (${pending.length})` : key === "ONGOING" ? ` (${active.length})` : ""}</Text></TouchableOpacity>)}</ScrollView>

      {requestsLoading ? <View style={s.empty}><Feather name="loader" size={28} color={C.muted} /><Text style={s.emptyTitle}>Loading requests…</Text></View> : requestsError ? <View style={s.empty}><Feather name="alert-circle" size={28} color={C.red} /><Text style={s.emptyTitle}>{requestsError}</Text><TouchableOpacity style={s.retry} onPress={retry}><Text style={s.retryText}>Try Again</Text></TouchableOpacity></View> : visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="inbox" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>No {filter === "ALL" ? "service" : filter.toLowerCase()} requests</Text><Text style={s.emptyText}>Customer bookings will appear here.</Text></View> : visible.map((item) => <View key={item.id} style={s.card}>
        <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={21} color={C.text} /></View><View style={s.customerCopy}><Text style={s.customer} numberOfLines={1}>{item.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicle}</Text></View><View style={[s.status, item.status === "pending" ? s.pendingStatus : item.status === "completed" ? s.completedStatus : null]}><Text style={[s.statusText, item.status === "pending" ? s.pendingText : item.status === "completed" ? s.completedText : null]}>{SHOP_STATUS_LABELS[item.status]}</Text></View></View>
        <View style={s.detail}><View style={s.detailLabel}><Feather name="map-pin" size={17} color={C.red} /><Text style={s.detailCaption}>Shop</Text></View><Text style={s.detailValue} numberOfLines={1}>{item.shopAreaLabel || "Auto shop service"}</Text></View>
        <View style={s.detail}><View style={s.detailLabel}><Feather name="message-square" size={17} color={C.muted} /><Text style={s.detailCaption}>Service needed</Text></View><Text style={s.problem} numberOfLines={2}>{item.problem}</Text></View>
        <TouchableOpacity style={s.viewButton} onPress={() => open(item)} activeOpacity={0.82}><Text style={s.viewButtonText}>{item.status === "pending" ? "Review Request" : "View Request"}</Text><Feather name="chevron-right" size={20} color="#F7EFED" /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 31, lineHeight: 36, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 19, fontWeight: "800" }, bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 108, borderRadius: 16, backgroundColor: C.red, flexDirection: "row", alignItems: "center", paddingHorizontal: 17, paddingVertical: 14 }, summaryCopy: { flex: 1 }, summaryTitle: { color: "#F7EFED", fontSize: 24, lineHeight: 31, fontWeight: "800" }, summaryHint: { color: "#F7EFED", fontSize: 13, lineHeight: 18, marginTop: 3 }, summaryDivider: { width: 1, height: 64, backgroundColor: "rgba(255,255,255,0.48)", marginHorizontal: 14 }, countBox: { width: 58, alignItems: "center" }, countValue: { color: "#F7EFED", fontSize: 31, lineHeight: 36, fontWeight: "800" }, countLabel: { color: "#F7EFED", fontSize: 12, lineHeight: 16, textAlign: "center" },
  filters: { gap: 8, paddingTop: 14, paddingBottom: 14 }, filter: { minHeight: 39, justifyContent: "center", paddingHorizontal: 15, borderRadius: 20, backgroundColor: "#202124", borderWidth: 1, borderColor: "#393A3E" }, filterActive: { backgroundColor: C.red, borderColor: C.red }, filterText: { color: C.text, fontSize: 13, fontWeight: "600" }, filterTextActive: { color: "#F7EFED", fontWeight: "800" },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 13 }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#424347", alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1 }, customer: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 14, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#303135", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 }, pendingStatus: { backgroundColor: "#F4D28A" }, completedStatus: { backgroundColor: "#147A4A" }, statusText: { color: C.text, fontSize: 11, fontWeight: "700" }, pendingText: { color: "#292316" }, completedText: { color: "#F7EFED" },
  detail: { borderTopWidth: 1, borderTopColor: "#2E2F32", paddingTop: 10, marginTop: 9 }, detailLabel: { flexDirection: "row", alignItems: "center", gap: 8 }, detailCaption: { color: C.muted, fontSize: 12, lineHeight: 17 }, detailValue: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 2 }, problem: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 2 },
  viewButton: { minHeight: 46, borderRadius: 10, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 13 }, viewButtonText: { color: "#F7EFED", fontSize: 15, fontWeight: "800" }, empty: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingHorizontal: 25, gap: 11 }, emptyIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }, emptyTitle: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: "700", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 12 }, retryText: { color: "#F7EFED", fontWeight: "700", fontSize: 14 },
});
