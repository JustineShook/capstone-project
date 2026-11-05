import { Feather } from "@expo/vector-icons";
import { MechanicNotificationBell } from "../../components/onsite-mechanic/MechanicNotificationBell";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToMechanicRequests } from "../../services/owner/bookingService";
import type { BookingRequest } from "../../types/owner/booking";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", primary: "#0F52BA", border: "#D5DEE9", subtle: "#F1F5F9", shadow: "#172B4D" };
type Period = "WEEK" | "MONTH" | "ALL";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }

export default function MechanicEarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("WEEK");
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  useEffect(() => subscribeToMechanicRequests(setBookings), []);

  const completed = useMemo(() => bookings.filter((item) => item.status === "completed"), [bookings]);
  const transactions = useMemo(() => {
    if (period === "ALL") return completed;
    const start = new Date();
    start.setDate(start.getDate() - (period === "WEEK" ? 6 : 29));
    start.setHours(0, 0, 0, 0);
    return completed.filter((item) => new Date(item.completedAt || item.updatedAt) >= start);
  }, [completed, period]);
  const pricedTransactions = transactions.filter((item) => typeof item.finalPrice === "number");
  const total = pricedTransactions.reduce((sum, item) => sum + item.finalPrice!, 0);
  const average = pricedTransactions.length ? total / pricedTransactions.length : 0;
  const weeklyBars = useMemo(() => DAYS.map((_, day) => {
    const target = new Date();
    target.setDate(target.getDate() - ((target.getDay() + 6) % 7) + day);
    return completed.filter((item) => new Date(item.completedAt || item.updatedAt).toDateString() === target.toDateString()).reduce((sum, item) => sum + (typeof item.finalPrice === "number" ? item.finalPrice : 0), 0);
  }), [completed]);
  const maximum = Math.max(...weeklyBars, 1);

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><MechanicNotificationBell style={s.bell} size={21} color="#FFFFFF" /></View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Earnings</Text>
      <View style={s.filters}>{([ ["WEEK", "This Week"], ["MONTH", "This Month"], ["ALL", "All Time"] ] as [Period, string][]).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setPeriod(key)} style={[s.filter, period === key && s.filterActive]}><Text style={[s.filterText, period === key && s.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={s.totalCard}><Text style={s.total}>{peso(total)}</Text><Text style={s.totalLabel}>Total Earnings</Text><View style={s.totalIcon}><Feather name="trending-up" size={20} color="#FFFFFF" /></View></View>
      <View style={s.summaryRow}><Metric icon="tool" value={String(transactions.length)} label="Completed Jobs" /><Metric icon="dollar-sign" value={peso(average)} label="Average per Job" /></View>
      <View style={s.chartCard}><View style={s.chartHeader}><Text style={s.chartTitle}>Earnings Overview</Text><Text style={s.chartNote}>This week</Text></View><View style={s.chart}>{weeklyBars.map((value, index) => <View key={DAYS[index]} style={s.barItem}><View style={s.barTrack}><View style={[s.bar, { height: `${Math.max(value ? 16 : 4, (value / maximum) * 100)}%` }]} /></View><Text style={s.day}>{DAYS[index]}</Text></View>)}</View></View>
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Transactions</Text><Text style={s.sectionNote}>{transactions.length} completed</Text></View>
      {transactions.length === 0 ? <View style={s.empty}><Feather name="credit-card" size={30} color={C.muted} /><Text style={s.emptyText}>Completed mechanic jobs will appear here.</Text></View> : transactions.slice(0, 12).map((item) => <TouchableOpacity key={item.id} style={s.transaction} activeOpacity={0.75} onPress={() => router.push({ pathname: "/(onsite-mechanic)/request-details", params: { id: item.id } })}>
        <View style={s.transactionTop}><View style={s.vehicleIcon}><Feather name="tool" size={18} color={C.primary} /></View><View style={s.transactionInfo}><Text style={s.transactionTitle}>{item.vehicle}</Text><Text style={s.transactionDate}>{new Date(item.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></View>
        <View style={s.transactionBottom}><Text style={s.transactionLabel}>{item.problem || "Mechanic service"}</Text><Text style={s.transactionAmount}>{typeof item.finalPrice === "number" ? peso(item.finalPrice) : "Final price not recorded"}</Text></View>
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: string; label: string }) { return <View style={s.metric}><Feather name={icon} size={17} color={C.muted} /><Text style={s.metricValue} numberOfLines={1}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, content: { paddingHorizontal: 16, paddingTop: 8 },
  header: { backgroundColor: C.primary, minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 15 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.4 }, bell: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, title: { color: C.text, fontSize: 24, lineHeight: 31, fontWeight: "700", marginTop: 3 },
  filters: { flexDirection: "row", gap: 8, marginTop: 16 }, filter: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border, paddingHorizontal: 4 }, filterActive: { backgroundColor: C.primary, borderColor: C.primary }, filterText: { color: C.muted, fontSize: 12, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF" }, totalCard: { minHeight: 122, marginTop: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 18, paddingRight: 76, position: "relative", shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, total: { color: C.text, fontSize: 29, lineHeight: 36, fontWeight: "700" }, totalLabel: { color: C.muted, fontSize: 14, marginTop: 4 }, totalIcon: { position: "absolute", right: 18, top: 22, height: 46, width: 46, borderRadius: 16, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 10 }, metric: { flex: 1, minHeight: 94, backgroundColor: C.card, borderRadius: 20, padding: 14, justifyContent: "center", borderWidth: 1, borderColor: C.border }, metricValue: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: "700", marginTop: 8 }, metricLabel: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 3 }, chartCard: { marginTop: 17, backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border }, chartHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, chartTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, chartNote: { color: C.muted, fontSize: 13 }, chart: { height: 150, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }, barItem: { width: "12%", height: "100%", alignItems: "center", justifyContent: "flex-end" }, barTrack: { height: 120, width: 18, backgroundColor: C.subtle, borderRadius: 7, justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", backgroundColor: C.primary, borderRadius: 7 }, day: { color: C.muted, fontSize: 10, marginTop: 6 },
  sectionHeader: { marginTop: 23, marginBottom: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, sectionTitle: { color: C.text, fontSize: 19, lineHeight: 26, fontWeight: "700" }, sectionNote: { color: C.muted, fontSize: 13 }, transaction: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 11, borderWidth: 1, borderColor: C.border }, transactionTop: { flexDirection: "row", alignItems: "center" }, vehicleIcon: { height: 44, width: 44, borderRadius: 15, backgroundColor: C.subtle, justifyContent: "center", alignItems: "center" }, transactionInfo: { marginLeft: 12, flex: 1, minWidth: 0 }, transactionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700", flexShrink: 1 }, transactionDate: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, transactionBottom: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }, transactionLabel: { color: C.muted, fontSize: 13, lineHeight: 19, flex: 1 }, transactionAmount: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700", flexShrink: 1, textAlign: "right" }, empty: { minHeight: 120, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 10 }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
