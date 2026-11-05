import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AccountActionWarning } from "../../components/AccountActionWarning";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { useActionRisk } from "../../hooks/useActionRisk";
import { getPublicProviderListing, updateTowingAvailability } from "../../services/publicProviderListingService";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import { subscribeToTowingNotifications } from "../../services/towingNotificationService";
import type { TowingBookingRequest } from "../../types/owner/towing";
import type { PublicProviderListingInput } from "../../types/providerListing";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", line: "#D5DEE9", green: "#166534", blue: "#0F52BA", primary: "#0F52BA", primaryDark: "#0B3D8A", secondary: "#475569", subtle: "#F1F5F9", shadow: "#000000", border: "#D5DEE9" };
const ACTIVE_STATUSES: TowingBookingRequest["status"][] = ["accepted", "en_route", "arrived", "in_progress"];
type ListingSettings = Omit<PublicProviderListingInput, "availability">;

function label(status: TowingBookingRequest["status"]) {
  switch (status) {
    case "pending": return "New request";
    case "en_route": return "On the way";
    case "in_progress": return "In progress";
    case "accepted": return "Accepted";
    case "arrived": return "Arrived";
    case "completed": return "Completed";
    case "rejected": return "Declined";
    case "cancelled": return "Cancelled";
  }
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

export default function TowingCompanyDashboard() {
  const actionRisk = useActionRisk("provider");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [listingSettings, setListingSettings] = useState<ListingSettings | null>(null);
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let alive = true;
    const stop = subscribeToTowingRequests(setBookings);
    const uid = auth.currentUser?.uid;
    if (uid) {
      void Promise.all([getPublicProviderListing(uid), getTowingCompanyProfile(uid)]).then(([listing, profile]) => {
        if (!alive) return;
        setOnline(listing?.availability === "available");
        if (listing?.role === "towing-company") {
          const { availability: _availability, ...settings } = listing;
          setListingSettings(settings);
        } else if (profile?.verificationStatus === "VERIFIED") {
          setListingSettings({
            businessName: profile.company.companyName,
            location: { latitude: 0, longitude: 0 },
            serviceAreaLabel: profile.services.serviceArea,
            description: "",
            contactPhone: profile.company.phone,
            services: profile.services.towingServices,
            vehicleTypes: profile.services.vehicleTypesSupported,
            operatingHours: profile.company.operatingHours,
            startingPrice: null,
            emergencyServiceAvailable: profile.services.emergencyServiceAvailable,
          });
        }
      }).catch(() => undefined).finally(() => { if (alive) setAvailabilityLoaded(true); });
    } else {
      setAvailabilityLoaded(true);
    }
    return () => { alive = false; stop(); };
  }, []);

  useEffect(() => subscribeToTowingNotifications(
    (items) => setUnreadNotifications(items.filter((item) => !item.isRead).length),
    () => setUnreadNotifications(0),
  ), []);

  const pending = useMemo(() => bookings.filter((booking) => booking.status === "pending"), [bookings]);
  const active = useMemo(() => bookings.find((booking) => ACTIVE_STATUSES.includes(booking.status)), [bookings]);
  const serviceInProgress = useMemo(() => bookings.some((booking) =>
    booking.status === "en_route" || booking.status === "arrived" || booking.status === "in_progress"
    || (booking.status === "accepted" && booking.timingMode !== "scheduled")), [bookings]);
  const completed = useMemo(() => bookings.filter((booking) => booking.status === "completed").length, [bookings]);
  const open = (id: string) => router.push({ pathname: "/(towing-company)/request-details", params: { id } });

  const toggleAvailability = async (next: boolean) => {
    if (serviceInProgress) {
      Alert.alert("Service in progress", "Availability will return to its previous state when this service ends.");
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid || !listingSettings) {
      Alert.alert("Listing required", "Set up your public listing before becoming available.", [
        { text: "Not now", style: "cancel" },
        { text: "Set up listing", onPress: () => router.push("/(towing-company)/public-listing") },
      ]);
      return;
    }
    setSavingAvailability(true);
    try {
      await updateTowingAvailability(uid, next ? "available" : "offline");
      setOnline(next);
    } catch (error) {
      Alert.alert("Availability not changed", error instanceof Error ? error.message : "Please try again.");
    } finally { setSavingAvailability(false); }
  };

  const actions = [
    { icon: "clipboard" as const, label: "Requests", route: "/(towing-company)/requests" },
    { icon: "truck" as const, label: "Active Job", route: active ? null : "/(towing-company)/requests", job: true },
    { icon: "tag" as const, label: "Pricing", route: "/(towing-company)/towing-pricing" },
    { icon: "home" as const, label: "Public Listing", route: "/(towing-company)/public-listing" },
    { icon: "dollar-sign" as const, label: "Earnings", route: "/(towing-company)/earnings" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={[s.header, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"} onPress={() => router.push("/(towing-company)/notifications")} style={s.bell}>
            <Feather name="bell" size={26} color="#FFFFFF" />
            {unreadNotifications > 0 && <View style={s.notificationBadge}><Text style={s.notificationBadgeText}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text></View>}
          </TouchableOpacity>
        </View>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>

        <AccountActionWarning count={actionRisk.count} error={actionRisk.error} />

        <ImageBackground source={require("../../assets/images/towing-ready-sapphire.png")} imageStyle={s.heroImage} style={[s.hero, online ? s.heroOnline : s.heroOffline]}>
          <View style={s.heroShade} />
          <View style={s.heroTop}>
            <View style={s.heroCopy}>
              <View style={s.locationRow}><Feather name="map-pin" size={13} color={serviceInProgress ? C.red : online ? C.green : "#F4A45D"} /><Text style={s.locationLabel} numberOfLines={1}>{listingSettings?.serviceAreaLabel || "Towing provider"}</Text></View>
              <Text style={s.heroTitle}>{serviceInProgress ? "Service in progress" : online ? "Ready to assist" : "You're offline"}</Text>
              <Text style={s.heroHint}>{serviceInProgress ? "New immediate jobs are paused until this service ends." : online ? "Your towing service is online." : "Go online to receive new requests."}</Text>
            </View>
            <View style={s.availabilityToggle}>
              <View style={[s.statusDot, online && s.statusDotOnline]} /><Text style={s.availableLabel}>{serviceInProgress ? "Busy" : online ? "Online" : "Offline"}</Text>
              <Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={!availabilityLoaded || savingAvailability || serviceInProgress} trackColor={{ false: "#D5DEE9", true: "#C9DBF6" }} thumbColor={online ? C.primary : "#FFFFFF"} style={s.switch} />
            </View>
          </View>
          <View style={s.heroDivider} />
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statValue}>{pending.length}</Text><Text style={s.statLabel}>New requests</Text></View>
            <View style={s.statDivider} />
            <View style={s.stat}><Text style={s.statValue}>{completed}</Text><Text style={s.statLabel}>Completed jobs</Text></View>
          </View>
        </ImageBackground>

        <Text style={s.overline}>YOUR WORKSPACE</Text>
        <View style={s.quickActions}>
          {actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? open(active.id) : action.route && router.push(action.route as "/(towing-company)/requests" | "/(towing-company)/towing-pricing" | "/(towing-company)/public-listing")} activeOpacity={0.78}>
            <View style={s.actionIcon}><Feather name={action.icon} size={25} color="#FFFFFF" />{action.label === "Requests" && pending.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{pending.length}</Text></View> : null}</View>
            <Text style={s.actionLabel}>{action.label}</Text>
          </TouchableOpacity>)}
        </View>

        <SectionTitle title="Current job" action="View all" onPress={() => router.push("/(towing-company)/requests")} />
        {active ? <View style={s.jobCard}>
          <View style={s.jobTop}><View style={s.onWay}><Text style={s.onWayText}>{label(active.status)}</Text></View><TouchableOpacity onPress={() => open(active.id)} accessibilityLabel="Open current job"><Feather name="more-horizontal" size={20} color={C.muted} /></TouchableOpacity></View>
          <Text style={s.customer}>{active.customerName || "Customer"}</Text>
          <Text style={s.vehicle}>{active.vehicle}{active.vehicleYear ? ` · ${active.vehicleYear}` : ""}</Text>
          <RouteLine pickup value={active.pickupLocation} />
          <RouteLine value={active.destination} />
          <View style={s.metrics}>
            <View style={s.metric}><Feather name="navigation" size={14} color={C.muted} /><Text style={s.metricText}>{active.totalDistanceKm || active.pickupToDestinationDistanceKm || 0} km total</Text></View>
            <View style={s.metric}><Feather name="credit-card" size={14} color={C.muted} /><Text style={s.metricText}>{money(active.estimatedTotalPrice || active.estimatedPrice || Number(active.startingPrice) || 0)} estimated</Text></View>
          </View>
          <TouchableOpacity style={s.primary} onPress={() => open(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>Continue Job</Text><Feather name="arrow-right" size={16} color="#fff" /></TouchableOpacity>
        </View> : <TouchableOpacity style={s.emptyJob} onPress={() => router.push("/(towing-company)/requests")} activeOpacity={0.8}>
          <View style={s.emptyJobIcon}><Feather name="truck" size={23} color={C.primary} /></View>
          <View style={s.emptyCopy}><Text style={s.emptyTitle}>No active job right now</Text><Text style={s.emptySubtitle}>Your accepted towing jobs will show here.</Text></View>
          <Feather name="chevron-right" size={20} color={C.muted} />
        </TouchableOpacity>}

        <SectionTitle title="New request" action="View all" onPress={() => router.push("/(towing-company)/requests")} />
        {pending[0] ? <TouchableOpacity style={s.requestCard} onPress={() => open(pending[0].id)} activeOpacity={0.82}>
          <View style={s.requestIcon}><Feather name="truck" size={18} color={C.primary} /></View>
          <View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{pending[0].customerName || "New customer"}</Text><Text style={s.requestDistance} numberOfLines={1}>{pending[0].pickupLocation} · {pending[0].providerToPickupDistanceKm || 0} km away</Text></View>
          <View style={s.requestArrow}><Feather name="chevron-right" size={19} color="#fff" /></View>
        </TouchableOpacity> : <TouchableOpacity style={s.emptyRequest} onPress={() => router.push("/(towing-company)/requests")} activeOpacity={0.8}>
          <View style={s.emptyJobIcon}><Feather name="inbox" size={22} color={C.primary} /></View>
          <View style={s.emptyCopy}><Text style={s.emptyTitle}>No new requests yet</Text><Text style={s.emptySubtitle}>{online ? "New customer requests will appear here." : "Go online to start receiving requests."}</Text></View>
          <Feather name="chevron-right" size={20} color={C.muted} />
        </TouchableOpacity>}

        <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(towing-company)/public-listing")} activeOpacity={0.8}>
          <View style={s.listingIcon}><Feather name="truck" size={17} color={C.primary} /></View>
          <View style={s.listingCopy}><Text style={s.listingTitle}>Keep your service details up to date</Text><Text style={s.listingSubtitle}>This helps customers find and trust your service.</Text></View>
          <View style={s.editListingButton}><Text style={s.editListing}>Edit listing</Text><Feather name="chevron-right" size={12} color="#FFFFFF" /></View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity onPress={onPress} style={s.viewAll}><Text style={s.viewAllText}>{action}</Text><Feather name="chevron-right" size={15} color="#FFFFFF" /></TouchableOpacity></View>;
}

function RouteLine({ pickup, value }: { pickup?: boolean; value: string }) {
  return <View style={s.routeRow}><View style={[s.routeDot, pickup && s.pickupDot]} /><Text style={s.routeText} numberOfLines={1}>{value}</Text>{pickup ? <Text style={s.routeLabel}>Pickup</Text> : <Text style={s.routeLabel}>Drop off</Text>}</View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  header: { backgroundColor: C.primary, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16 },
  brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  notificationBadge: { position: "absolute", top: 2, right: 0, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notificationBadgeText: { color: C.primary, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  hero: { borderRadius: 20, minHeight: 178, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, borderWidth: 1, overflow: "hidden", ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, heroImage: { borderRadius: 20, opacity: 0.9 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, heroOnline: { backgroundColor: C.primary, borderColor: C.primaryDark }, heroOffline: { backgroundColor: C.primaryDark, borderColor: C.primaryDark },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, heroCopy: { flex: 1, paddingRight: 2 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 31, marginTop: 5 }, heroHint: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, marginTop: 2 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F4A45D", marginRight: 7 }, statusDotOnline: { backgroundColor: "#5DE0A0" },
  availabilityToggle: { minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingLeft: 10, paddingRight: 4 }, availableLabel: { color: C.text, fontSize: 13, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.02 }, { scaleY: 1.02 }], width: 50, marginLeft: 1, marginRight: -1 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 17 }, statValue: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" }, statLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  overline: { color: C.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 20, marginBottom: 12 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 0 }, quickAction: { alignItems: "center", width: "19%", minHeight: 86 }, actionIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.primary, borderWidth: 1, borderColor: C.primary, alignItems: "center", justifyContent: "center", position: "relative", ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 2 }, default: {} }) }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: C.primary, fontSize: 12, fontWeight: "800" }, actionLabel: { color: C.secondary, fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 7, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 12, paddingHorizontal: 0, minHeight: 40 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, viewAll: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.primary }, viewAllText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 20, padding: 16, minHeight: 0, borderWidth: 1, borderColor: C.line, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, onWay: { backgroundColor: "#FDECEF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, onWayText: { color: C.red, fontSize: 13, lineHeight: 18, fontWeight: "700" }, customer: { color: C.text, fontSize: 18, lineHeight: 25, fontWeight: "700", marginTop: 8 }, vehicle: { color: C.secondary, fontSize: 14, lineHeight: 20, marginTop: 3, marginBottom: 8 },
  routeRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9 }, routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginLeft: 2 }, pickupDot: { backgroundColor: C.primary }, routeText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }, routeLabel: { color: C.secondary, fontSize: 12 }, metrics: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 10, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }, metric: { flexDirection: "row", alignItems: "center", gap: 7 }, metricText: { color: C.secondary, fontSize: 12, lineHeight: 18 },
  primary: { height: 54, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, primaryText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  emptyJob: { minHeight: 104, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyRequest: { minHeight: 104, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyJobIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, emptySubtitle: { color: C.secondary, fontSize: 13, lineHeight: 18 },
  requestCard: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, requestIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#FDECEF", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1, gap: 2 }, requestName: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, requestDistance: { color: C.secondary, fontSize: 12, lineHeight: 18 }, requestArrow: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  listingHint: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginTop: 0, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, listingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1, gap: 2, minWidth: 0 }, listingTitle: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }, listingSubtitle: { color: C.secondary, fontSize: 12, lineHeight: 17 }, editListing: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },

scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
editListingButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.primary },
});
