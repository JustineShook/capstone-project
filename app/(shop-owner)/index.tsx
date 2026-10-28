import { Feather } from "@expo/vector-icons";
import { AccountActionWarning } from "../../components/AccountActionWarning";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { ShopNotificationBell } from "../../components/shop-owner/ShopNotificationBell";
import { setShopAvailability } from "../../services/shopOwnerService";
import { getShopVerificationProfile, syncApprovedShopProviderProfile } from "../../services/shopVerificationService";
import { isActiveShopService, SHOP_STATUS_LABELS, type ShopBookingRequest } from "../../types/shopBooking";
import { useActionRisk } from "../../hooks/useActionRisk";

const C = { canvas: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", red: "#F52239", line: "#28313A", green: "#39D98A", amber: "#F4A45D" };
function label(status: ShopBookingRequest["status"]) { return SHOP_STATUS_LABELS[status]; }

export default function ShopOwnerDashboard() {
  const actionRisk = useActionRisk("provider");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, profile, requests, profileLoading, requestsLoading, profileError, requestsError, retry } = useShopDashboard();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncAttempted, setSyncAttempted] = useState(false);
  const locked = useRef(false);
  const pending = requests.filter((item) => item.status === "pending");
  const active = useMemo(() => requests.find((item) => isActiveShopService(item.status)), [requests]);
  const completed = requests.filter((item) => item.status === "completed").length;
  useEffect(() => {
    if (profileLoading || !profile || profile.verified === true || syncAttempted) return;
    let active = true;
    setSyncAttempted(true);
    void getShopVerificationProfile(profile.uid)
      .then(async (verification) => {
        if (verification?.verificationStatus === "VERIFIED") {
          await syncApprovedShopProviderProfile(profile.uid, verification);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not sync your approved shop profile.");
      });
    return () => { active = false; };
  }, [profile, profileLoading, syncAttempted]);
  const toggle = async (open: boolean) => {
    if (locked.current) return;
    if (open && profile && profile.verified !== true) {
      setError("Your shop needs administrator approval before you can open it.");
      return;
    }
    locked.current = true; setSaving(true); setError(null);
    try { await setShopAvailability(open ? "open" : "closed"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save availability."); }
    finally { locked.current = false; setSaving(false); }
  };
  const open = (id: string) => router.push({ pathname: "/(shop-owner)/request-details", params: { id } });
  const actions = [
    { icon: "clipboard" as const, label: "Requests", route: "/(shop-owner)/requests" },
    { icon: "tool" as const, label: "Active Job", route: null, job: true },
    { icon: "dollar-sign" as const, label: "Earnings", route: "/(shop-owner)/earnings" },
    { icon: "home" as const, label: "Public Listing", route: "/(shop-owner)/public-listing" },
  ];

  if (profileLoading || requestsLoading) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}><ActivityIndicator size="large" color={C.red} /><Text style={s.stateText}>Loading dashboard...</Text></View></SafeAreaView>;
  if (profileError || requestsError || !profile) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}><Feather name="alert-circle" size={32} color={C.red} /><Text style={s.stateText}>{profileError || requestsError || "Your shop profile is unavailable."}</Text><TouchableOpacity style={s.retry} onPress={retry}><Text style={s.primaryText}>Try Again</Text></TouchableOpacity></View></SafeAreaView>;

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><ShopNotificationBell style={s.bell} size={25} color={C.text} /></View>
      <AccountActionWarning count={actionRisk.count} error={actionRisk.error} />

      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} imageStyle={s.heroImage} style={[s.hero, profile.status === "open" ? s.heroOpen : s.heroClosed]}>
        <View style={s.heroShade} />
        <View style={s.heroTop}><View style={s.heroCopy}><View style={s.locationRow}><Feather name="map-pin" size={14} color={profile.status === "open" ? C.green : C.amber} /><Text style={s.locationLabel} numberOfLines={1}>{profile.address || "Auto shop"}</Text></View><Text style={s.heroTitle}>{profile.status === "open" ? "Ready to assist" : "Shop is closed"}</Text><Text style={s.heroHint}>{saving ? "Saving availability..." : profile.status === "open" ? "Your shop is accepting requests." : "Open your shop to receive requests."}</Text></View>
          <View style={s.availabilityToggle}><View style={[s.statusDot, profile.status === "open" && s.statusDotOpen]} /><Text style={s.availableLabel}>{profile.status === "open" ? "Open" : "Closed"}</Text><Switch value={profile.status === "open"} onValueChange={(value) => void toggle(value)} disabled={saving} trackColor={{ false: "#686A6E", true: "#FFFFFF" }} thumbColor={profile.status === "open" ? C.red : "#F3F3F3"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{pending.length}</Text><Text style={s.statLabel}>New requests</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completed}</Text><Text style={s.statLabel}>Completed jobs</Text></View></View>
      </ImageBackground>
      {profile.verified !== true && <TouchableOpacity style={s.verificationCard} onPress={() => router.push("/(shop-owner)/verification")} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Open Auto Shop verification">
        <View style={s.verificationIcon}><Feather name="shield" size={21} color={C.amber} /></View>
        <View style={s.verificationCopy}><Text style={s.verificationTitle}>Shop verification required</Text><Text style={s.verificationHint}>Submit your business details for review to open your shop and accept requests.</Text><Text style={s.verificationLink}>Go to verification <Feather name="arrow-right" size={13} color={C.red} /></Text></View>
        <Feather name="chevron-right" size={20} color={C.muted} />
      </TouchableOpacity>}
      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.overline}>QUICK ACTIONS</Text>
      <View style={s.quickActions}>{actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? open(active.id) : action.route && router.push(action.route as "/(shop-owner)/requests" | "/(shop-owner)/earnings" | "/(shop-owner)/public-listing")} activeOpacity={0.78}><View style={s.actionIcon}><Feather name={action.icon} size={25} color={C.red} />{action.label === "Requests" && pending.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{pending.length}</Text></View> : null}</View><Text style={s.actionLabel} numberOfLines={2}>{action.label}</Text></TouchableOpacity>)}</View>

      <SectionTitle title="Current job" onPress={() => router.push("/(shop-owner)/requests")} />
      {active ? <View style={s.jobCard}><View style={s.jobTop}><View style={s.status}><Text style={s.statusText}>{label(active.status)}</Text></View><TouchableOpacity onPress={() => open(active.id)} accessibilityLabel="Open current job"><Feather name="more-horizontal" size={23} color={C.muted} /></TouchableOpacity></View>
        <Text style={s.customer}>{active.customerName || "Customer"}</Text><Text style={s.vehicle}>{active.vehicle}</Text>
        <View style={s.routeRow}><View style={s.routeDot} /><Text style={s.routeText} numberOfLines={1}>{active.shopAreaLabel || profile.address || "Shop location"}</Text><Text style={s.routeLabel}>Shop</Text></View>
        <View style={s.routeRow}><View style={[s.routeDot, s.destinationDot]} /><Text style={s.routeText} numberOfLines={1}>{active.customerAddress || "Customer location"}</Text><Text style={s.routeLabel}>Customer</Text></View>
        <View style={s.concern}><Feather name="message-square" size={17} color={C.muted} /><Text style={s.concernText} numberOfLines={2}>{active.problem}</Text></View>
        <TouchableOpacity style={s.primary} onPress={() => open(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>Continue Service</Text><Feather name="arrow-right" size={18} color="#F7EFED" /></TouchableOpacity>
      </View> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(shop-owner)/requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="tool" size={24} color={C.red} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No active service</Text><Text style={s.emptyHint}>Accepted customer jobs will appear here.</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <SectionTitle title="New request" onPress={() => router.push("/(shop-owner)/requests")} />
      {pending[0] ? <TouchableOpacity style={s.requestCard} onPress={() => open(pending[0].id)} activeOpacity={0.8}><View style={s.requestIcon}><Feather name="tool" size={22} color={C.red} /></View><View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{pending[0].customerName || "New customer"}</Text><Text style={s.requestHint} numberOfLines={1}>{pending[0].vehicle} · {pending[0].shopAreaLabel || "Shop service request"}</Text></View><View style={s.requestArrow}><Feather name="chevron-right" size={20} color="#F7EFED" /></View></TouchableOpacity> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(shop-owner)/requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="inbox" size={23} color={C.red} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No new requests yet</Text><Text style={s.emptyHint}>{profile.status === "open" ? "New customer requests will appear here." : "Open your shop to start receiving requests."}</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(shop-owner)/public-listing")} activeOpacity={0.8}><View style={s.listingIcon}><Feather name="home" size={20} color={C.red} /></View><View style={s.listingCopy}><Text style={s.listingTitle}>Keep your shop details up to date</Text><Text style={s.listingSubtitle}>Help customers find and trust your service.</Text></View><Text style={s.editListing}>Edit listing <Feather name="chevron-right" size={14} color={C.red} /></Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) { return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity style={s.viewAll} onPress={onPress}><Text style={s.viewAllText}>View all</Text><Feather name="chevron-right" size={17} color={C.red} /></TouchableOpacity></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, lineHeight: 24, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 15 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 38, lineHeight: 44, fontWeight: "900", fontStyle: "italic", marginRight: 7 }, brand: { color: C.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", position: "relative" },
  hero: { minHeight: 178, borderRadius: 20, paddingHorizontal: 21, paddingTop: 20, paddingBottom: 17, borderWidth: 1, overflow: "hidden" }, heroImage: { borderRadius: 20, opacity: 0.55 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,14,18,0.58)" }, heroOpen: { backgroundColor: "#13251F", borderColor: "#26533D" }, heroClosed: { backgroundColor: "#211B19", borderColor: "#54372C" }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1, paddingRight: 6 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#D7E1E8", fontSize: 14, lineHeight: 22, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 35, fontWeight: "800", marginTop: 5 }, heroHint: { color: "#C5D0D7", fontSize: 14, lineHeight: 20, marginTop: 2 }, availabilityToggle: { minHeight: 48, backgroundColor: "#F7F9FA", borderRadius: 25, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 5 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber, marginRight: 7 }, statusDotOpen: { backgroundColor: C.green }, availableLabel: { color: "#252525", fontSize: 14, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.04 }, { scaleY: 1.04 }], width: 52, marginLeft: 1, marginRight: -1 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 17 }, statValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 38, fontWeight: "800" }, statLabel: { color: "#C5D0D7", fontSize: 13, lineHeight: 19, fontWeight: "600" }, error: { color: "#FF9AA8", fontSize: 15, lineHeight: 21, marginTop: 10 },
  verificationCard: { minHeight: 106, flexDirection: "row", alignItems: "center", gap: 13, padding: 15, marginTop: 12, borderRadius: 16, backgroundColor: "#241C17", borderWidth: 1, borderColor: "#59412C" }, verificationIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#38291C" }, verificationCopy: { flex: 1, gap: 4 }, verificationTitle: { color: C.text, fontSize: 16, fontWeight: "800" }, verificationHint: { color: C.muted, fontSize: 13, lineHeight: 18 }, verificationLink: { color: "#FF6678", fontSize: 13, fontWeight: "800", marginTop: 3 },
  overline: { color: "#9AA8B3", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginTop: 21, marginBottom: 13 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 1 }, quickAction: { width: "24%", minHeight: 90, alignItems: "center" }, actionIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#18222B", borderWidth: 1, borderColor: "#283744", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, actionLabel: { color: "#DCE3E8", fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center", marginTop: 7 },
  sectionHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", marginTop: 23, marginBottom: 12, paddingHorizontal: 3 }, sectionTitle: { color: C.text, fontSize: 23, lineHeight: 31, fontWeight: "800" }, viewAll: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", paddingHorizontal: 5 }, viewAllText: { color: "#FF6678", fontSize: 16, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 17, padding: 20, minHeight: 300 }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: "#263541" }, statusText: { color: C.text, fontSize: 14, lineHeight: 19, fontWeight: "700" }, customer: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: "800", marginTop: 8 }, vehicle: { color: "#D0D8DE", fontSize: 18, lineHeight: 25, marginTop: 4, marginBottom: 11 }, routeRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 }, routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red, marginLeft: 2 }, destinationDot: { backgroundColor: "#8F9296" }, routeText: { color: "#FFFFFF", flex: 1, fontSize: 17, lineHeight: 23 }, routeLabel: { color: "#C0C8CE", fontSize: 14 }, concern: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: C.line, marginTop: 8, paddingTop: 11 }, concernText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, flex: 1 }, primary: { minHeight: 54, backgroundColor: C.red, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 13 }, primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  emptyCard: { minHeight: 138, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", gap: 15 }, emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#1A2A36", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 7 }, emptyTitle: { color: C.text, fontSize: 18, lineHeight: 25, fontWeight: "700" }, emptyHint: { color: "#AAB5C0", fontSize: 14, lineHeight: 20 }, requestCard: { minHeight: 90, borderRadius: 15, backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 14 }, requestIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#1A2A36", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 19, lineHeight: 26, fontWeight: "700" }, requestHint: { color: "#C0C8CE", fontSize: 15, lineHeight: 21, marginTop: 4 }, requestArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }, listingHint: { minHeight: 80, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginTop: 14, paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 13 }, listingIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#1A2A36", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1, gap: 3 }, listingTitle: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, listingSubtitle: { color: "#AAB5C0", fontSize: 14, lineHeight: 20 }, editListing: { color: "#FF6678", fontSize: 14, fontWeight: "700" },
});
