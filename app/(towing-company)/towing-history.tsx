import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";
import { formatPesoAmount } from "../../utils/finalPrice";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", border: "#D5DEE9", primary: "#0F52BA", primaryDark: "#0B3D8A", subtle: "#F1F5F9", green: "#166534", shadow: "#000000" };
type HistoryFilter = "ALL" | "COMPLETED" | "CANCELLED" | "DECLINED";

function isCancelled(status: TowingBookingRequest["status"]) { return status === "cancelled"; }
function isDeclined(status: TowingBookingRequest["status"]) { return status === "rejected"; }
function statusLabel(status: TowingBookingRequest["status"]) { return status === "completed" ? "Completed" : status === "rejected" ? "Declined" : "Cancelled"; }
function historyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TowingHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [search, setSearch] = useState("");
  useEffect(() => subscribeToTowingRequests(setBookings), []);

  const history = useMemo(() => bookings.filter((booking) => booking.status === "completed" || isCancelled(booking.status) || isDeclined(booking.status)), [bookings]);
  const completedCount = history.filter((booking) => booking.status === "completed").length;
  const cancelledCount = history.filter((booking) => isCancelled(booking.status)).length;
  const declinedCount = history.filter((booking) => isDeclined(booking.status)).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((booking) => {
      const matchesFilter = filter === "ALL" || (filter === "COMPLETED" ? booking.status === "completed" : filter === "CANCELLED" ? isCancelled(booking.status) : isDeclined(booking.status));
      const matchesSearch = !query || `${booking.customerName} ${booking.vehicle} ${booking.pickupLocation} ${booking.destination}`.toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [history, filter, search]);

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/notifications")}><Feather name="bell" size={22} color="#FFFFFF" /></TouchableOpacity></View>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 22 }]} showsVerticalScrollIndicator={false}>


      <ImageBackground source={require("../../assets/images/towing-ready-sapphire.png")} imageStyle={s.summaryImage} style={s.summary}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}><View style={s.summaryEyebrow}><Feather name="clock" size={13} color={C.primary} /><Text style={s.summaryEyebrowText}>YOUR JOURNEY</Text></View><Text style={s.summaryTitle}>Service history</Text><Text style={s.summarySubtitle}>{completedCount} Completed  ·  {cancelledCount} Cancelled</Text></View>
      </ImageBackground>

      <View style={s.statsRow}><View style={s.statCard}><View style={s.statIconGreen}><Feather name="check" size={17} color="#76E0A4" /></View><Text style={s.statLabel}>Completed jobs</Text><Text style={s.statValue}>{completedCount}</Text></View><View style={s.statCardBlue}><View style={s.statIconBlue}><Feather name="x" size={17} color="#76C9FF" /></View><Text style={s.statLabel}>Cancelled jobs</Text><Text style={s.statValue}>{cancelledCount}</Text></View></View>

      <View style={s.searchBox}><Feather name="search" size={19} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search customer or vehicle" placeholderTextColor={C.muted} style={s.searchInput} returnKeyType="search" clearButtonMode="while-editing" /></View>

      <View style={s.historyHeading}><View><Text style={s.historyTitle}>Past jobs</Text><Text style={s.historyHint}>{completedCount} completed · {cancelledCount} cancelled · {declinedCount} declined</Text></View><View style={s.historyCount}><Text style={s.historyCountText}>{visible.length} records</Text></View></View>

      <View style={s.filters}>{(["ALL", "COMPLETED", "CANCELLED", "DECLINED"] as HistoryFilter[]).map((key) => <TouchableOpacity key={key} style={[s.filter, filter === key && s.filterActive]} onPress={() => setFilter(key)} activeOpacity={0.8}><Text style={[s.filterText, filter === key && s.filterTextActive]}>{key === "ALL" ? "All" : key === "COMPLETED" ? "Completed" : key === "CANCELLED" ? "Cancelled" : "Declined"}</Text></TouchableOpacity>)}</View>

      {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="clock" size={29} color={C.muted} /></View><Text style={s.emptyTitle}>{search ? "No matching history" : "No service history yet"}</Text><Text style={s.emptyText}>{search ? "Try another customer or vehicle name." : "Completed, cancelled, and declined towing jobs will appear here."}</Text></View> : visible.map((booking) => (
        <View key={booking.id} style={s.card}>
          <View style={s.cardHeader}><View style={s.person}><View style={s.avatar}><Feather name="user" size={20} color="#FFFFFF" /></View><View style={s.personCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle || "Vehicle not recorded"}{booking.vehicleYear ? ` · ${booking.vehicleYear}` : ""}</Text></View></View><View style={[s.status, booking.status === "completed" ? s.completed : s.cancelled]}><Text style={s.statusText}>{statusLabel(booking.status)}</Text></View></View>
          <View style={s.infoRow}><Feather name="calendar" size={18} color={C.muted} /><Text style={s.infoText}>{booking.status === "completed" && booking.completedAt ? `Completed · ${historyDate(booking.completedAt)}` : `Last updated · ${historyDate(booking.updatedAt || booking.createdAt)}`}</Text></View>
          <View style={s.infoRow}><Feather name="map-pin" size={18} color={C.primary} /><Text style={s.infoText} numberOfLines={2}>{booking.pickupLocation}</Text><Text style={s.routeLabel}>Pickup</Text></View>
          <View style={s.infoRow}><Feather name="flag" size={18} color={C.muted} /><Text style={s.infoText} numberOfLines={2}>{booking.destination}</Text><Text style={s.routeLabel}>Drop-off</Text></View>
          {booking.status === "completed" ? <View style={s.infoRow}><Feather name="dollar-sign" size={18} color={C.muted} /><Text style={s.infoText}>{typeof booking.finalPrice === "number" ? `Final Price · ${formatPesoAmount(booking.finalPrice)}` : "Final price not recorded"}</Text></View> : null}
          <TouchableOpacity style={s.detailsButton} onPress={() => router.push({ pathname: "/(towing-company)/request-details", params: { id: booking.id } })} activeOpacity={0.75}><Text style={s.detailsText}>View Details</Text><Feather name="chevron-right" size={18} color="#FFFFFF" /></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, content: { paddingHorizontal: 16, paddingTop: 8 },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: C.primary }, brandRow: { flexDirection: 'row', alignItems: 'center' }, mark: { color: '#FFFFFF', fontSize: 30, lineHeight: 35, fontWeight: '900', fontStyle: 'italic', marginRight: 5 }, brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, brandRed: { color: '#FFFFFF' }, bell: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  summary: { minHeight: 138, borderRadius: 20, backgroundColor: C.primaryDark, borderWidth: 1, borderColor: C.primaryDark, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 17, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, summaryImage: { borderRadius: 20, opacity: .9 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,61,138,0.42)' }, summaryCopy: { flex: 1, justifyContent: 'center', minWidth: 0 }, summaryEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: '#EAF2FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, summaryTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 31, fontWeight: '800' }, summarySubtitle: { color: '#EAF2FF', fontSize: 13, lineHeight: 19, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 }, statCard: { flex: 1, minHeight: 112, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, justifyContent: 'center', ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, statCardBlue: { flex: 1, minHeight: 112, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, justifyContent: 'center', ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, statIconGreen: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EAF6EE', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, statIconBlue: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, statLabel: { color: C.muted, fontSize: 12, lineHeight: 17 }, statValue: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: '800', marginTop: 2 },
  searchBox: { minHeight: 50, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, marginTop: 13 }, searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 14, paddingVertical: 9 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20, marginBottom: 5 }, historyTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }, historyHint: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, historyCount: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border }, historyCountText: { color: C.primary, fontSize: 11, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 13 }, filter: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 14, paddingHorizontal: 6, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border }, filterActive: { backgroundColor: C.primary, borderColor: C.primary }, filterText: { color: C.muted, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' }, filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  card: { borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, cardHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9 }, person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, avatar: { width: 46, height: 46, flexShrink: 0, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }, personCopy: { flex: 1, minWidth: 0 }, customerName: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, completed: { backgroundColor: '#EAF6EE' }, cancelled: { backgroundColor: '#FDECEF' }, statusText: { color: C.text, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  infoRow: { minHeight: 36, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 }, infoText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1, minWidth: 0 }, routeLabel: { color: C.muted, fontSize: 11 }, detailsButton: { minHeight: 54, borderRadius: 14, paddingHorizontal: 16, backgroundColor: C.primary, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, detailsText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  empty: { minHeight: 260, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 12, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },

scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
});
