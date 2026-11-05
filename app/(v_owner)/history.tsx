import { StatusBar } from "react-native";
import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "../../services/firebase";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";
import { formatPesoAmount } from "../../utils/finalPrice";

type HistoryItem = { id: string; bookingType: "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage"; providerName: string; vehicle: string; vehiclePlate: string; status: string; problem?: string; towingType?: string; startingPrice: string; assessmentPrice?: number; finalPrice?: number; timingMode?: "now" | "scheduled"; urgency?: "standard" | "emergency"; scheduledAt?: Timestamp | string; createdAt?: Timestamp };
const C = { bg: homeColors.background, card: homeColors.surface, text: homeColors.textPrimary, muted: homeColors.textSecondary, border: homeColors.border, red: homeColors.primary, success: homeColors.success };
function historyPrice(item: HistoryItem) {
  const format = (price: number) => `₱${price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (item.bookingType === "homegarage" && item.status === "completed") return typeof item.finalPrice === "number" ? `Final ${format(item.finalPrice)}` : "Final price not recorded";
  if (item.bookingType === "homegarage" && item.assessmentPrice != null) return `Assessed ${format(item.assessmentPrice)}`;
  if (item.bookingType === "shop-owner" && item.status === "completed") return typeof item.finalPrice === "number" ? `Final ${formatPesoAmount(item.finalPrice)}` : "Final price not recorded";
  if (["onsite-mechanic", "towing-company"].includes(item.bookingType) && item.status === "completed") {
    return typeof item.finalPrice === "number" ? `Final ${formatPesoAmount(item.finalPrice)}` : "Final price not recorded";
  }
  return item.startingPrice;
}

function historyDate(item: HistoryItem): Date | null {
  const date = item.createdAt?.toDate();
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export function groupHistory(items: HistoryItem[], now = new Date()) {
  const groups: { key: string; title: string; items: HistoryItem[] }[] = [];
  // Group adjacent records only: the subscription's existing order stays intact.
  for (const item of items) {
    const date = historyDate(item);
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "unknown";
    const title = !date ? "Date unavailable"
      : date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
        ? "This month" : date.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, title, items: [item] });
  }
  return groups;
}

const SERVICE_VISUALS = {
  "onsite-mechanic": { icon: "construct-outline", color: "#0F52BA", background: "#EFF6FF" },
  "towing-company": { icon: "car-outline", color: "#854D0E", background: "#FEF9C3" },
  "shop-owner": { icon: "storefront-outline", color: "#6B21A8", background: "#FAF5FF" },
  homegarage: { icon: "home-outline", color: "#166534", background: "#F0FDF4" },
} as const;

function statusColors(status: string) {
  if (status === "completed") return { color: homeColors.success, background: homeColors.successLight };
  if (status === "cancelled" || status === "rejected") return { color: homeColors.busy, background: homeColors.busyLight };
  if (status === "pending") return { color: "#854D0E", background: "#FEF9C3" };
  return { color: homeColors.primary, background: "#EFF6FF" };
}

function priceLabel(item: HistoryItem): string {
  const price = historyPrice(item);
  if (item.status === "completed" || (item.bookingType === "homegarage" && item.assessmentPrice != null)) return price;
  return price ? `Starting / estimated: ${price}` : "Starting / estimated price unavailable";
}

export default function HistoryScreen() {
  const router = useRouter(); const [items, setItems] = useState<HistoryItem[]>([]); const [loading, setLoading] = useState(true);
  const returnToHome = useCallback(() => router.replace("/(v_owner)"), [router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      returnToHome();
      return true;
    });
    return () => subscription.remove();
  }, [returnToHome]));
  useEffect(() => { const uid = auth.currentUser?.uid; if (!uid) { setLoading(false); return; } return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", uid)), (snapshot) => { setItems(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as HistoryItem)).filter((item) => ["onsite-mechanic", "towing-company", "shop-owner", "homegarage"].includes(item.bookingType)).sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0))); setLoading(false); }, () => setLoading(false)); }, []);
  const grouped = useMemo(() => groupHistory(items), [items]);
  const openDetails = (item: HistoryItem) => router.push({ pathname: item.bookingType === "homegarage" ? "/(v_owner)/homegarage-booking/booking-detail" : item.bookingType === "towing-company" ? "/(v_owner)/towing-booking/booking-detail" : item.bookingType === "shop-owner" ? "/(v_owner)/shop-booking/booking-detail" : "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: item.id } });
  const kind = (item: HistoryItem) => item.bookingType === "homegarage" ? "HOME GARAGE REPAIR" : item.bookingType === "towing-company" ? "TOWING" : item.bookingType === "shop-owner" ? "AUTO SHOP" : "INDIE MECHANIC";
  return (
    <SafeAreaView style={s.safe} edges={["left", "right"]}>
      <SafeAreaView style={[s.header, { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 0, paddingVertical: 0 }]} edges={["top"]}><StatusBar barStyle="light-content" backgroundColor="#0F52BA" /><View style={[s.headerRow, { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, height: undefined }]}>
        <Pressable onPress={returnToHome} accessibilityRole="button" accessibilityLabel="Back to home" style={[s.backButton, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }]}><Ionicons name="chevron-back" size={23} color={"#FFFFFF"} /></Pressable>
        <View style={s.headerCopy}><Text style={[s.title, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>History</Text><Text style={[s.subtitle, { color: "#FFFFFF" }]}>All vehicle service requests</Text></View>
      </View></SafeAreaView>
      <ScrollView style={s.contentSurface} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color={C.red} style={{ marginTop: 56 }} /> : grouped.length === 0 ? (
          <View style={s.empty}><Ionicons name="time-outline" size={38} color={C.muted} /><Text style={s.emptyTitle}>No history yet</Text><Text style={s.muted}>Your towing, mechanic, and auto-shop requests will appear here.</Text></View>
        ) : grouped.map((group, groupIndex) => (
          <View key={group.key + "-" + groupIndex} style={s.group}>
            <Text style={s.groupTitle} accessibilityRole="header">{group.title}</Text>
            {group.items.map((item) => {
              const visual = SERVICE_VISUALS[item.bookingType];
              const badge = statusColors(item.status);
              return <Pressable key={item.id} style={s.card} onPress={() => openDetails(item)} accessibilityRole="button">
                <View style={s.top}>
                  <View style={s.serviceIcon}><Ionicons name={visual.icon} size={22} color={homeColors.white} /></View>
                  <View style={s.cardHeading}><Text style={s.provider}>{item.providerName}</Text><Text style={s.type}>{kind(item)}</Text></View>
                </View>
                <View style={s.cardBody}>
                <View style={s.summaryRow}>
                  <View style={[s.statusBadge, { backgroundColor: badge.background }]}><Text style={[s.status, { color: badge.color }]}>{item.status.replace(/_/g, " ")}</Text></View>
                  <Text style={s.date}>{historyDate(item)?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) || "Date unavailable"}</Text>
                </View>
                <View style={s.vehicleRow}><Ionicons name="car-sport-outline" size={15} color={C.muted} /><Text style={s.vehicle}>{item.vehicle} ? {item.vehiclePlate}</Text></View>
                <Text style={s.detail}>{item.problem || item.towingType || "Service request"}</Text>
                <Text style={s.timing}>{formatBookingTimingLabel(item)}</Text>
                <View style={s.bottom}>
                  <Text style={s.price}>{priceLabel(item)}</Text>
                  <View style={s.detailsCue}><Text style={s.detailsText}>View details</Text><Ionicons name="chevron-forward" size={16} color={C.red} /></View>
                </View>
                </View>
              </Pressable>;
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F52BA" },
  contentSurface: { flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  headerRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: homeColors.surfaceAlt },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 24, fontWeight: "700", lineHeight: 30 },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 19 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },
  group: { gap: 12 },
  groupTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: homeColors.primary, padding: 12 },
  cardBody: { padding: 12 },
  serviceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  cardHeading: { flex: 1, minWidth: 0 },
  provider: { color: homeColors.white, fontSize: 18, fontWeight: "700", lineHeight: 25 },
  type: { color: homeColors.white, fontSize: 13, lineHeight: 19, fontWeight: "500", marginTop: 2 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: "100%" },
  status: { fontSize: 13, textTransform: "capitalize", lineHeight: 19, fontWeight: "500" },
  date: { color: C.muted, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  vehicleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12 },
  vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, flex: 1 },
  detail: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 6 },
  timing: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  bottom: { borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 10 },
  price: { color: C.text, fontSize: 15, fontWeight: "600", lineHeight: 22, flexShrink: 1 },
  detailsCue: { flexDirection: "row", alignItems: "center", gap: 3 },
  detailsText: { color: C.red, fontSize: 13, fontWeight: "500", lineHeight: 19 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", lineHeight: 25 },
  muted: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
