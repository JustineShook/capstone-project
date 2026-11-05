import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";

const COLORS = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", primary: "#0F52BA", border: "#D5DEE9", subtle: "#F1F5F9", shadow: "#172B4D" };
type Period = "WEEK" | "MONTH" | "ALL";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }

export default function TowingEarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("WEEK");
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);
  useEffect(() => subscribeToTowingRequests(setBookings), []);

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

  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
    <View style={styles.header}><Text style={[styles.title,{color:"#FFFFFF",marginTop:0}]}>Earnings</Text></View>
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>

      <View style={styles.filters}>{([["WEEK", "This Week"], ["MONTH", "This Month"], ["ALL", "All Time"]] as [Period, string][]).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setPeriod(key)} style={[styles.filter, period === key && styles.filterActive]}><Text style={[styles.filterText, period === key && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={styles.totalCard}><Text style={styles.total}>{peso(total)}</Text><Text style={styles.totalLabel}>Total Earnings</Text><View style={styles.totalIcon}><Feather name="trending-up" size={20} color="#fff" /></View></View>
      <View style={styles.summaryRow}><Metric icon="truck" value={String(transactions.length)} label="Completed Tows" /><Metric icon="dollar-sign" value={peso(average)} label="Average per Tow" /></View>
      <View style={styles.chartCard}><View style={styles.chartHeader}><Text style={styles.chartTitle}>Earnings Overview</Text><Text style={styles.chartNote}>This week</Text></View><View style={styles.chart}>{weeklyBars.map((value, index) => <View key={DAYS[index]} style={styles.barItem}><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(value ? 16 : 4, (value / maximum) * 100)}%` }]} /></View><Text style={styles.day}>{DAYS[index]}</Text></View>)}</View></View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Transactions</Text><Text style={styles.sectionNote}>{transactions.length} completed</Text></View>
      {transactions.length === 0 ? <View style={styles.empty}><Feather name="credit-card" size={30} color={COLORS.muted} /><Text style={styles.emptyText}>Completed towing jobs will appear here.</Text></View> : transactions.slice(0, 12).map((item) => <TouchableOpacity key={item.id} style={styles.transaction} activeOpacity={0.75} onPress={() => router.push({ pathname: "/(towing-company)/request-details", params: { id: item.id } })}><View style={styles.transactionTop}><View style={styles.vehicleIcon}><Feather name="truck" size={18} color={COLORS.text} /></View><View style={styles.transactionInfo}><Text style={styles.transactionTitle}>{item.vehicle}</Text><Text style={styles.transactionDate}>{new Date(item.completedAt || item.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text></View><Feather name="chevron-right" size={21} color={COLORS.muted} /></View><View style={styles.transactionBottom}><Text style={styles.transactionLabel}>Final Price</Text><Text style={styles.transactionAmount}>{typeof item.finalPrice === "number" ? peso(item.finalPrice) : "Final price not recorded"}</Text></View></TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: string; label: string }) { return <View style={styles.metric}><Feather name={icon} size={17} color={COLORS.muted} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  header: { backgroundColor: COLORS.primary, minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 15 },
  scroll: { flex: 1, backgroundColor: COLORS.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  safeArea: { flex: 1, backgroundColor: COLORS.primary }, content: { paddingHorizontal: 16, paddingTop: 8 }, title: { color: COLORS.text, fontSize: 24, lineHeight: 31, fontWeight: "700", marginTop: 3 },
  filters: { flexDirection: "row", gap: 8, marginTop: 16 }, filter: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: COLORS.subtle, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 4 }, filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, filterText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" }, filterTextActive: { color: "#FFFFFF" },
  totalCard: { minHeight: 122, marginTop: 14, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, justifyContent: "center", paddingHorizontal: 18, paddingRight: 76, position: "relative", shadowColor: COLORS.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, total: { color: COLORS.text, fontSize: 29, lineHeight: 36, fontWeight: "700" }, totalLabel: { color: COLORS.muted, fontSize: 14, marginTop: 4 }, totalIcon: { position: "absolute", right: 18, top: 22, height: 46, width: 46, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 10 }, metric: { flex: 1, minHeight: 94, backgroundColor: COLORS.card, borderRadius: 20, padding: 14, justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }, metricValue: { color: COLORS.text, fontSize: 19, lineHeight: 25, fontWeight: "700", marginTop: 8 }, metricLabel: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  chartCard: { marginTop: 17, backgroundColor: COLORS.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border }, chartHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, chartTitle: { color: COLORS.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, chartNote: { color: COLORS.muted, fontSize: 13 }, chart: { height: 150, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }, barItem: { width: "12%", height: "100%", alignItems: "center", justifyContent: "flex-end" }, barTrack: { height: 120, width: 18, backgroundColor: COLORS.subtle, borderRadius: 7, justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 7 }, day: { color: COLORS.muted, fontSize: 10, marginTop: 6 },
  sectionHeader: { marginTop: 23, marginBottom: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, sectionTitle: { color: COLORS.text, fontSize: 19, lineHeight: 26, fontWeight: "700" }, sectionNote: { color: COLORS.muted, fontSize: 13 }, transaction: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 11, borderWidth: 1, borderColor: COLORS.border }, transactionTop: { flexDirection: "row", alignItems: "center" }, vehicleIcon: { height: 44, width: 44, borderRadius: 15, backgroundColor: COLORS.subtle, justifyContent: "center", alignItems: "center" }, transactionInfo: { marginLeft: 12, flex: 1, minWidth: 0 }, transactionTitle: { color: COLORS.text, fontSize: 16, lineHeight: 22, fontWeight: "700", flexShrink: 1 }, transactionDate: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, transactionBottom: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }, transactionLabel: { color: COLORS.muted, fontSize: 13, lineHeight: 19, flex: 1 }, transactionAmount: { color: COLORS.text, fontSize: 15, lineHeight: 21, fontWeight: "700", flexShrink: 1, textAlign: "right" }, empty: { minHeight: 120, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 10 }, emptyText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
