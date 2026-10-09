import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { getPublicProviderListing, updatePublicProviderListing } from "../../services/publicProviderListingService";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";
import type { PublicProviderListingInput } from "../../types/providerListing";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", red: "#F52239", line: "#303135" };
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
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [listingSettings, setListingSettings] = useState<ListingSettings | null>(null);
  const [bookings, setBookings] = useState<TowingBookingRequest[]>([]);

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
      }).catch(() => undefined);
    }
    return () => { alive = false; stop(); };
  }, []);

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
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/requests")} style={s.bell}><Feather name="bell" size={26} color={C.text} /></TouchableOpacity>
        </View>

        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.heroCopy}>
              <Text style={s.locationLabel}>{listingSettings?.serviceAreaLabel || "Towing provider"}</Text>
              <Text style={s.heroTitle}>{online ? "Ready to assist" : "You're offline"}</Text>
              <Text style={s.heroHint}>{online ? "Your towing service is online." : "Go online to receive new requests."}</Text>
            </View>
            <View style={s.availabilityToggle}>
              <Text style={s.availableLabel}>{online ? "Available" : "Offline"}</Text>
              <Switch value={online} onValueChange={(value) => void toggleAvailability(value)} disabled={savingAvailability} trackColor={{ false: "#686A6E", true: "#FFFFFF" }} thumbColor={online ? C.red : "#F3F3F3"} style={s.switch} />
            </View>
          </View>
          <View style={s.heroDivider} />
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statValue}>{pending.length}</Text><Text style={s.statLabel}>Requests today</Text></View>
            <View style={s.statDivider} />
            <View style={s.stat}><Text style={s.statValue}>{completed}</Text><Text style={s.statLabel}>Completed today</Text></View>
          </View>
        </View>

        <Text style={s.overline}>QUICK ACTIONS</Text>
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
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 },
  brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 38, lineHeight: 44, fontWeight: "900", fontStyle: "italic", marginRight: 7 }, brand: { color: C.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: C.red, borderRadius: 20, minHeight: 178, paddingHorizontal: 21, paddingTop: 20, paddingBottom: 17 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1 }, locationLabel: { color: "#FFFFFF", fontSize: 16, lineHeight: 23, fontWeight: "500" }, heroTitle: { color: "#fff", fontSize: 29, fontWeight: "800", lineHeight: 37 }, heroHint: { color: "#FFFFFF", fontSize: 16, lineHeight: 23 },
  availabilityToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 25, paddingLeft: 14, paddingRight: 5 }, availableLabel: { color: "#252525", fontSize: 15, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.04 }, { scaleY: 1.04 }], width: 52, marginLeft: 3, marginRight: -1 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.3)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.38)", marginHorizontal: 17 }, statValue: { color: "#fff", fontSize: 34, lineHeight: 39, fontWeight: "800" }, statLabel: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  overline: { color: "#C4C5C8", fontSize: 15, fontWeight: "800", letterSpacing: 1.1, marginTop: 21, marginBottom: 13 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 1 }, quickAction: { alignItems: "center", width: "19%", minHeight: 90 }, actionIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#202124", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" }, actionLabel: { color: "#FFFFFF", fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 7, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 23, marginBottom: 12, paddingHorizontal: 3, minHeight: 38 }, sectionTitle: { color: C.text, fontSize: 23, lineHeight: 31, fontWeight: "800" }, viewAll: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 5 }, viewAllText: { color: "#FF6678", fontSize: 16, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 17, padding: 20, minHeight: 300 }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, onWay: { backgroundColor: "#A91225", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7 }, onWayText: { color: "#fff", fontSize: 14, lineHeight: 19, fontWeight: "700" }, customer: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: "800", marginTop: 8 }, vehicle: { color: "#D0D1D3", fontSize: 18, lineHeight: 25, marginTop: 4, marginBottom: 11 },
  routeRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 10 }, routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#C0C1C4", marginLeft: 2 }, pickupDot: { backgroundColor: C.red }, routeText: { color: "#FFFFFF", fontSize: 17, lineHeight: 23, flex: 1 }, routeLabel: { color: "#C0C1C4", fontSize: 14 }, metrics: { borderTopWidth: 1, borderTopColor: "#3A3B3F", marginTop: 13, paddingTop: 14, flexDirection: "row", justifyContent: "space-between", gap: 7, flexWrap: "wrap" }, metric: { flexDirection: "row", alignItems: "center", gap: 8 }, metricText: { color: "#FFFFFF", fontSize: 15, lineHeight: 21 },
  primary: { minHeight: 54, borderRadius: 10, backgroundColor: C.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 13 }, primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  emptyJob: { minHeight: 138, borderRadius: 17, backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", gap: 15 }, emptyRequest: { minHeight: 132, borderRadius: 17, backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 19, flexDirection: "row", alignItems: "center", gap: 15 }, emptyJobIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 7 }, emptyTitle: { color: C.text, fontSize: 20, lineHeight: 27, fontWeight: "700" }, emptySubtitle: { color: "#C0C1C4", fontSize: 16, lineHeight: 23 },
  requestCard: { minHeight: 90, borderRadius: 15, backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 14 }, requestIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 19, lineHeight: 26, fontWeight: "700" }, requestDistance: { color: "#C0C1C4", fontSize: 15, lineHeight: 21, marginTop: 4 }, requestArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  listingHint: { minHeight: 76, borderRadius: 13, backgroundColor: C.card, marginTop: 14, paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 13 }, listingIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1 }, listingTitle: { color: C.text, fontSize: 14, fontWeight: "700", lineHeight: 20 }, listingSubtitle: { color: "#C0C1C4", fontSize: 13, lineHeight: 18 }, editListing: { color: "#FF6678", fontSize: 14, fontWeight: "700" },
});
