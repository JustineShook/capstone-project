import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToProviderParkingBookings } from "../../services/parkingBookingService";
import type { ParkingBooking } from "../../types/parkingBooking";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#303135" };
type Filter = "PENDING" | "ACTIVE";
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

export default function ParkingBookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  useEffect(() => subscribeToProviderParkingBookings(setBookings, () => undefined), []);

  const pending = useMemo(() => bookings.filter((item) => item.status === "reserved"), [bookings]);
  const active = useMemo(() => bookings.filter((item) => item.status === "active"), [bookings]);
  const visible = filter === "PENDING" ? pending : active;
  const open = (id: string) => router.push({ pathname: "/(homegarage)/parking-session-detail", params: { bookingId: id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      <Header onBell={() => router.push("/(homegarage)/history")} />
      <View style={s.summary}><View style={s.summaryCopy}><Text style={s.summaryTitle}>Bookings</Text><Text style={s.summaryHint}>Manage parking reservations and active sessions</Text></View><View style={s.summaryDivider} /><View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{"\n"}bookings</Text></View></View>
      <View style={s.filters}><FilterButton icon="calendar" label="Pending" count={pending.length} active={filter === "PENDING"} onPress={() => setFilter("PENDING")} /><FilterButton icon="navigation" label="Active" count={active.length} active={filter === "ACTIVE"} onPress={() => setFilter("ACTIVE")} /></View>
      {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name={filter === "PENDING" ? "calendar" : "navigation"} size={28} color={C.muted} /></View><Text style={s.emptyTitle}>{filter === "PENDING" ? "No pending bookings" : "No active parking"}</Text><Text style={s.emptyText}>{filter === "PENDING" ? "New customer reservations will appear here." : "Vehicles currently using your spaces will appear here."}</Text></View> : visible.map((booking) => <View key={booking.id} style={s.card}>
        <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={19} color="#FFFFFF" /></View><View style={s.customerCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}</Text></View><View style={[s.status, booking.status === "active" && s.activeStatus]}><Text style={[s.statusText, booking.status === "active" && s.activeStatusText]}>{booking.status === "active" ? "Parking" : "Reserved"}</Text></View></View>
        <View style={s.infoGrid}><View style={s.infoCell}><View style={s.infoHeading}><Feather name="grid" size={16} color={C.red} /><Text style={s.infoLabel}>Parking slot</Text></View><Text style={s.infoValue}>#{String(booking.slotNumber).padStart(2, "0")}</Text></View><View style={s.infoCell}><View style={s.infoHeading}><Feather name="truck" size={16} color="#D1D2D4" /><Text style={s.infoLabel}>Vehicle type</Text></View><Text style={s.infoValue} numberOfLines={1}>{booking.vehicleType || "Not provided"}</Text></View></View>
        <View style={s.details}><Detail icon="calendar" text={dateLabel(booking.bookedAt)} />{booking.notes?.trim() ? <Detail icon="message-square" text={booking.notes} /> : null}{booking.parkingStartedAt ? <Detail icon="clock" text={`Started ${dateLabel(booking.parkingStartedAt)}`} /> : null}</View>
        <TouchableOpacity style={s.viewButton} onPress={() => open(booking.id)} activeOpacity={0.82}><Text style={s.viewButtonText}>View Booking</Text><Feather name="chevron-right" size={19} color="#FFFFFF" /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function Header({ onBell }: { onBell: () => void }) { return <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="History" onPress={onBell}><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>; }
function FilterButton({ icon, label, count, active, onPress }: { icon: "calendar" | "navigation"; label: string; count: number; active: boolean; onPress: () => void }) { return <TouchableOpacity style={s.filterButton} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}><View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={icon} size={20} color={active ? "#FFFFFF" : C.muted} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View><Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text><View style={[s.filterUnderline, active && s.filterUnderlineActive]} /></TouchableOpacity>; }
function Detail({ icon, text }: { icon: "calendar" | "message-square" | "clock"; text: string }) { return <View style={s.detailRow}><Feather name={icon} size={15} color="#D3D4D6" /><Text style={s.detailText} numberOfLines={2}>{text}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 122, borderRadius: 17, backgroundColor: C.red, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16 }, summaryCopy: { flex: 1 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 32, fontWeight: "800" }, summaryHint: { color: "#F7EFED", fontSize: 13, lineHeight: 19, marginTop: 4 }, summaryDivider: { width: 1, height: 66, backgroundColor: "rgba(255,255,255,0.5)", marginHorizontal: 17 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#F7EFED", fontSize: 30, lineHeight: 36, fontWeight: "800" }, countLabel: { color: "#F7EFED", fontSize: 12, lineHeight: 17, textAlign: "center" },
  filters: { minHeight: 108, flexDirection: "row", justifyContent: "center", gap: 48, marginBottom: 10 }, filterButton: { width: 88, minHeight: 100, alignItems: "center", paddingTop: 11 }, filterIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#191A1D", borderWidth: 1, borderColor: "#36373A", alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: { backgroundColor: C.red, borderColor: C.red }, filterDot: { position: "absolute", top: 1, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 5 }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" }, filterUnderline: { height: 3, width: 46, backgroundColor: "transparent", marginTop: 3 }, filterUnderlineActive: { backgroundColor: C.red },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#424347", alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#F4D28A", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }, statusText: { color: "#292316", fontSize: 12, lineHeight: 16, fontWeight: "800" }, activeStatus: { backgroundColor: "#147A4A" }, activeStatusText: { color: "#FFFFFF" },
  infoGrid: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#292A2D", marginTop: 12, paddingTop: 13 }, infoCell: { flex: 1, paddingHorizontal: 4 }, infoHeading: { flexDirection: "row", alignItems: "center", gap: 7 }, infoLabel: { color: C.muted, fontSize: 12, lineHeight: 18 }, infoValue: { color: C.text, fontSize: 14, lineHeight: 20, marginLeft: 23, marginTop: 4 }, details: { gap: 7, marginTop: 12 }, detailRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 9 }, detailText: { color: "#FFFFFF", fontSize: 13, lineHeight: 19, flex: 1 }, viewButton: { minHeight: 46, borderRadius: 10, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13 }, viewButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  empty: { minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 }, emptyIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 19, fontWeight: "700" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
