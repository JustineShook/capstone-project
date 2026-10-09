import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";

const C = { canvas: "#08090B", card: "#191A1D", text: "#ECE8E6", muted: "#B4AFAD", red: "#F52239", border: "#303135" };
type Filter = "NEW" | "ONGOING";
const ACTIVE_STATUSES: TowingBookingRequest["status"][] = ["accepted", "en_route", "arrived", "in_progress"];

function label(status: TowingBookingRequest["status"]) {
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

export default function TowingRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("NEW");
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);
  useEffect(() => subscribeToTowingRequests(setBookings), []);

  const pending = useMemo(() => bookings.filter((booking) => booking.status === "pending"), [bookings]);
  const active = useMemo(() => bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)), [bookings]);
  const visible = filter === "NEW" ? pending : active;
  const open = (id: string) => router.push({ pathname: "/(towing-company)/request-details", params: { id } });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Notifications"><Feather name="bell" size={22} color={C.text} /></TouchableOpacity></View>

        <View style={s.summary}>
          <View><Text style={s.summaryTitle}>Requests</Text><Text style={s.summaryHint}>Review and manage towing requests</Text></View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{`\n`}requests</Text></View>
        </View>

        <View style={s.filters}>
          <FilterButton icon="clipboard" label="Pending" count={pending.length} active={filter === "NEW"} onPress={() => setFilter("NEW")} />
          <FilterButton icon="truck" label="Active" count={active.length} active={filter === "ONGOING"} onPress={() => setFilter("ONGOING")} />
        </View>

        {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name={filter === "NEW" ? "inbox" : "truck"} size={28} color={C.muted} /></View><Text style={s.emptyTitle}>{filter === "NEW" ? "No pending requests" : "No active jobs"}</Text><Text style={s.emptyText}>{filter === "NEW" ? "New towing requests will appear here." : "Accepted jobs will appear here while you assist customers."}</Text></View> : visible.map((booking) => (
          <View key={booking.id} style={s.card}>
            <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={19} color="#FFFFFF" /></View><View style={s.customerCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehicleYear ? ` · ${booking.vehicleYear}` : ""}</Text></View><View style={[s.status, booking.status !== "pending" && s.activeStatus]}><Text style={[s.statusText, booking.status !== "pending" && s.activeStatusText]}>{label(booking.status)}</Text></View></View>
            <View style={s.locationGrid}>
              <View style={s.locationCell}><View style={s.locationHeading}><Feather name="map-pin" size={16} color={C.red} /><Text style={s.locationLabel}>Pickup</Text></View><Text style={s.locationText} numberOfLines={2}>{booking.pickupLocation}</Text></View>
              <View style={s.locationCell}><View style={s.locationHeading}><Feather name="flag" size={16} color="#D1D2D4" /><Text style={s.locationLabel}>Drop-off</Text></View><Text style={s.locationText} numberOfLines={2}>{booking.destination}</Text></View>
            </View>
            <View style={s.details}>
              <Detail icon="navigation" text={`${booking.providerToPickupDistanceKm || 0} km to pickup`} />
              <Detail icon="message-square" text={booking.vehicleCondition || booking.towingType || "Towing request"} />
            </View>
            <TouchableOpacity style={s.viewButton} onPress={() => open(booking.id)} activeOpacity={0.82}><Text style={s.viewButtonText}>View Request</Text><Feather name="chevron-right" size={19} color="#FFFFFF" /></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterButton({ icon, label, count, active, onPress }: { icon: "clipboard" | "truck"; label: string; count: number; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={s.filterButton} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}>
    <View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={icon} size={20} color={active ? "#FFFFFF" : C.muted} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View>
    <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text>
    <View style={[s.filterUnderline, active && s.filterUnderlineActive]} />
  </TouchableOpacity>;
}

function Detail({ icon, text }: { icon: "navigation" | "message-square"; text: string }) {
  return <View style={s.detailRow}><Feather name={icon} size={15} color="#D3D4D6" /><Text style={s.detailText} numberOfLines={1}>{text}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 3 },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, brandRed: { color: C.red }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 122, borderRadius: 17, backgroundColor: C.red, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16 }, summaryTitle: { color: "#F7EFED", fontSize: 28, lineHeight: 36, fontWeight: "800" }, summaryHint: { color: "#F7EFED", fontSize: 14, lineHeight: 20, marginTop: 4 }, summaryDivider: { width: 1, height: 72, backgroundColor: "rgba(255,255,255,0.5)", marginHorizontal: 18 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#F7EFED", fontSize: 34, lineHeight: 39, fontWeight: "800" }, countLabel: { color: "#F7EFED", fontSize: 13, lineHeight: 18, textAlign: "center" },
  filters: { minHeight: 108, flexDirection: "row", justifyContent: "center", gap: 48, marginBottom: 10 }, filterButton: { width: 88, minHeight: 100, alignItems: "center", justifyContent: "flex-start", paddingTop: 11 }, filterIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#191A1D", borderWidth: 1, borderColor: "#36373A", alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: { backgroundColor: C.red, borderColor: C.red }, filterDot: { position: "absolute", top: 1, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 5 }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" }, filterUnderline: { height: 3, width: 46, backgroundColor: "transparent", marginTop: 3 }, filterUnderlineActive: { backgroundColor: C.red },
  card: { borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#424347", alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1 }, customerName: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }, status: { backgroundColor: "#F4D28A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }, statusText: { color: "#292316", fontSize: 12, lineHeight: 16, fontWeight: "800" }, activeStatus: { backgroundColor: "#303135" }, activeStatusText: { color: "#FFFFFF" },
  locationGrid: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#292A2D", marginTop: 12, paddingTop: 13 }, locationCell: { flex: 1, paddingHorizontal: 4 }, locationHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, locationLabel: { color: C.muted, fontSize: 13, lineHeight: 18 }, locationText: { color: C.text, fontSize: 14, lineHeight: 20, marginLeft: 24, marginTop: 3 },
  details: { gap: 8, marginTop: 12 }, detailRow: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 9 }, detailText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, flex: 1 }, viewButton: { minHeight: 46, borderRadius: 10, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 13 }, viewButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  empty: { minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 }, emptyIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 21, fontWeight: "700" }, emptyText: { color: C.muted, fontSize: 16, lineHeight: 23, textAlign: "center" },
});
