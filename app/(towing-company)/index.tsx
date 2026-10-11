import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { getPublicProviderListing, updatePublicProviderListing } from "../../services/publicProviderListingService";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import { subscribeToTowingNotifications } from "../../services/towingNotificationService";
import type { TowingBookingRequest } from "../../types/owner/towing";
import type { PublicProviderListingInput } from "../../types/providerListing";

const C = { canvas: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", red: "#F52239", line: "#28313A", green: "#39D98A", blue: "#54B8FF" };
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
  const completed = useMemo(() => bookings.filter((booking) => booking.status === "completed").length, [bookings]);
  const open = (id: string) => router.push({ pathname: "/(towing-company)/request-details", params: { id } });

  const toggleAvailability = async (next: boolean) => {
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
      await updatePublicProviderListing(uid, "towing-company", {
        ...listingSettings,
        availability: next ? "available" : "offline",
      });
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
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"} onPress={() => router.push("/(towing-company)/notifications")} style={s.bell}>
            <Feather name="bell" size={26} color={C.text} />
            {unreadNotifications > 0 && <View style={s.notificationBadge}><Text style={s.notificationBadgeText}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text></View>}
          </TouchableOpacity>
        </View>

        <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.heroImage} style={[s.hero, online ? s.heroOnline : s.heroOffline]}>
          <View style={s.heroShade} />
          <View style={s.heroTop}>
            <View style={s.heroCopy}>
              <View style={s.locationRow}><Feather name="map-pin" size={13} color={online ? C.green : "#F4A45D"} /><Text style={s.locationLabel} numberOfLines={1}>{listingSettings?.serviceAreaLabel || "Towing provider"}</Text></View>
              <Text style={s.heroTitle}>{online ? "Ready to assist" : "You're offline"}</Text>
              <Text style={s.heroHint}>{online ? "Your towing service is online." : "Go online to receive new requests."}</Text>
            </View>
            <View style={s.availabilityToggle}>
              <View style={[s.statusDot, online && s.statusDotOnline]} /><Text style={s.availableLabel}>{online ? "Online" : "Offline"}</Text>
              <Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={!availabilityLoaded || savingAvailability} trackColor={{ false: "#686A6E", true: "#FFFFFF" }} thumbColor={online ? C.red : "#F3F3F3"} style={s.switch} />
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
            <View style={s.actionIcon}><Feather name={action.icon} size={25} color={C.red} />{action.label === "Requests" && pending.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{pending.length}</Text></View> : null}</View>
            <Text style={s.actionLabel} numberOfLines={1}>{action.label}</Text>
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
          <View style={s.emptyJobIcon}><Feather name="truck" size={23} color={C.red} /></View>
          <View style={s.emptyCopy}><Text style={s.emptyTitle}>No active job right now</Text><Text style={s.emptySubtitle}>Your accepted towing jobs will show here.</Text></View>
          <Feather name="chevron-right" size={20} color={C.muted} />
        </TouchableOpacity>}

        <SectionTitle title="New request" action="View all" onPress={() => router.push("/(towing-company)/requests")} />
        {pending[0] ? <TouchableOpacity style={s.requestCard} onPress={() => open(pending[0].id)} activeOpacity={0.82}>
          <View style={s.requestIcon}><Feather name="truck" size={18} color={C.red} /></View>
          <View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{pending[0].customerName || "New customer"}</Text><Text style={s.requestDistance} numberOfLines={1}>{pending[0].pickupLocation} · {pending[0].providerToPickupDistanceKm || 0} km away</Text></View>
          <View style={s.requestArrow}><Feather name="chevron-right" size={19} color="#fff" /></View>
        </TouchableOpacity> : <TouchableOpacity style={s.emptyRequest} onPress={() => router.push("/(towing-company)/requests")} activeOpacity={0.8}>
          <View style={s.emptyJobIcon}><Feather name="inbox" size={22} color={C.red} /></View>
          <View style={s.emptyCopy}><Text style={s.emptyTitle}>No new requests yet</Text><Text style={s.emptySubtitle}>{online ? "New customer requests will appear here." : "Go online to start receiving requests."}</Text></View>
          <Feather name="chevron-right" size={20} color={C.muted} />
        </TouchableOpacity>}

        <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(towing-company)/public-listing")} activeOpacity={0.8}>
          <View style={s.listingIcon}><Feather name="truck" size={17} color={C.red} /></View>
          <View style={s.listingCopy}><Text style={s.listingTitle}>Keep your service details up to date</Text><Text style={s.listingSubtitle}>This helps customers find and trust your service.</Text></View>
          <Text style={s.editListing}>Edit listing <Feather name="chevron-right" size={12} color={C.red} /></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity onPress={onPress} style={s.viewAll}><Text style={s.viewAllText}>{action}</Text><Feather name="chevron-right" size={15} color={C.red} /></TouchableOpacity></View>;
}

