import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { setParkingAvailability, subscribeToMyParkingProviderListing } from "../../services/parkingBookingService";
import { subscribeToHomeGarageRequests } from "../../services/homeGarageBookingService";
import type { HomeGarageBooking } from "../../types/homeGarageBooking";
import { subscribeToHomeGarageNotifications } from "../../services/homeGarageNotificationService";

const C = { canvas: "#0C1015", card: "#151C23", elevated: "#1C252E", text: "#F4F6F8", muted: "#AAB5C0", red: "#F52239", line: "#28313A", green: "#39D98A" };
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Recently booked" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function HomeGarageDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const [online, setOnline] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [bookings, setBookings] = useState<HomeGarageBooking[]>([]);
  const [bookingError, setBookingError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const stopListing = subscribeToMyParkingProviderListing((listing) => {
      setConfigured(Boolean(listing));
      setOnline(listing?.availability === "available");
    });
    const stopBookings = subscribeToHomeGarageRequests((items) => {
      setBookings(items);
      setBookingError("");
    }, (error) => setBookingError(error.message));
    const stopNotifications = subscribeToHomeGarageNotifications((items) => setUnreadNotifications(items.filter((item) => !item.isRead).length));
    return () => { stopListing(); stopBookings(); stopNotifications(); };
  }, [user?.uid]);

  const reservations = useMemo(() => bookings.filter((item) => item.status === "pending"), [bookings]);
  const active = useMemo(() => bookings.find((item) => item.status === "in_progress")
    ?? bookings.find((item) => item.status === "accepted")
    ?? bookings.find((item) => item.status === "pending"), [bookings]);
  const otherPending = useMemo(() => reservations.filter((item) => item.id !== active?.id), [reservations, active?.id]);
  const completedToday = useMemo(() => bookings.filter((item) => item.status === "completed" && item.updatedAt && new Date(item.updatedAt).toDateString() === new Date().toDateString()).length, [bookings]);
  const openBooking = (id: string) => router.push({ pathname: "/(homegarage)/repair-request-detail", params: { bookingId: id } });

  const toggleAvailability = async (next: boolean) => {
    if (updating) return;
    if (!configured) {
      Alert.alert("Set up your Home Garage first", "Add your public listing and service area before accepting repair requests.", [
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
    { icon: "clipboard" as const, label: "Service Requests", route: "/(homegarage)/repair-requests" },
    { icon: "tool" as const, label: "Active Repair", route: null, job: true },
    { icon: "dollar-sign" as const, label: "Earnings", route: "/(homegarage)/earnings" },
    { icon: "home" as const, label: "Public Listing", route: "/(homegarage)/public-listing" },
  ];

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`} onPress={() => router.push("/(homegarage)/notifications")}><Feather name="bell" size={25} color={C.text} />{unreadNotifications > 0 ? <View style={s.bellDot} /> : null}</TouchableOpacity></View>
      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.heroImage} style={[s.hero, online ? s.heroOnline : s.heroOffline]}>
        <View style={s.heroShade} />
        <View style={s.heroTop}><View style={s.heroCopy}><View style={s.locationRow}><Feather name="map-pin" size={13} color={online ? C.green : "#F4A45D"} /><Text style={s.locationLabel} numberOfLines={1}>{userProfile?.displayName || "Home Garage provider"}</Text></View><Text style={s.heroTitle}>{online ? "Ready for customers" : "You're offline"}</Text><Text style={s.heroHint}>{online ? "Your Home Garage is accepting repair requests." : "Switch on when you're ready to welcome customers."}</Text></View>
          <View style={s.availabilityToggle}><View style={[s.statusDot, online && s.statusDotOnline]} /><Text style={s.availableLabel}>{online ? "Online" : "Offline"}</Text><Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={updating} trackColor={{ false: "#686A6E", true: "#FFFFFF" }} thumbColor={online ? C.red : "#F3F3F3"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{reservations.length}</Text><Text style={s.statLabel}>New requests</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completedToday}</Text><Text style={s.statLabel}>Completed today</Text></View></View>
      </ImageBackground>

      <Text style={s.overline}>YOUR WORKSPACE</Text>
      <View style={s.quickActions}>{actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? openBooking(active.id) : action.route && router.push(action.route as "/(homegarage)/repair-requests" | "/(homegarage)/earnings" | "/(homegarage)/public-listing")} activeOpacity={0.78}><View style={s.actionIcon}><Feather name={action.icon} size={25} color={C.red} />{action.label === "Service Requests" && reservations.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{reservations.length}</Text></View> : null}</View><Text style={s.actionLabel} numberOfLines={2}>{action.label}</Text></TouchableOpacity>)}</View>

      <SectionTitle title="Current repair request" onPress={() => router.push("/(homegarage)/repair-requests")} />
      {bookingError ? <View style={s.emptyCard}><View style={s.emptyCopy}><Text style={s.emptyTitle}>Requests could not load</Text><Text style={s.emptyHint}>{bookingError}</Text></View><TouchableOpacity onPress={() => router.push("/(homegarage)/repair-requests")}><Feather name="refresh-cw" size={20} color={C.red} /></TouchableOpacity></View> : active ? <View style={s.jobCard}><View style={s.jobTop}><View style={s.status}><Text style={s.statusText}>{active.status === "pending" ? "Needs review" : active.status === "in_progress" ? "In Progress" : "Accepted"}</Text></View><TouchableOpacity onPress={() => openBooking(active.id)} accessibilityLabel="Open repair request"><Feather name="more-horizontal" size={22} color={C.muted} /></TouchableOpacity></View>
        <Text style={s.customer}>{active.customerName || "Customer"}</Text><Text style={s.vehicle}>{active.vehicle}{active.vehiclePlate ? ` · ${active.vehiclePlate}` : ""}</Text>
        <View style={s.detailRow}><Feather name="tool" size={17} color={C.red} /><Text style={s.detailText}>{active.problem}</Text></View>
        <TouchableOpacity style={s.primary} onPress={() => openBooking(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>View Request</Text><Feather name="arrow-right" size={17} color="#FFFFFF" /></TouchableOpacity>
      </View> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(homegarage)/repair-requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="tool" size={23} color={C.red} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No active repairs right now</Text><Text style={s.emptyHint}>Accepted Home Garage requests will appear here.</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      {otherPending.length > 0 ? <><SectionTitle title="Another new request" onPress={() => router.push("/(homegarage)/repair-requests")} /><TouchableOpacity style={s.requestCard} onPress={() => openBooking(otherPending[0].id)} activeOpacity={0.82}><View style={s.requestIcon}><Feather name="tool" size={21} color={C.red} /></View><View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{otherPending[0].customerName || "New customer"}</Text><Text style={s.requestHint} numberOfLines={1}>{otherPending[0].vehicle} · {otherPending[0].problem}</Text></View><View style={s.requestArrow}><Feather name="chevron-right" size={20} color="#FFFFFF" /></View></TouchableOpacity></> : null}

      <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(homegarage)/public-listing")} activeOpacity={0.8}><View style={s.listingIcon}><Feather name="home" size={19} color={C.red} /></View><View style={s.listingCopy}><Text style={s.listingTitle}>Keep your Home Garage listing up to date</Text><Text style={s.listingSubtitle}>Help customers find your garage and review the services you offer.</Text></View><Text style={s.editListing}>Edit listing <Feather name="chevron-right" size={13} color={C.red} /></Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title, onPress, action = "View all" }: { title: string; onPress: () => void; action?: string }) { return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity style={s.viewAll} onPress={onPress}><Text style={s.viewAllText}>{action}</Text><Feather name="chevron-right" size={16} color={C.red} /></TouchableOpacity></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 18, paddingTop: 8 }, header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 38, lineHeight: 44, fontWeight: "900", fontStyle: "italic", marginRight: 7 }, brand: { color: C.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", position: "relative" }, bellDot: { position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red },
  hero: { borderRadius: 20, minHeight: 178, paddingHorizontal: 21, paddingTop: 20, paddingBottom: 17, borderWidth: 1, overflow: "hidden" }, heroImage: { borderRadius: 20, opacity: 0.55 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,14,18,0.55)" }, heroOnline: { backgroundColor: "#13251F", borderColor: "#26533D" }, heroOffline: { backgroundColor: "#211B19", borderColor: "#54372C" }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1, paddingRight: 5 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#D7E1E8", fontSize: 14, lineHeight: 22, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 35, fontWeight: "800", marginTop: 5 }, heroHint: { color: "#C5D0D7", fontSize: 14, lineHeight: 20, marginTop: 2 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F4A45D", marginRight: 7 }, statusDotOnline: { backgroundColor: C.green }, availabilityToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: "#F7F9FA", borderRadius: 25, paddingLeft: 12, paddingRight: 5 }, availableLabel: { color: "#252525", fontSize: 14, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.04 }, { scaleY: 1.04 }], width: 52, marginLeft: 1, marginRight: -1 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 17 }, statValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 38, fontWeight: "800" }, statLabel: { color: "#C5D0D7", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  overline: { color: "#9AA8B3", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginTop: 21, marginBottom: 13 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 1 }, quickAction: { width: "24%", minHeight: 91, alignItems: "center" }, actionIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#18222B", borderWidth: 1, borderColor: "#283744", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, actionLabel: { color: "#DCE3E8", fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center", marginTop: 7 },
  sectionHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", marginTop: 23, marginBottom: 12, paddingHorizontal: 3 }, sectionTitle: { color: C.text, fontSize: 23, lineHeight: 31, fontWeight: "800" }, viewAll: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", paddingHorizontal: 5 }, viewAllText: { color: "#FF6678", fontSize: 15, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 17, padding: 20 }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: "#147A4A" }, statusText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, customer: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: "800", marginTop: 8 }, vehicle: { color: "#D0D8DE", fontSize: 17, lineHeight: 24, marginTop: 3, marginBottom: 8 }, detailRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10 }, detailText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 }, primary: { minHeight: 54, backgroundColor: C.red, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  emptyCard: { minHeight: 125, borderRadius: 16, backgroundColor: C.card, paddingHorizontal: 17, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 13 }, emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "700" }, emptyHint: { color: C.muted, fontSize: 14, lineHeight: 20 }, requestCard: { minHeight: 82, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, requestIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, requestHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, requestArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  listingHint: { minHeight: 75, borderRadius: 12, backgroundColor: C.card, marginTop: 12, marginBottom: 3, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, listingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1 }, listingTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }, listingSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 }, editListing: { color: C.red, fontSize: 12, fontWeight: "700" },
});
