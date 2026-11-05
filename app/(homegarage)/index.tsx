import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AccountActionWarning } from "../../components/AccountActionWarning";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useActionRisk } from "../../hooks/useActionRisk";
import { setParkingAvailability, subscribeToMyParkingProviderListing } from "../../services/parkingBookingService";
import { subscribeToHomeGarageRequests } from "../../services/homeGarageBookingService";
import type { HomeGarageBooking } from "../../types/homeGarageBooking";
import { subscribeToHomeGarageNotifications } from "../../services/homeGarageNotificationService";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", line: "#D5DEE9", green: "#166534", blue: "#0F52BA", primary: "#0F52BA", primaryDark: "#0B3D8A", secondary: "#475569", subtle: "#F1F5F9", shadow: "#000000" };
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Recently booked" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function HomeGarageDashboard() {
  const actionRisk = useActionRisk("provider");
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
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`} onPress={() => router.push("/(homegarage)/notifications")}><Feather name="bell" size={25} color="#FFFFFF" />{unreadNotifications > 0 ? <View style={s.bellDot} /> : null}</TouchableOpacity></View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>

      <AccountActionWarning count={actionRisk.count} error={actionRisk.error} />
      <ImageBackground source={require("../../assets/images/homegarage-motorcycle-sapphire.png")} imageStyle={s.heroImage} style={[s.hero, online ? s.heroOnline : s.heroOffline]}>
        <View style={s.heroShade} />
        <View style={s.heroTop}><View style={s.heroCopy}><View style={s.locationRow}><Feather name="map-pin" size={13} color={online ? "#5DE0A0" : "#FFD27B"} /><Text style={s.locationLabel} numberOfLines={1}>{userProfile?.displayName || "Home Garage provider"}</Text></View><Text style={s.heroTitle}>{online ? "Ready for customers" : "You're offline"}</Text><Text style={s.heroHint}>{online ? "Your Home Garage is accepting repair requests." : "Switch on when you're ready to welcome customers."}</Text></View>
          <View style={s.availabilityToggle}><View style={[s.statusDot, online && s.statusDotOnline]} /><Text style={s.availableLabel}>{online ? "Online" : "Offline"}</Text><Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={updating} trackColor={{ false: "#D5DEE9", true: "#C9DBF6" }} thumbColor={online ? C.primary : "#FFFFFF"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{reservations.length}</Text><Text style={s.statLabel}>New requests</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completedToday}</Text><Text style={s.statLabel}>Completed today</Text></View></View>
      </ImageBackground>

      <Text style={s.overline}>YOUR WORKSPACE</Text>
      <View style={s.quickActions}>{actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? openBooking(active.id) : action.route && router.push(action.route as "/(homegarage)/repair-requests" | "/(homegarage)/earnings" | "/(homegarage)/public-listing")} activeOpacity={0.78}><View style={s.actionIcon}><Feather name={action.icon} size={25} color="#FFFFFF" />{action.label === "Service Requests" && reservations.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{reservations.length}</Text></View> : null}</View><Text style={s.actionLabel} numberOfLines={2}>{action.label}</Text></TouchableOpacity>)}</View>

      <SectionTitle title="Current repair request" onPress={() => router.push("/(homegarage)/repair-requests")} />
      {bookingError ? <View style={s.emptyCard}><View style={s.emptyCopy}><Text style={s.emptyTitle}>Requests could not load</Text><Text style={s.emptyHint}>{bookingError}</Text></View><TouchableOpacity onPress={() => router.push("/(homegarage)/repair-requests")}><Feather name="refresh-cw" size={20} color={C.primary} /></TouchableOpacity></View> : active ? <View style={s.jobCard}><View style={s.jobTop}><View style={s.status}><Text style={s.statusText}>{active.status === "pending" ? "Needs review" : active.status === "in_progress" ? "In Progress" : "Accepted"}</Text></View><TouchableOpacity onPress={() => openBooking(active.id)} accessibilityLabel="Open repair request"><Feather name="more-horizontal" size={22} color={C.muted} /></TouchableOpacity></View>
        <Text style={s.customer}>{active.customerName || "Customer"}</Text><Text style={s.vehicle}>{active.vehicle}{active.vehiclePlate ? ` · ${active.vehiclePlate}` : ""}</Text>
        <View style={s.detailRow}><Feather name="tool" size={17} color={C.primary} /><Text style={s.detailText}>{active.problem}</Text></View>
        <TouchableOpacity style={s.primary} onPress={() => openBooking(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>View Request</Text><Feather name="arrow-right" size={17} color="#FFFFFF" /></TouchableOpacity>
      </View> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(homegarage)/repair-requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="tool" size={23} color={C.primary} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No active repairs right now</Text><Text style={s.emptyHint}>Accepted Home Garage requests will appear here.</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      {otherPending.length > 0 ? <><SectionTitle title="Another new request" onPress={() => router.push("/(homegarage)/repair-requests")} /><TouchableOpacity style={s.requestCard} onPress={() => openBooking(otherPending[0].id)} activeOpacity={0.82}><View style={s.requestIcon}><Feather name="tool" size={21} color={C.primary} /></View><View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{otherPending[0].customerName || "New customer"}</Text><Text style={s.requestHint} numberOfLines={1}>{otherPending[0].vehicle} · {otherPending[0].problem}</Text></View><View style={s.requestArrow}><Feather name="chevron-right" size={20} color="#FFFFFF" /></View></TouchableOpacity></> : null}

      <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(homegarage)/public-listing")} activeOpacity={0.8}><View style={s.listingIcon}><Feather name="home" size={19} color="#FFFFFF" /></View><View style={s.listingCopy}><Text style={s.listingTitle}>Keep your Home Garage listing up to date</Text><Text style={s.listingSubtitle}>Help customers find your garage and review the services you offer.</Text></View><Text style={s.editListing}>Edit listing <Feather name="chevron-right" size={13} color="#FFFFFF" /></Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title, onPress, action = "View all" }: { title: string; onPress: () => void; action?: string }) { return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity style={s.viewAll} onPress={onPress}><Text style={s.viewAllText}>{action}</Text><Feather name="chevron-right" size={16} color="#FFFFFF" /></TouchableOpacity></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }, header: { backgroundColor: C.primary, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }, bellDot: { position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFF" },
  hero: { borderRadius: 20, minHeight: 178, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, borderWidth: 1, overflow: "hidden", ...Platform.select({ ios: { shadowColor: C.primaryDark, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 2, shadowColor: C.primaryDark }, default: {} }) }, heroImage: { borderRadius: 20, opacity: 0.9 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, heroOnline: { backgroundColor: C.primary, borderColor: C.primaryDark }, heroOffline: { backgroundColor: C.primaryDark, borderColor: C.primaryDark }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, heroCopy: { flex: 1, paddingRight: 2 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 31, marginTop: 5 }, heroHint: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, marginTop: 2 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F4A45D", marginRight: 7 }, statusDotOnline: { backgroundColor: "#5DE0A0" }, availabilityToggle: { minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingLeft: 10, paddingRight: 4 }, availableLabel: { color: C.text, fontSize: 13, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.02 }, { scaleY: 1.02 }], width: 50, marginLeft: 1, marginRight: -1 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 17 }, statValue: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" }, statLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  overline: { color: C.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 20, marginBottom: 12 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 0 }, quickAction: { alignItems: "center", width: "24%", minHeight: 86 }, actionIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.primary, borderWidth: 1, borderColor: C.primary, alignItems: "center", justifyContent: "center", position: "relative", ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 2 }, default: {} }) }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, actionLabel: { color: C.secondary, fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 7, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 12, paddingHorizontal: 0, minHeight: 40 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, viewAll: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.primary }, viewAllText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 20, padding: 16, minHeight: 0, borderWidth: 1, borderColor: C.line, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: "#147A4A" }, statusText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, customer: { color: C.text, fontSize: 18, lineHeight: 25, fontWeight: "700", marginTop: 8 }, vehicle: { color: C.secondary, fontSize: 14, lineHeight: 20, marginTop: 3, marginBottom: 8 }, detailRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10 }, detailText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 }, primary: { height: 54, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, primaryText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  emptyCard: { minHeight: 104, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 }, emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.subtle, alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, emptyHint: { color: C.muted, fontSize: 14, lineHeight: 20 }, requestCard: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, requestIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#FDECEF", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1, gap: 2 }, requestName: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, requestHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, requestArrow: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  listingHint: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginTop: 0, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, listingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1, gap: 2, minWidth: 0 }, listingTitle: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }, listingSubtitle: { color: C.secondary, fontSize: 12, lineHeight: 17 }, editListing: { color: C.primary, fontSize: 12, lineHeight: 18, fontWeight: "800" },
scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }});