function RouteLine({ pickup, value }: { pickup?: boolean; value: string }) {
  return <View style={s.routeRow}><View style={[s.routeDot, pickup && s.pickupDot]} /><Text style={s.routeText} numberOfLines={1}>{value}</Text>{pickup ? <Text style={s.routeLabel}>Pickup</Text> : <Text style={s.routeLabel}>Drop off</Text>}</View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  content: { paddingHorizontal: 18, paddingTop: 3, paddingBottom: 24 },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 },
  brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", position: "relative" },
  notificationBadge: { position: "absolute", top: 2, right: 0, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 14, fontWeight: "800" },
  hero: { borderRadius: 20, minHeight: 178, paddingHorizontal: 21, paddingTop: 20, paddingBottom: 17, borderWidth: 1, overflow: "hidden" }, heroImage: { borderRadius: 20, opacity: 0.55 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,14,18,0.55)" }, heroOnline: { backgroundColor: "#13251F", borderColor: "#26533D" }, heroOffline: { backgroundColor: "#211B19", borderColor: "#54372C" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1, paddingRight: 5 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#D7E1E8", fontSize: 14, lineHeight: 22, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#fff", fontSize: 27, fontWeight: "800", lineHeight: 35, marginTop: 5 }, heroHint: { color: "#C5D0D7", fontSize: 14, lineHeight: 20, marginTop: 2 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F4A45D", marginRight: 7 }, statusDotOnline: { backgroundColor: C.green },
  availabilityToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: "#F7F9FA", borderRadius: 25, paddingLeft: 12, paddingRight: 5 }, availableLabel: { color: "#252525", fontSize: 14, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.04 }, { scaleY: 1.04 }], width: 52, marginLeft: 1, marginRight: -1 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 17 }, statValue: { color: "#fff", fontSize: 32, lineHeight: 38, fontWeight: "800" }, statLabel: { color: "#C5D0D7", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  overline: { color: "#9AA8B3", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginTop: 21, marginBottom: 13 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 1 }, quickAction: { alignItems: "center", width: "19%", minHeight: 90 }, actionIcon: { width: 55, height: 55, borderRadius: 18, backgroundColor: "#18222B", borderWidth: 1, borderColor: "#283744", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" }, actionLabel: { color: "#DCE3E8", fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 7, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 23, marginBottom: 12, paddingHorizontal: 3, minHeight: 38 }, sectionTitle: { color: C.text, fontSize: 21, lineHeight: 28, fontWeight: "800" }, viewAll: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 5 }, viewAllText: { color: "#FF6678", fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: "#283744", padding: 17 }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, onWay: { backgroundColor: "#A91225", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6 }, onWayText: { color: "#fff", fontSize: 12, lineHeight: 17, fontWeight: "700" }, customer: { color: C.text, fontSize: 20, lineHeight: 27, fontWeight: "800", marginTop: 8 }, vehicle: { color: "#D0D8DE", fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: 8 },
  routeRow: { minHeight: 37, flexDirection: "row", alignItems: "center", gap: 9 }, routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#B3C0C9", marginLeft: 2 }, pickupDot: { backgroundColor: C.red }, routeText: { color: "#E7EDF1", fontSize: 14, lineHeight: 20, flex: 1 }, routeLabel: { color: C.muted, fontSize: 12 }, metrics: { borderTopWidth: 1, borderTopColor: "#303B45", marginTop: 11, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 7, flexWrap: "wrap" }, metric: { flexDirection: "row", alignItems: "center", gap: 7 }, metricText: { color: "#C5D0D7", fontSize: 13, lineHeight: 19 },
  primary: { minHeight: 48, borderRadius: 10, backgroundColor: C.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 13 }, primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  emptyJob: { minHeight: 115, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: "#283744", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 13 }, emptyRequest: { minHeight: 112, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: "#283744", paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", gap: 13 }, emptyJobIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#1C3444", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, emptySubtitle: { color: C.muted, fontSize: 13, lineHeight: 19 },
  requestCard: { minHeight: 78, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: "#283744", paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 12 }, requestIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#281B20", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, requestDistance: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 3 }, requestArrow: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  listingHint: { minHeight: 72, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: "#283744", marginTop: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11 }, listingIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#281B20", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1 }, listingTitle: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }, listingSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 }, editListing: { color: "#FF6678", fontSize: 12, fontWeight: "700" },
});
