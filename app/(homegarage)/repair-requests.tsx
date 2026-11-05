import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToHomeGarageRequests } from "../../services/homeGarageBookingService";
import type { HomeGarageBooking } from "../../types/homeGarageBooking";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", border: "#D5DEE9", primary: "#0F52BA", primaryDark: "#0B3D8A", subtle: "#F1F5F9", green: "#166534" };
type Filter = "ALL" | "NEW" | "ACTIVE";
const FILTERS: [Filter, string][] = [["ALL", "All"], ["NEW", "New"], ["ACTIVE", "Active"]];

export default function HomeGarageRepairRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HomeGarageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("NEW");

  useEffect(() => {
    setLoading(true); setError("");
    return subscribeToHomeGarageRequests((value) => { setItems(value); setLoading(false); }, (cause) => { setError(cause.message); setLoading(false); });
  }, [attempt]);

  const pending = items.filter((item) => item.status === "pending");
  const active = items.filter((item) => item.status === "accepted" || item.status === "in_progress");
  const visible = useMemo(() => filter === "ALL" ? items : filter === "NEW" ? pending : active, [filter, items, pending.length, active.length]);
  const open = (item: HomeGarageBooking) => router.push({ pathname: "/(homegarage)/repair-request-detail", params: { bookingId: item.id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}>
        <View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View>
        <TouchableOpacity style={s.homeButton} accessibilityRole="button" accessibilityLabel="Home dashboard" onPress={() => router.replace("/(homegarage)")}><Feather name="home" size={21} color="#FFFFFF" /></TouchableOpacity>
      </View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>


      <ImageBackground source={require("../../assets/images/homegarage-motorcycle-sapphire.png")} imageStyle={s.summaryImage} style={s.summary}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}>
          <View style={s.summaryEyebrow}><Feather name="tool" size={13} color="#FFFFFF" /><Text style={s.summaryEyebrowText}>HOME GARAGE WORKSPACE</Text></View>
          <Text style={s.summaryTitle}>Requests</Text>
          <Text style={s.summaryHint}>Review and manage customer repair requests</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{"\n"}requests</Text></View>
      </ImageBackground>

      <View style={s.sectionIntro}>
        <View><Text style={s.sectionTitle}>Your workload</Text><Text style={s.sectionHint}>Stay on top of every customer</Text></View>
        <View style={s.totalPill}><Feather name="activity" size={14} color="#FFFFFF" /><Text style={s.totalText}>{pending.length + active.length} open</Text></View>
      </View>

      <View style={s.filters}>{FILTERS.map(([key, label]) => <FilterButton key={key} label={label} count={key === "ALL" ? items.length : key === "NEW" ? pending.length : active.length} active={filter === key} onPress={() => setFilter(key)} />)}</View>

      {loading ? <View style={s.empty}><ActivityIndicator color={C.primary} /><Text style={s.emptyTitle}>Loading requests…</Text></View>
        : error ? <View style={s.empty}><Feather name="alert-circle" size={28} color={C.primary} /><Text style={s.emptyTitle}>{error}</Text><TouchableOpacity style={s.retry} onPress={() => setAttempt((value) => value + 1)}><Text style={s.retryText}>Try Again</Text></TouchableOpacity></View>
          : visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="inbox" size={28} color={C.muted} /></View><Text style={s.emptyTitle}>No {filter === "ALL" ? "service" : filter.toLowerCase()} requests</Text><Text style={s.emptyText}>Customer repair requests will appear here.</Text></View>
            : visible.map((item) => <View key={item.id} style={s.card}>
              <View style={s.customerRow}>
                <View style={s.avatar}><Feather name="user" size={21} color={C.text} /></View>
                <View style={s.customerCopy}><Text style={s.customer} numberOfLines={1}>{item.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicleYear} {item.vehicle}{item.vehiclePlate ? ` · ${item.vehiclePlate}` : ""}</Text></View>
                <View style={[s.status, item.status === "pending" ? s.pendingStatus : item.status === "completed" || item.status === "in_progress" ? s.completedStatus : null]}><Text style={[s.statusText, item.status === "pending" ? s.pendingText : item.status === "completed" || item.status === "in_progress" ? s.completedText : null]}>{statusLabel(item.status)}</Text></View>
              </View>
              <View style={s.detail}><View style={s.detailLabel}><Feather name="map-pin" size={17} color={C.primary} /><Text style={s.detailCaption}>Service area</Text></View><Text style={s.detailValue} numberOfLines={1}>{item.serviceAreaLabel || "Home Garage service"}</Text></View>
              <View style={s.detail}><View style={s.detailLabel}><Feather name="message-square" size={17} color={C.muted} /><Text style={s.detailCaption}>Repair needed</Text></View><Text style={s.problem} numberOfLines={2}>{item.problem}</Text></View>
              <View style={s.detail}><View style={s.detailLabel}><Feather name="clock" size={17} color={C.muted} /><Text style={s.detailCaption}>Timing</Text></View><Text style={s.detailValue}>{formatBookingTimingLabel(item)}</Text></View>
              <TouchableOpacity style={s.viewButton} onPress={() => open(item)} activeOpacity={0.82}><Text style={s.viewButtonText}>{item.status === "pending" ? "Review Request" : "View Request"}</Text><Feather name="chevron-right" size={20} color="#FFFFFF" /></TouchableOpacity>
            </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function statusLabel(status: HomeGarageBooking["status"]) {
  if (status === "pending") return "New";
  if (status === "accepted") return "Accepted";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Declined";
}

function FilterButton({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[s.filterButton, active && s.filterButtonActive]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}>
    <View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={label === "All" ? "list" : label === "New" ? "clipboard" : "tool"} size={20} color={active ? "#FFFFFF" : C.muted} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View>
    <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text>
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, content: { paddingHorizontal: 16, paddingTop: 8 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: C.primary }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" }, brandRed: { color: "#FFFFFF" }, homeButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 138, borderRadius: 20, backgroundColor: C.primaryDark, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16, overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, summaryImage: { borderRadius: 20, opacity: 0.9 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, summaryCopy: { flex: 1, minWidth: 0 }, summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: "#EAF2FF", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 31, fontWeight: "800" }, summaryHint: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, marginTop: 4 }, summaryDivider: { width: 1, height: 66, backgroundColor: "rgba(255,255,255,0.34)", marginHorizontal: 16 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" }, countLabel: { color: "#EAF2FF", fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 9, paddingHorizontal: 0 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, sectionHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 3 }, totalPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 }, totalText: { color: C.primary, fontSize: 12, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 10, marginBottom: 12 }, filterButton: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border, borderRadius: 14 }, filterIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: {}, filterDot: { position: "absolute", top: -1, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 14, lineHeight: 20, fontWeight: "600" }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  card: { borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }, avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1, minWidth: 0 }, customer: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#FFF4E5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, pendingStatus: { backgroundColor: "#FFF4E5" }, completedStatus: { backgroundColor: "#EAF6EE" }, statusText: { color: "#9A5B00", fontSize: 11, lineHeight: 15, fontWeight: "800" }, pendingText: { color: "#9A5B00" }, completedText: { color: "#166534" },
  detail: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 13, marginTop: 12 }, detailLabel: { flexDirection: "row", alignItems: "center", gap: 8 }, detailCaption: { color: C.muted, fontSize: 13, lineHeight: 18 }, detailValue: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 4 }, problem: { color: C.text, fontSize: 15, lineHeight: 21, marginLeft: 25, marginTop: 4 }, viewButton: { minHeight: 54, borderRadius: 14, backgroundColor: C.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13 }, viewButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  empty: { minHeight: 250, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 25, gap: 12, ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 }, retryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },filterButtonActive: { backgroundColor: C.primary, borderColor: C.primary }});
