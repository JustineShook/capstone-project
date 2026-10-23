import { Feather } from "@expo/vector-icons";
import { MechanicNotificationBell } from "../../components/onsite-mechanic/MechanicNotificationBell";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToMechanicRequests } from "../../services/owner/bookingService";
import type { BookingRequest } from "../../types/owner/booking";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#303135" };
type Filter = "PENDING" | "ACTIVE";
const ACTIVE_STATUSES: BookingRequest["status"][] = ["accepted", "en_route", "arrived", "in_progress"];

function label(status: BookingRequest["status"]) {
  switch (status) {
    case "pending": return "Pending";
    case "en_route": return "On the way";
    case "in_progress": return "In progress";
    case "accepted": return "Accepted";
    case "arrived": return "Arrived";
    case "completed": return "Completed";
    case "rejected": return "Declined";
    case "cancelled": return "Cancelled";
  }
}

export default function MechanicRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  useEffect(() => subscribeToMechanicRequests(setBookings), []);

  const pending = useMemo(() => bookings.filter((booking) => booking.status === "pending"), [bookings]);
  const active = useMemo(() => bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)), [bookings]);
  const visible = filter === "PENDING" ? pending : active;
  const open = (id: string) => router.push({ pathname: "/(onsite-mechanic)/request-details", params: { id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><MechanicNotificationBell style={s.bell} size={22} color={C.text} /></View>
      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.summaryImage} style={s.summary}>
        <View style={s.summaryShade} />
        <View style={s.summaryCopy}><View style={s.summaryEyebrow}><Feather name="tool" size={13} color="#FF8995" /><Text style={s.summaryEyebrowText}>MECHANIC WORKSPACE</Text></View><Text style={s.summaryTitle}>Requests</Text><Text style={s.summaryHint}>Review and manage mechanic requests</Text></View><View style={s.summaryDivider} /><View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{"\n"}requests</Text></View>
      </ImageBackground>
      <View style={s.sectionIntro}><View><Text style={s.sectionTitle}>Your workload</Text><Text style={s.sectionHint}>Stay on top of every customer</Text></View><View style={s.totalPill}><Feather name="activity" size={14} color="#FF8995" /><Text style={s.totalText}>{pending.length + active.length} open</Text></View></View>
      <View style={s.filters}>
        <FilterButton icon="clipboard" label="Pending" count={pending.length} active={filter === "PENDING"} onPress={() => setFilter("PENDING")} />
        <FilterButton icon="tool" label="Active" count={active.length} active={filter === "ACTIVE"} onPress={() => setFilter("ACTIVE")} />
      </View>
      {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name={filter === "PENDING" ? "inbox" : "tool"} size={28} color="#FF8995" /></View><Text style={s.emptyTitle}>{filter === "PENDING" ? "All caught up" : "Ready for the next job?"}</Text><Text style={s.emptyText}>{filter === "PENDING" ? "New customer requests will show up here as soon as they come in." : "Once you accept a request, you can track your active job here."}</Text><View style={s.emptyAccent}><Feather name="check-circle" size={15} color="#63D99A" /><Text style={s.emptyAccentText}>{filter === "PENDING" ? "No requests need your attention" : "Your current jobs will stay easy to find"}</Text></View></View> : visible.map((booking) => <View key={booking.id} style={s.card}>
        <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={20} color="#FFFFFF" /></View><View style={s.customerCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehicleYear ? ` · ${booking.vehicleYear}` : ""}</Text></View><View style={[s.status, booking.status !== "pending" && s.activeStatus]}><Text style={[s.statusText, booking.status !== "pending" && s.activeStatusText]}>{label(booking.status)}</Text></View></View>
        <View style={s.locationGrid}><View style={s.locationCell}><View style={s.locationHeading}><Feather name="map-pin" size={17} color={C.red} /><Text style={s.locationLabel}>Service location</Text></View><Text style={s.locationText} numberOfLines={2}>{booking.customerAddress || "Customer location"}</Text></View></View>
        <View style={s.details}><Text style={s.detailText}>{formatBookingTimingLabel(booking)}</Text><Detail icon="tool" text={booking.problem || "Mechanic service request"} /><Detail icon="message-square" text={booking.notes || "No additional notes"} /></View>
        <TouchableOpacity style={s.viewButton} onPress={() => open(booking.id)} activeOpacity={0.82}><Text style={s.viewButtonText}>View Request</Text><Feather name="chevron-right" size={19} color="#FFFFFF" /></TouchableOpacity>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function FilterButton({ icon, label, count, active, onPress }: { icon: "clipboard" | "tool"; label: string; count: number; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={s.filterButton} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}><View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={icon} size={21} color={active ? "#FFFFFF" : C.muted} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View><Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text><View style={[s.filterUnderline, active && s.filterUnderlineActive]} /></TouchableOpacity>;
}
function Detail({ icon, text }: { icon: "tool" | "message-square"; text: string }) { return <View style={s.detailRow}><Feather name={icon} size={16} color="#D3D4D6" /><Text style={s.detailText} numberOfLines={2}>{text}</Text></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 }, header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 138, borderRadius: 17, backgroundColor: "#171C23", borderWidth: 1, borderColor: "#333B44", flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16, overflow: "hidden" }, summaryImage: { borderRadius: 17, opacity: 0.58 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,13,18,0.58)" }, summaryCopy: { flex: 1 }, summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: "#FFC0C6", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryTitle: { color: "#F7EFED", fontSize: 25, lineHeight: 32, fontWeight: "800" }, summaryHint: { color: "#E3E5E7", fontSize: 13, lineHeight: 19, marginTop: 4 }, summaryDivider: { width: 1, height: 66, backgroundColor: "rgba(255,255,255,0.34)", marginHorizontal: 16 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "800" }, countLabel: { color: "#F7EFED", fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 5, paddingHorizontal: 3 }, sectionTitle: { color: C.text, fontSize: 20, fontWeight: "800" }, sectionHint: { color: C.muted, fontSize: 12, marginTop: 3 }, totalPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#281B20", borderWidth: 1, borderColor: "#53303A", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }, totalText: { color: "#FFD6DA", fontSize: 12, fontWeight: "700" },
  filters: { minHeight: 62, flexDirection: "row", gap: 9, marginBottom: 10, paddingTop: 9 }, filterButton: { flex: 1, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#172029", borderWidth: 1, borderColor: "#2C3944", borderRadius: 13 }, filterIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: {}, filterDot: { position: "absolute", top: -1, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 14, lineHeight: 20 }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" }, filterUnderline: { display: "none" }, filterUnderlineActive: { display: "none" },
  card: { borderRadius: 17, backgroundColor: "#151D24", borderWidth: 1, borderColor: "#2C3944", padding: 16, marginBottom: 13 }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#293A48", alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#3B2D1C", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 }, statusText: { color: "#FFD691", fontSize: 12, lineHeight: 16, fontWeight: "800" }, activeStatus: { backgroundColor: "#143828" }, activeStatusText: { color: "#91E8B6" },
  locationGrid: { borderTopWidth: 1, borderTopColor: "#292A2D", marginTop: 12, paddingTop: 13 }, locationCell: { paddingHorizontal: 4 }, locationHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, locationLabel: { color: C.muted, fontSize: 13, lineHeight: 18 }, locationText: { color: C.text, fontSize: 14, lineHeight: 20, marginLeft: 25, marginTop: 4 }, details: { gap: 8, marginTop: 12 }, detailRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 9 }, detailText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, flex: 1 }, viewButton: { minHeight: 46, borderRadius: 10, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13 }, viewButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  empty: { minHeight: 250, borderRadius: 18, backgroundColor: "#151D24", borderWidth: 1, borderColor: "#2C3944", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 25, gap: 12 }, emptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: "#263541", alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, emptyAccent: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#173127" }, emptyAccentText: { color: "#A3E9BF", fontSize: 11, fontWeight: "700" },
});
