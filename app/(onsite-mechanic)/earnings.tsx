import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToMechanicRequests } from "../../services/owner/bookingService";
import type { BookingRequest } from "../../types/owner/booking";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", bar: "#E12B41" };
type Period = "WEEK" | "MONTH" | "ALL";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function amount(value: string) { return Number(value.replace(/[^\d.]/g, "")) || 0; }
function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value); }

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
    return completed.filter((item) => new Date(item.updatedAt) >= start);
  }, [completed, period]);
  const total = transactions.reduce((sum, item) => sum + amount(item.startingPrice), 0);
  const average = transactions.length ? total / transactions.length : 0;
  const weeklyBars = useMemo(() => DAYS.map((_, day) => {
    const target = new Date();
    target.setDate(target.getDate() - ((target.getDay() + 6) % 7) + day);
    return completed.filter((item) => new Date(item.updatedAt).toDateString() === target.toDateString()).reduce((sum, item) => sum + amount(item.startingPrice), 0);
  }), [completed]);
  const maximum = Math.max(...weeklyBars, 1);

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Notifications" onPress={() => router.push("/(onsite-mechanic)/requests")}><Feather name="bell" size={21} color={C.text} /></TouchableOpacity></View>
      <Text style={s.title}>Earnings</Text>
      <View style={s.filters}>{([ ["WEEK", "This Week"], ["MONTH", "This Month"], ["ALL", "All Time"] ] as [Period, string][]).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setPeriod(key)} style={[s.filter, period === key && s.filterActive]}><Text style={[s.filterText, period === key && s.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={s.totalCard}><Text style={s.total}>{peso(total)}</Text><Text style={s.totalLabel}>Total Earnings</Text><View style={s.totalIcon}><Feather name="trending-up" size={20} color="#FFFFFF" /></View></View>
      <View style={s.summaryRow}><Metric icon="tool" value={String(transactions.length)} label="Completed Jobs" /><Metric icon="dollar-sign" value={peso(average)} label="Average per Job" /></View>
      <View style={s.chartCard}><View style={s.chartHeader}><Text style={s.chartTitle}>Earnings Overview</Text><Text style={s.chartNote}>This week</Text></View><View style={s.chart}>{weeklyBars.map((value, index) => <View key={DAYS[index]} style={s.barItem}><View style={s.barTrack}><View style={[s.bar, { height: `${Math.max(value ? 16 : 4, (value / maximum) * 100)}%` }]} /></View><Text style={s.day}>{DAYS[index]}</Text></View>)}</View></View>
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Transactions</Text><Text style={s.sectionNote}>{transactions.length} completed</Text></View>
      {transactions.length === 0 ? <View style={s.empty}><Feather name="credit-card" size={30} color={C.muted} /><Text style={s.emptyText}>Completed mechanic jobs will appear here.</Text></View> : transactions.slice(0, 12).map((item) => <TouchableOpacity key={item.id} style={s.transaction} activeOpacity={0.75} onPress={() => router.push({ pathname: "/(onsite-mechanic)/request-details", params: { id: item.id } })}>
        <View style={s.transactionTop}><View style={s.vehicleIcon}><Feather name="tool" size={18} color={C.text} /></View><View style={s.transactionInfo}><Text style={s.transactionTitle} numberOfLines={1}>{item.vehicle}</Text><Text style={s.transactionDate}>{new Date(item.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></View>
        <View style={s.transactionBottom}><Text style={s.transactionLabel}>{item.problem || "Mechanic service"}</Text><Text style={s.transactionAmount}>{peso(amount(item.startingPrice))}</Text></View>
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: string; label: string }) { return <View style={s.metric}><Feather name={icon} size={17} color={C.muted} /><Text style={s.metricValue} numberOfLines={1}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }, title: { color: C.text, fontSize: 24, fontWeight: "700", marginTop: 3 },
  filters: { flexDirection: "row", gap: 8, marginTop: 16 }, filter: { flex: 1, minHeight: 42, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: C.card }, filterActive: { backgroundColor: C.red }, filterText: { color: C.muted, fontSize: 13, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF" }, totalCard: { minHeight: 122, marginTop: 14, borderRadius: 15, backgroundColor: C.card, justifyContent: "center", paddingHorizontal: 18, position: "relative" }, total: { color: C.text, fontSize: 29, fontWeight: "700" }, totalLabel: { color: C.muted, fontSize: 14, marginTop: 4 }, totalIcon: { position: "absolute", right: 18, top: 22, height: 46, width: 46, borderRadius: 23, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 10 }, metric: { flex: 1, minHeight: 94, backgroundColor: C.card, borderRadius: 12, padding: 13, justifyContent: "center" }, metricValue: { color: C.text, fontSize: 19, fontWeight: "700", marginTop: 8 }, metricLabel: { color: C.muted, fontSize: 13, marginTop: 3 }, chartCard: { marginTop: 17, backgroundColor: C.card, borderRadius: 13, padding: 15 }, chartHeader: { flexDirection: "row", justifyContent: "space-between" }, chartTitle: { color: C.text, fontSize: 16, fontWeight: "700" }, chartNote: { color: C.muted, fontSize: 13 }, chart: { height: 150, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }, barItem: { width: "12%", height: "100%", alignItems: "center", justifyContent: "flex-end" }, barTrack: { height: 120, width: 18, backgroundColor: "#292A2D", borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", backgroundColor: C.bar, borderRadius: 4 }, day: { color: C.muted, fontSize: 10, marginTop: 6 },
  sectionHeader: { marginTop: 23, marginBottom: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: C.text, fontSize: 19, fontWeight: "700" }, sectionNote: { color: C.muted, fontSize: 13 }, transaction: { backgroundColor: C.card, borderRadius: 13, padding: 15, marginBottom: 11 }, transactionTop: { flexDirection: "row", alignItems: "center" }, vehicleIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: "#303135", justifyContent: "center", alignItems: "center" }, transactionInfo: { marginLeft: 12, flex: 1 }, transactionTitle: { color: C.text, fontSize: 16, fontWeight: "700" }, transactionDate: { color: C.muted, fontSize: 13, marginTop: 4 }, transactionBottom: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#303135", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, transactionLabel: { color: C.muted, fontSize: 13, flex: 1 }, transactionAmount: { color: C.text, fontSize: 16, fontWeight: "700" }, empty: { minHeight: 120, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 10 }, emptyText: { color: C.muted, fontSize: 14, textAlign: "center" },
});
