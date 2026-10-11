import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { ShopNotificationBell } from "../../components/shop-owner/ShopNotificationBell";
import { isActiveShopService, SHOP_STATUS_LABELS, type ShopBookingRequest } from "../../types/shopBooking";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#303135" };
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
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><ShopNotificationBell style={s.bell} size={22} color={C.text} /></View>

      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.summaryImage} style={s.summary}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}><View style={s.summaryEyebrow}><Feather name="tool" size={13} color="#FF8995" /><Text style={s.summaryEyebrowText}>AUTO SHOP WORKSPACE</Text></View><Text style={s.summaryTitle}>Requests</Text><Text style={s.summaryHint}>Review and manage customer bookings</Text></View><View style={s.summaryDivider} /><View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{"\n"}requests</Text></View>
      </ImageBackground>

      <View style={s.sectionIntro}><View><Text style={s.sectionTitle}>Your workload</Text><Text style={s.sectionHint}>Stay on top of every customer</Text></View><View style={s.totalPill}><Feather name="activity" size={14} color="#FF8995" /><Text style={s.totalText}>{pending.length + active.length} open</Text></View></View>
      <View style={s.filters}>{FILTERS.map(([key, text]) => <FilterButton key={key} icon={key === "ALL" ? "list" : key === "NEW" ? "clipboard" : "tool"} label={text} count={key === "ALL" ? requests.length : key === "NEW" ? pending.length : active.length} active={filter === key} onPress={() => setFilter(key)} />)}</View>

      {requestsLoading ? <View style={s.empty}><Feather name="loader" size={28} color={C.muted} /><Text style={s.emptyTitle}>Loading requests…</Text></View> : requestsError ? <View style={s.empty}><Feather name="alert-circle" size={28} color={C.red} /><Text style={s.emptyTitle}>{requestsError}</Text><TouchableOpacity style={s.retry} onPress={retry}><Text style={s.retryText}>Try Again</Text></TouchableOpacity></View> : visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="inbox" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>No {filter === "ALL" ? "service" : filter.toLowerCase()} requests</Text><Text style={s.emptyText}>Customer bookings will appear here.</Text></View> : visible.map((item) => <View key={item.id} style={s.card}>
        <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={21} color={C.text} /></View><View style={s.customerCopy}><Text style={s.customer} numberOfLines={1}>{item.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicle}</Text></View><View style={[s.status, item.status === "pending" ? s.pendingStatus : item.status === "completed" ? s.completedStatus : null]}><Text style={[s.statusText, item.status === "pending" ? s.pendingText : item.status === "completed" ? s.completedText : null]}>{SHOP_STATUS_LABELS[item.status]}</Text></View></View>
        <View style={s.detail}><View style={s.detailLabel}><Feather name="map-pin" size={17} color={C.red} /><Text style={s.detailCaption}>Shop</Text></View><Text style={s.detailValue} numberOfLines={1}>{item.shopAreaLabel || "Auto shop service"}</Text></View>
        <View style={s.detail}><View style={s.detailLabel}><Feather name="message-square" size={17} color={C.muted} /><Text style={s.detailCaption}>Service needed</Text></View><Text style={s.problem} numberOfLines={2}>{item.problem}</Text></View>
        <TouchableOpacity style={s.viewButton} onPress={() => open(item)} activeOpacity={0.82}><Text style={s.viewButtonText}>{item.status === "pending" ? "Review Request" : "View Request"}</Text><Feather name="chevron-right" size={20} color="#F7EFED" /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function FilterButton({ icon, label, count, active, onPress }: { icon: "clipboard" | "tool" | "list"; label: string; count: number; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={s.filterButton} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}><View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={icon} size={20} color={active ? "#FFFFFF" : C.muted} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View><Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text></TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 138, borderRadius: 17, backgroundColor: "#171C23", borderWidth: 1, borderColor: "#333B44", flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16, overflow: "hidden" }, summaryImage: { borderRadius: 17, opacity: 0.58 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,13,18,0.58)" }, summaryCopy: { flex: 1 }, summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: "#FFC0C6", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 32, fontWeight: "800" }, summaryHint: { color: "#E3E5E7", fontSize: 13, lineHeight: 19, marginTop: 4 }, summaryDivider: { width: 1, height: 66, backgroundColor: "rgba(255,255,255,0.34)", marginHorizontal: 16 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "800" }, countLabel: { color: "#F7EFED", fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 5, paddingHorizontal: 3 }, sectionTitle: { color: C.text, fontSize: 20, fontWeight: "800" }, sectionHint: { color: C.muted, fontSize: 12, marginTop: 3 }, totalPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#281B20", borderWidth: 1, borderColor: "#53303A", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }, totalText: { color: "#FFD6DA", fontSize: 12, fontWeight: "700" },
  filters: { minHeight: 62, flexDirection: "row", gap: 9, marginBottom: 10, paddingTop: 9 }, filterButton: { flex: 1, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#172029", borderWidth: 1, borderColor: "#2C3944", borderRadius: 13 }, filterIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: {}, filterDot: { position: "absolute", top: -1, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 14, lineHeight: 20 }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  card: { borderRadius: 17, backgroundColor: "#151D24", borderWidth: 1, borderColor: "#2C3944", padding: 16, marginBottom: 13 }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#293A48", alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1 }, customer: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#3B2D1C", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }, pendingStatus: { backgroundColor: "#3B2D1C" }, completedStatus: { backgroundColor: "#17452F" }, statusText: { color: "#FFD691", fontSize: 12, lineHeight: 16, fontWeight: "800" }, pendingText: { color: "#FFD691" }, completedText: { color: "#91E8B6" }, activeStatus: { backgroundColor: "#143828" }, activeStatusText: { color: "#91E8B6" },
  detail: { borderTopWidth: 1, borderTopColor: "#292A2D", paddingTop: 13, marginTop: 12 }, detailLabel: { flexDirection: "row", alignItems: "center", gap: 8 }, detailCaption: { color: C.muted, fontSize: 13, lineHeight: 18 }, detailValue: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 4 }, problem: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 4 },
  viewButton: { minHeight: 46, borderRadius: 10, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13 }, viewButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, empty: { minHeight: 250, borderRadius: 18, backgroundColor: "#151D24", borderWidth: 1, borderColor: "#2C3944", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 25, gap: 12 }, emptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: "#263541", alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 }, retryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
