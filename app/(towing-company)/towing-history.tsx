import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";

const COLORS = { canvas: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", red: "#F51F3B", bar: "#D9233C" };
type Period = "WEEK" | "MONTH" | "ALL";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function amount(value: string) { return Number(value.replace(/[^\d.]/g, "")) || 0; }
function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value); }

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

  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.canvas} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Earnings</Text>
      <View style={styles.filters}>{([["WEEK", "This Week"], ["MONTH", "This Month"], ["ALL", "All Time"]] as [Period, string][]).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setPeriod(key)} style={[styles.filter, period === key && styles.filterActive]}><Text style={[styles.filterText, period === key && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={styles.totalCard}><Text style={styles.total}>{peso(total)}</Text><Text style={styles.totalLabel}>Total Earnings</Text><View style={styles.totalIcon}><Feather name="trending-up" size={20} color="#fff" /></View></View>
      <View style={styles.summaryRow}><Metric icon="truck" value={String(transactions.length)} label="Completed Tows" /><Metric icon="dollar-sign" value={peso(average)} label="Average per Tow" /></View>
      <View style={styles.chartCard}><View style={styles.chartHeader}><Text style={styles.chartTitle}>Earnings Overview</Text><Text style={styles.chartNote}>This week</Text></View><View style={styles.chart}>{weeklyBars.map((value, index) => <View key={DAYS[index]} style={styles.barItem}><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(value ? 16 : 4, (value / maximum) * 100)}%` }]} /></View><Text style={styles.day}>{DAYS[index]}</Text></View>)}</View></View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Transactions</Text><Text style={styles.sectionNote}>{transactions.length} completed</Text></View>
      {transactions.length === 0 ? <View style={styles.empty}><Feather name="credit-card" size={30} color={COLORS.muted} /><Text style={styles.emptyText}>Completed towing jobs will appear here.</Text></View> : transactions.slice(0, 12).map((item) => <TouchableOpacity key={item.id} style={styles.transaction} activeOpacity={0.75} onPress={() => router.push({ pathname: "/(towing-company)/request-details", params: { id: item.id } })}><View style={styles.transactionTop}><View style={styles.vehicleIcon}><Feather name="truck" size={18} color={COLORS.text} /></View><View style={styles.transactionInfo}><Text style={styles.transactionTitle}>{item.vehicle}</Text><Text style={styles.transactionDate}>{new Date(item.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</Text></View><Feather name="chevron-right" size={21} color={COLORS.muted} /></View><View style={styles.transactionBottom}><Text style={styles.transactionLabel}>Service amount</Text><Text style={styles.transactionAmount}>{item.startingPrice}</Text></View></TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: string; label: string }) { return <View style={styles.metric}><Feather name={icon} size={17} color={COLORS.muted} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas }, content: { padding: 16 }, title: { color: COLORS.text, fontSize: 24, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, marginTop: 18 }, filter: { flex: 1, minHeight: 42, justifyContent: "center", alignItems: "center", borderRadius: 7, backgroundColor: COLORS.card }, filterActive: { backgroundColor: COLORS.red }, filterText: { color: COLORS.muted, fontSize: 13, fontWeight: "700" }, filterTextActive: { color: "#fff" },
  totalCard: { height: 122, marginTop: 14, borderRadius: 11, backgroundColor: COLORS.card, justifyContent: "center", paddingHorizontal: 16, position: "relative" }, total: { color: COLORS.text, fontSize: 30, fontWeight: "700" }, totalLabel: { color: COLORS.muted, fontSize: 14, marginTop: 4 }, totalIcon: { position: "absolute", right: 18, top: 22, height: 43, width: 43, borderRadius: 22, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 10, marginTop: 10 }, metric: { flex: 1, minHeight: 94, backgroundColor: COLORS.card, borderRadius: 10, padding: 13 }, metricValue: { color: COLORS.text, fontSize: 20, fontWeight: "700", marginTop: 8 }, metricLabel: { color: COLORS.muted, fontSize: 13, marginTop: 3 },
  chartCard: { marginTop: 18, backgroundColor: COLORS.card, borderRadius: 10, padding: 15 }, chartHeader: { flexDirection: "row", justifyContent: "space-between" }, chartTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" }, chartNote: { color: COLORS.muted, fontSize: 13 }, chart: { height: 150, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }, barItem: { width: "12%", height: "100%", alignItems: "center", justifyContent: "flex-end" }, barTrack: { height: 120, width: 18, backgroundColor: "#202B32", borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", backgroundColor: COLORS.bar, borderRadius: 4 }, day: { color: COLORS.muted, fontSize: 10, marginTop: 6 },
  sectionHeader: { marginTop: 24, marginBottom: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: "700" }, sectionNote: { color: COLORS.muted, fontSize: 13 }, transaction: { backgroundColor: COLORS.card, borderRadius: 10, padding: 15, marginBottom: 11 }, transactionTop: { flexDirection: "row", alignItems: "center" }, vehicleIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: "#303C44", justifyContent: "center", alignItems: "center" }, transactionInfo: { marginLeft: 12, flex: 1 }, transactionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" }, transactionDate: { color: COLORS.muted, fontSize: 13, marginTop: 4 }, transactionBottom: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#354249", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, transactionLabel: { color: COLORS.muted, fontSize: 13 }, transactionAmount: { color: COLORS.text, fontSize: 17, fontWeight: "700", textAlign: "right", flexShrink: 1, marginLeft: 12 }, empty: { alignItems: "center", paddingVertical: 40, gap: 10 }, emptyText: { color: COLORS.muted, fontSize: 15, textAlign: "center" },
});
