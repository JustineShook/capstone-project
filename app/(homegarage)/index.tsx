import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { auth } from "../../services/firebase";
import { setParkingAvailability, subscribeToMyParkingProviderListing, subscribeToParkingListing, subscribeToProviderParkingBookings, subscribeToProviderParkingSlots, type ParkingSlot } from "../../services/parkingBookingService";
import type { ParkingBooking } from "../../types/parkingBooking";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", red: "#F52239", line: "#303135" };
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Recently booked" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function HomeGarageDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [online, setOnline] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [capacity, setCapacity] = useState<{ totalSlots: number; availableSlots: number } | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const stopListing = subscribeToMyParkingProviderListing((listing) => {
      setConfigured(Boolean(listing));
      setOnline(listing?.availability === "available");
    });
    const stopCapacity = subscribeToParkingListing(uid, setCapacity);
    const stopBookings = subscribeToProviderParkingBookings(setBookings, () => undefined);
    const stopSlots = subscribeToProviderParkingSlots(setSlots, () => undefined);
    return () => { stopListing(); stopCapacity(); stopBookings(); stopSlots(); };
  }, []);

  const reservations = useMemo(() => bookings.filter((item) => item.status === "reserved"), [bookings]);
  const active = useMemo(() => bookings.find((item) => item.status === "active"), [bookings]);
  const completedToday = useMemo(() => bookings.filter((item) => item.status === "completed" && item.parkingEndedAt && new Date(item.parkingEndedAt).toDateString() === new Date().toDateString()).length, [bookings]);
  const openBooking = (id: string) => router.push({ pathname: "/(homegarage)/parking-session-detail", params: { bookingId: id } });

  const toggleAvailability = async (next: boolean) => {
    if (updating) return;
    if (!configured) {
      Alert.alert("Set up parking first", "Add your public listing, capacity, and location before accepting bookings.", [
        { text: "Not now", style: "cancel" },
        { text: "Open listing", onPress: () => router.push("/(homegarage)/public-listing") },
      ]);
      return;
    }
    setUpdating(true);
    try { await setParkingAvailability(next); }
    catch (error) { Alert.alert("Availability not updated", error instanceof Error ? error.message : "Please try again."); }
    finally { setUpdating(false); }
  };

  const actions = [
    { icon: "clipboard" as const, label: "Bookings", route: "/(homegarage)/parking-sessions" },
    { icon: "navigation" as const, label: "Active Parking", route: null, job: true },
    { icon: "dollar-sign" as const, label: "Earnings", route: "/(homegarage)/earnings" },
    { icon: "home" as const, label: "Public Listing", route: "/(homegarage)/public-listing" },
  ];

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Bookings" onPress={() => router.push("/(homegarage)/parking-sessions")}><Feather name="bell" size={25} color={C.text} /><View style={s.bellDot} /></TouchableOpacity></View>
      <View style={s.hero}>
        <View style={s.heroTop}><View style={s.heroCopy}><Text style={s.locationLabel} numberOfLines={1}>{userProfile?.displayName || "Parking provider"}</Text><Text style={s.heroTitle}>{online ? "Ready for visitors" : "You're offline"}</Text><Text style={s.heroHint}>{online ? "Your parking lot is accepting bookings." : "Go online to receive reservations."}</Text></View>
          <View style={s.availabilityToggle}><Text style={s.availableLabel}>{online ? "Available" : "Offline"}</Text><Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={updating} trackColor={{ false: "#FFFFFF", true: "#FFFFFF" }} thumbColor={online ? C.red : "#77797D"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{reservations.length}</Text><Text style={s.statLabel}>New bookings</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completedToday}</Text><Text style={s.statLabel}>Completed today</Text></View></View>
      </View>

      <Text style={s.overline}>QUICK ACTIONS</Text>
      <View style={s.quickActions}>{actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? openBooking(active.id) : action.route && router.push(action.route as "/(homegarage)/parking-sessions" | "/(homegarage)/earnings" | "/(homegarage)/public-listing")} activeOpacity={0.78}><View style={s.actionIcon}><Feather name={action.icon} size={25} color={C.red} />{action.label === "Bookings" && reservations.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{reservations.length}</Text></View> : null}</View><Text style={s.actionLabel} numberOfLines={2}>{action.label}</Text></TouchableOpacity>)}</View>

      <SectionTitle title="Current parking" onPress={() => router.push("/(homegarage)/parking-sessions")} />
      {active ? <View style={s.jobCard}><View style={s.jobTop}><View style={s.status}><Text style={s.statusText}>Currently parked</Text></View><TouchableOpacity onPress={() => openBooking(active.id)} accessibilityLabel="Open parking session"><Feather name="more-horizontal" size={22} color={C.muted} /></TouchableOpacity></View>
        <Text style={s.customer}>{active.customerName || "Customer"}</Text><Text style={s.vehicle}>{active.vehicle}{active.vehiclePlate ? ` · ${active.vehiclePlate}` : ""}</Text>
        <View style={s.detailRow}><Feather name="grid" size={17} color={C.red} /><Text style={s.detailText}>Parking slot {active.slotNumber}</Text></View>
        <View style={s.detailRow}><Feather name="clock" size={17} color={C.muted} /><Text style={s.detailText}>Started {active.parkingStartedAt ? dateLabel(active.parkingStartedAt) : "time unavailable"}</Text></View>
        <TouchableOpacity style={s.primary} onPress={() => openBooking(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>View Parking Session</Text><Feather name="arrow-right" size={17} color="#FFFFFF" /></TouchableOpacity>
      </View> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(homegarage)/parking-sessions")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="navigation" size={23} color={C.red} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No active parking right now</Text><Text style={s.emptyHint}>Vehicles currently using your spaces will appear here.</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <SectionTitle title="New reservation" onPress={() => router.push("/(homegarage)/parking-sessions")} />
      {reservations[0] ? <TouchableOpacity style={s.requestCard} onPress={() => openBooking(reservations[0].id)} activeOpacity={0.82}><View style={s.requestIcon}><Feather name="calendar" size={21} color={C.red} /></View><View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{reservations[0].customerName || "New customer"}</Text><Text style={s.requestHint} numberOfLines={1}>Slot {reservations[0].slotNumber} · {reservations[0].vehicle}</Text></View><View style={s.requestArrow}><Feather name="chevron-right" size={20} color="#FFFFFF" /></View></TouchableOpacity> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(homegarage)/parking-sessions")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="inbox" size={23} color={C.red} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No new reservations yet</Text><Text style={s.emptyHint}>{online ? "Customer reservations will appear here." : "Go online to accept new reservations."}</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <SectionTitle title="Parking slots" onPress={() => router.push("/(homegarage)/public-listing")} action="Manage" />
      {slots.length ? slots.slice(0, 4).map((slot) => {
        const booking = bookings.find((item) => item.id === slot.bookingId);
        const occupiedSlot = slot.status === "reserved";
        return <View key={slot.id} style={s.slotCard}><View style={s.slotNumber}><Text style={s.slotNumberText}>#{slot.slotNumber}</Text></View><View style={s.slotCopy}><Text style={s.slotTitle} numberOfLines={1}>{occupiedSlot ? booking?.vehicle || "Reserved" : "Available"}</Text><Text style={s.slotSubtitle}>{occupiedSlot ? booking?.vehicleType || "Parking" : "Ready to book"}</Text></View><View style={[s.slotStatus, occupiedSlot && s.slotBusy]}><Text style={[s.slotStatusText, occupiedSlot && s.slotBusyText]}>{occupiedSlot ? "OCCUPIED" : "AVAILABLE"}</Text></View></View>;
      }) : <TouchableOpacity style={s.emptySlots} onPress={() => router.push("/(homegarage)/public-listing")}><Feather name="grid" size={22} color={C.red} /><Text style={s.emptySlotsText}>{capacity ? "No parking slots found. Update your listing." : "Set your parking capacity in Public Listing to create slots."}</Text></TouchableOpacity>}

      <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(homegarage)/public-listing")} activeOpacity={0.8}><View style={s.listingIcon}><Feather name="home" size={19} color={C.red} /></View><View style={s.listingCopy}><Text style={s.listingTitle}>Keep your parking details up to date</Text><Text style={s.listingSubtitle}>Help customers find and book your available spaces.</Text></View><Text style={s.editListing}>Edit listing <Feather name="chevron-right" size={13} color={C.red} /></Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title, onPress, action = "View all" }: { title: string; onPress: () => void; action?: string }) { return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity style={s.viewAll} onPress={onPress}><Text style={s.viewAllText}>{action}</Text><Feather name="chevron-right" size={16} color={C.red} /></TouchableOpacity></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 5 }, header: { height: 57, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", position: "relative" }, bellDot: { position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red },
  hero: { minHeight: 178, backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 15 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1, paddingRight: 6 }, locationLabel: { color: "#F7EFED", fontSize: 14, lineHeight: 20 }, heroTitle: { color: "#F7EFED", fontSize: 27, lineHeight: 35, fontWeight: "800" }, heroHint: { color: "#F7EFED", fontSize: 14, lineHeight: 20 }, availabilityToggle: { minHeight: 45, backgroundColor: "#F7EFED", borderRadius: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }, availableLabel: { color: "#292629", fontSize: 13, fontWeight: "700" }, switch: { transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }], width: 49, marginLeft: 2 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.35)", marginTop: 12, marginBottom: 8 }, stats: { minHeight: 48, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.4)", marginHorizontal: 16 }, statValue: { color: "#F7EFED", fontSize: 32, lineHeight: 37, fontWeight: "800" }, statLabel: { color: "#F7EFED", fontSize: 14, lineHeight: 20 },
  overline: { color: "#C0BCBA", fontSize: 14, fontWeight: "800", letterSpacing: 1, marginTop: 20, marginBottom: 12 }, quickActions: { flexDirection: "row", justifyContent: "space-between" }, quickAction: { width: "24%", minHeight: 91, alignItems: "center" }, actionIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#202124", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, actionLabel: { color: C.text, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center", marginTop: 6 },
  sectionHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", marginTop: 17, marginBottom: 9, paddingHorizontal: 2 }, sectionTitle: { color: C.text, fontSize: 22, lineHeight: 29, fontWeight: "800" }, viewAll: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" }, viewAllText: { color: C.red, fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 16, padding: 18 }, jobTop: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "#147A4A" }, statusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" }, customer: { color: C.text, fontSize: 21, lineHeight: 28, fontWeight: "800", marginTop: 7 }, vehicle: { color: C.muted, fontSize: 16, lineHeight: 22, marginTop: 2, marginBottom: 8 }, detailRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 9 }, detailText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }, primary: { minHeight: 50, backgroundColor: C.red, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }, primaryText: { color: "#F7EFED", fontSize: 15, fontWeight: "800" },
  emptyCard: { minHeight: 125, borderRadius: 16, backgroundColor: C.card, paddingHorizontal: 17, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 13 }, emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "700" }, emptyHint: { color: C.muted, fontSize: 14, lineHeight: 20 }, requestCard: { minHeight: 82, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, requestIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, requestHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, requestArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  slotCard: { minHeight: 70, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 12 }, slotNumber: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, slotNumberText: { color: C.text, fontSize: 14, fontWeight: "800" }, slotCopy: { flex: 1 }, slotTitle: { color: C.text, fontSize: 15, fontWeight: "700" }, slotSubtitle: { color: C.muted, fontSize: 12, marginTop: 3 }, slotStatus: { borderWidth: 1, borderColor: "#70808A", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 }, slotBusy: { borderColor: "#7E3D47" }, slotStatusText: { color: C.text, fontSize: 10, fontWeight: "700" }, slotBusyText: { color: "#FFB8C2" }, emptySlots: { minHeight: 72, borderRadius: 13, backgroundColor: C.card, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }, emptySlotsText: { color: C.muted, fontSize: 13, lineHeight: 19, flex: 1 },
  listingHint: { minHeight: 75, borderRadius: 12, backgroundColor: C.card, marginTop: 12, marginBottom: 3, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, listingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1 }, listingTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }, listingSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 }, editListing: { color: C.red, fontSize: 12, fontWeight: "700" },
});
