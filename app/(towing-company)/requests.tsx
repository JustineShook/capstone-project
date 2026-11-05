import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";
import { buildTowingContactUrl } from "../../utils/towingContact";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", border: "#D5DEE9", primary: "#0F52BA", primaryDark: "#0B3D8A", subtle: "#F1F5F9", green: "#166534" };
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
  const contactOwner = (booking: TowingBookingRequest) => {
    const phone = booking.customerPhone?.trim();
    if (!phone) { Alert.alert("Contact number unavailable", "Contact number unavailable."); return; }
    const openContact = (scheme: "tel" | "sms") => {
      const url = buildTowingContactUrl(scheme, phone);
      if (!url) { Alert.alert("Contact number unavailable", "Contact number unavailable."); return; }
      void Linking.openURL(url).catch(() => Alert.alert("Unable to open contact app", "Please try again or contact the Vehicle Owner another way."));
    };
    Alert.alert("Contact Vehicle Owner", booking.customerName || "Vehicle Owner", [
      { text: "Call", onPress: () => openContact("tel") },
      { text: "Text Message", onPress: () => openContact("sms") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/notifications")}><Feather name="bell" size={22} color="#FFFFFF" /></TouchableOpacity></View>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>


        <ImageBackground source={require("../../assets/images/towing-ready-sapphire.png")} imageStyle={s.summaryImage} style={s.summary}>
          <View style={s.summaryShade} />
          <View style={s.summaryCopy}><View style={s.summaryEyebrow}><Feather name="truck" size={13} color={C.primary} /><Text style={s.summaryEyebrowText}>TOWING WORKSPACE</Text></View><Text style={s.summaryTitle}>Requests</Text><Text style={s.summaryHint}>Review and manage towing requests</Text></View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCount}><Text style={s.countValue}>{pending.length}</Text><Text style={s.countLabel}>Pending{"\n"}requests</Text></View>
        </ImageBackground>

        <View style={s.sectionIntro}><View><Text style={s.sectionTitle}>Your workload</Text><Text style={s.sectionHint}>Pickup and drop-off details at a glance</Text></View><View style={s.totalPill}><Feather name="activity" size={14} color={C.primary} /><Text style={s.totalText}>{pending.length + active.length} open</Text></View></View>

        <View style={s.filters}>
          <FilterButton icon="clipboard" label="Pending" count={pending.length} active={filter === "NEW"} onPress={() => setFilter("NEW")} />
          <FilterButton icon="truck" label="Active" count={active.length} active={filter === "ONGOING"} onPress={() => setFilter("ONGOING")} />
        </View>

        {visible.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Feather name={filter === "NEW" ? "inbox" : "truck"} size={28} color={C.primary} /></View><Text style={s.emptyTitle}>{filter === "NEW" ? "All caught up" : "Ready for the next job?"}</Text><Text style={s.emptyText}>{filter === "NEW" ? "New towing requests will appear here as soon as customers need help." : "Once you accept a request, you can track your active tow here."}</Text><View style={s.emptyAccent}><Feather name="check-circle" size={15} color="#63D99A" /><Text style={s.emptyAccentText}>{filter === "NEW" ? "No requests need your attention" : "Your current jobs will stay easy to find"}</Text></View></View> : visible.map((booking) => (
          <View key={booking.id} style={s.card}>
            <View style={s.customerRow}><View style={s.avatar}><Feather name="user" size={19} color="#FFFFFF" /></View><View style={s.customerCopy}><Text style={s.customerName} numberOfLines={1}>{booking.customerName || "Customer"}</Text><Text style={s.vehicle} numberOfLines={1}>{booking.vehicle}{booking.vehicleYear ? ` · ${booking.vehicleYear}` : ""}</Text></View><View style={[s.status, booking.status !== "pending" && s.activeStatus]}><Text style={[s.statusText, booking.status !== "pending" && s.activeStatusText]}>{label(booking.status)}</Text></View></View>
            <View style={s.locationGrid}>
              <View style={s.locationCell}><View style={s.locationHeading}><Feather name="map-pin" size={16} color={C.primary} /><Text style={s.locationLabel}>Pickup</Text></View><Text style={s.locationText} numberOfLines={2}>{booking.pickupLocation}</Text></View>
              <View style={s.locationCell}><View style={s.locationHeading}><Feather name="flag" size={16} color={C.muted} /><Text style={s.locationLabel}>Drop-off</Text></View><Text style={s.locationText} numberOfLines={2}>{booking.destination}</Text></View>
            </View>
            <View style={s.details}>
              <Text style={s.detailText}>{formatBookingTimingLabel(booking)}</Text>
              <Detail icon="navigation" text={`${booking.providerToPickupDistanceKm || 0} km to pickup`} />
              <Detail icon="message-square" text={booking.vehicleCondition || booking.towingType || "Towing request"} />
            </View>
            <View style={s.bookingActions}><TouchableOpacity style={[s.viewButton, s.viewButtonFlex]} onPress={() => open(booking.id)} activeOpacity={0.82}><Text style={s.viewButtonText}>View Request</Text><Feather name="chevron-right" size={19} color="#FFFFFF" /></TouchableOpacity><TouchableOpacity style={s.contactButton} onPress={() => contactOwner(booking)} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Contact Vehicle Owner"><Feather name="phone" size={20} color="#FFFFFF" /></TouchableOpacity></View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterButton({ icon, label, count, active, onPress }: { icon: "clipboard" | "truck"; label: string; count: number; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[s.filterButton, active && s.filterButtonActive]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected: active }}>
    <View style={[s.filterIcon, active && s.filterIconActive]}><Feather name={icon} size={20} color={active ? "#FFFFFF" : C.primary} />{count > 0 && <View style={[s.filterDot, active && s.filterDotActive]} />}</View>
    <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text>

  </TouchableOpacity>;
}

function Detail({ icon, text }: { icon: "navigation" | "message-square"; text: string }) {
  return <View style={s.detailRow}><Feather name={icon} size={15} color={C.muted} /><Text style={s.detailText} numberOfLines={1}>{text}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, content: { paddingHorizontal: 16, paddingTop: 8 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: C.primary }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" }, brandRed: { color: "#FFFFFF" }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 138, borderRadius: 20, backgroundColor: C.primaryDark, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 16, overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, summaryImage: { borderRadius: 20, opacity: 0.9 }, summaryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, summaryCopy: { flex: 1, minWidth: 0 }, summaryEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, summaryEyebrowText: { color: "#EAF2FF", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 31, fontWeight: "800" }, summaryHint: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, marginTop: 4 }, summaryDivider: { width: 1, height: 66, backgroundColor: "rgba(255,255,255,0.34)", marginHorizontal: 16 }, summaryCount: { width: 66, alignItems: "center" }, countValue: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" }, countLabel: { color: "#EAF2FF", fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 9, paddingHorizontal: 0 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, sectionHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 3 }, totalPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 }, totalText: { color: C.primary, fontSize: 12, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 10, marginBottom: 12 }, filterButton: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.subtle, borderWidth: 1, borderColor: C.border, borderRadius: 14 }, filterIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center", position: "relative" }, filterIconActive: {}, filterDot: { position: "absolute", top: -1, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }, filterDotActive: { backgroundColor: "#FFFFFF" }, filterLabel: { color: C.muted, fontSize: 14, lineHeight: 20, fontWeight: "600" }, filterLabelActive: { color: "#FFFFFF", fontWeight: "700" }, filterUnderline: { display: "none" ,height: 0}, filterUnderlineActive: { display: "none" },
  card: { borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, customerRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }, customerCopy: { flex: 1, minWidth: 0 }, customerName: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, vehicle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, status: { backgroundColor: "#FFF4E5", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }, statusText: { color: "#9A5B00", fontSize: 12, lineHeight: 16, fontWeight: "800" }, activeStatus: { backgroundColor: "#EAF6EE" }, activeStatusText: { color: C.green },
  locationGrid: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 13 }, locationCell: { paddingHorizontal: 4 }, locationHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, locationLabel: { color: C.muted, fontSize: 13, lineHeight: 18 }, locationText: { color: C.text, fontSize: 14, lineHeight: 20, marginLeft: 25, marginTop: 4 },
  details: { gap: 8, marginTop: 12 }, detailRow: { minHeight: 26, flexDirection: "row", alignItems: "flex-start", gap: 9 }, detailText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }, bookingActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 }, viewButton: { minHeight: 54, borderRadius: 14, backgroundColor: C.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 0 }, viewButtonFlex: { flex: 1 }, contactButton: { width: 54, height: 54, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }, viewButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  empty: { minHeight: 250, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 25, gap: 12, ...Platform.select({ ios: { shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, emptyAccent: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#EAF6EE" }, emptyAccentText: { color: C.green, fontSize: 11, fontWeight: "700" },

scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
filterButtonActive: { backgroundColor: C.primary, borderColor: C.primary },
});
