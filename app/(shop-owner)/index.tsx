import { Platform } from "react-native";
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

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", line: "#D5DEE9", green: "#166534", blue: "#0F52BA", primary: "#0F52BA", primaryDark: "#0B3D8A", secondary: "#475569", subtle: "#F1F5F9", shadow: "#000000", amber: "#9A5B00" };
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

  if (profileLoading || requestsLoading) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.primary} /><View style={s.state}><ActivityIndicator size="large" color={C.primary} /><Text style={s.stateText}>Loading dashboard...</Text></View></SafeAreaView>;
  if (profileError || requestsError || !profile) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.primary} /><View style={s.state}><Feather name="alert-circle" size={32} color={C.primary} /><Text style={s.stateText}>{profileError || requestsError || "Your shop profile is unavailable."}</Text><TouchableOpacity style={s.retry} onPress={retry}><Text style={s.primaryText}>Try Again</Text></TouchableOpacity></View></SafeAreaView>;

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={[s.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><ShopNotificationBell appearance="light" style={s.bell} size={25} color="#FFFFFF" /></View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>

      <AccountActionWarning count={actionRisk.count} error={actionRisk.error} />

      <ImageBackground source={require("../../assets/images/autoshop-sapphire.png")} imageStyle={s.heroImage} style={[s.hero, profile.status === "open" ? s.heroOpen : s.heroClosed]}>
        <View style={s.heroShade} />
        <View style={s.heroTop}><View style={s.heroCopy}><View style={s.locationRow}><Feather name="map-pin" size={14} color={profile.status === "open" ? C.green : C.amber} /><Text style={s.locationLabel} numberOfLines={1}>{profile.address || "Auto shop"}</Text></View><Text style={s.heroTitle}>{profile.status === "open" ? "Ready to assist" : "Shop is closed"}</Text><Text style={s.heroHint}>{saving ? "Saving availability..." : profile.status === "open" ? "Your shop is accepting requests." : "Open your shop to receive requests."}</Text></View>
          <View style={s.availabilityToggle}><View style={[s.statusDot, profile.status === "open" && s.statusDotOpen]} /><Text style={s.availableLabel}>{profile.status === "open" ? "Open" : "Closed"}</Text><Switch value={profile.status === "open"} onValueChange={(value) => void toggle(value)} disabled={saving} trackColor={{ false: "#D5DEE9", true: "#C9DBF6" }} thumbColor={profile.status === "open" ? C.primary : "#FFFFFF"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{pending.length}</Text><Text style={s.statLabel}>New requests</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completed}</Text><Text style={s.statLabel}>Completed jobs</Text></View></View>
      </ImageBackground>
      {profile.verified !== true && <TouchableOpacity style={s.verificationCard} onPress={() => router.push("/(shop-owner)/verification")} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Open Auto Shop verification">
        <View style={s.verificationIcon}><Feather name="shield" size={21} color={C.amber} /></View>
        <View style={s.verificationCopy}><Text style={s.verificationTitle}>Shop verification required</Text><Text style={s.verificationHint}>Submit your business details for review to open your shop and accept requests.</Text><Text style={s.verificationLink}>Go to verification <Feather name="arrow-right" size={13} color={C.primary} /></Text></View>
        <Feather name="chevron-right" size={20} color={C.muted} />
      </TouchableOpacity>}
      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.overline}>QUICK ACTIONS</Text>
      <View style={s.quickActions}>{actions.map((action) => <TouchableOpacity key={action.label} style={s.quickAction} onPress={() => action.job && active ? open(active.id) : action.route && router.push(action.route as "/(shop-owner)/requests" | "/(shop-owner)/earnings" | "/(shop-owner)/public-listing")} activeOpacity={0.78}><View style={s.actionIcon}><Feather name={action.icon} size={25} color="#FFFFFF" />{action.label === "Requests" && pending.length > 0 ? <View style={s.actionBadge}><Text style={s.actionBadgeText}>{pending.length}</Text></View> : null}</View><Text style={s.actionLabel} numberOfLines={2}>{action.label}</Text></TouchableOpacity>)}</View>

      <SectionTitle title="Current job" onPress={() => router.push("/(shop-owner)/requests")} />
      {active ? <View style={s.jobCard}><View style={s.jobTop}><View style={s.status}><Text style={s.statusText}>{label(active.status)}</Text></View><TouchableOpacity onPress={() => open(active.id)} accessibilityLabel="Open current job"><Feather name="more-horizontal" size={23} color={C.muted} /></TouchableOpacity></View>
        <Text style={s.customer}>{active.customerName || "Customer"}</Text><Text style={s.vehicle}>{active.vehicle}</Text>
        <View style={s.routeRow}><View style={s.routeDot} /><Text style={s.routeText} numberOfLines={1}>{active.shopAreaLabel || profile.address || "Shop location"}</Text><Text style={s.routeLabel}>Shop</Text></View>
        <View style={s.routeRow}><View style={[s.routeDot, s.destinationDot]} /><Text style={s.routeText} numberOfLines={1}>{active.customerAddress || "Customer location"}</Text><Text style={s.routeLabel}>Customer</Text></View>
        <View style={s.concern}><Feather name="message-square" size={17} color={C.muted} /><Text style={s.concernText} numberOfLines={2}>{active.problem}</Text></View>
        <TouchableOpacity style={s.primary} onPress={() => open(active.id)} activeOpacity={0.85}><Text style={s.primaryText}>Continue Service</Text><Feather name="arrow-right" size={18} color="#F7EFED" /></TouchableOpacity>
      </View> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(shop-owner)/requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="tool" size={24} color={C.primary} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No active service</Text><Text style={s.emptyHint}>Accepted customer jobs will appear here.</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <SectionTitle title="New request" onPress={() => router.push("/(shop-owner)/requests")} />
      {pending[0] ? <TouchableOpacity style={s.requestCard} onPress={() => open(pending[0].id)} activeOpacity={0.8}><View style={s.requestIcon}><Feather name="tool" size={22} color={C.primary} /></View><View style={s.requestCopy}><Text style={s.requestName} numberOfLines={1}>{pending[0].customerName || "New customer"}</Text><Text style={s.requestHint} numberOfLines={1}>{pending[0].vehicle} · {pending[0].shopAreaLabel || "Shop service request"}</Text></View><View style={s.requestArrow}><Feather name="chevron-right" size={20} color="#F7EFED" /></View></TouchableOpacity> : <TouchableOpacity style={s.emptyCard} onPress={() => router.push("/(shop-owner)/requests")} activeOpacity={0.8}><View style={s.emptyIcon}><Feather name="inbox" size={23} color={C.primary} /></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>No new requests yet</Text><Text style={s.emptyHint}>{profile.status === "open" ? "New customer requests will appear here." : "Open your shop to start receiving requests."}</Text></View><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>}

      <TouchableOpacity style={s.listingHint} onPress={() => router.push("/(shop-owner)/public-listing")} activeOpacity={0.8}><View style={s.listingIcon}><Feather name="home" size={20} color={C.primary} /></View><View style={s.listingCopy}><Text style={s.listingTitle}>Keep your shop details up to date</Text><Text style={s.listingSubtitle}>Help customers find and trust your service.</Text></View><View style={s.editListingButton}><Text style={s.editListing}>Edit listing</Text><Feather name="chevron-right" size={14} color="#FFFFFF" /></View></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) { return <View style={s.sectionHeader}><Text style={s.sectionTitle}>{title}</Text><TouchableOpacity style={s.viewAll} onPress={onPress}><Text style={s.viewAllText}>View all</Text><Feather name="chevron-right" size={17} color="#FFFFFF" /></TouchableOpacity></View>; }

const s = StyleSheet.create({
  editListingButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.primary },
  safe: { flex: 1, backgroundColor: C.primary }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 ,backgroundColor: C.canvas}, stateText: { color: C.muted, fontSize: 17, lineHeight: 24, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 15 },
  header: { backgroundColor: C.primary, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 20, minHeight: 178, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, borderWidth: 1, overflow: "hidden", ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, heroImage: { borderRadius: 20, opacity: 0.9 }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, heroOpen: { backgroundColor: C.primary, borderColor: C.primaryDark }, heroClosed: { backgroundColor: C.primaryDark, borderColor: C.primaryDark }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, heroCopy: { flex: 1, paddingRight: 2 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 5 }, locationLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600", flexShrink: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 31, marginTop: 5 }, heroHint: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, marginTop: 2 }, availabilityToggle: { minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingLeft: 10, paddingRight: 4 }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F4A45D", marginRight: 7 }, statusDotOpen: { backgroundColor: "#5DE0A0" }, availableLabel: { color: C.text, fontSize: 13, fontWeight: "700" }, switch: { transform: [{ scaleX: 1.02 }, { scaleY: 1.02 }], width: 50, marginLeft: 1, marginRight: -1 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 14, marginBottom: 10 }, stats: { minHeight: 50, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 17 }, statValue: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" }, statLabel: { color: "#EAF2FF", fontSize: 13, lineHeight: 19, fontWeight: "600" }, error: { color: C.red, fontSize: 15, lineHeight: 21, marginTop: 10 },
  verificationCard: { minHeight: 106, flexDirection: "row", alignItems: "center", gap: 13, padding: 16, marginTop: 12, borderRadius: 20, backgroundColor: "#FFF4E5", borderWidth: 1, borderColor: "#F4D28A" }, verificationIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FEF3C7" }, verificationCopy: { flex: 1, gap: 4 }, verificationTitle: { color: "#9A5B00", fontSize: 16, fontWeight: "700" ,lineHeight: 22}, verificationHint: { color: C.muted, fontSize: 13, lineHeight: 18 }, verificationLink: { color: C.primary, fontSize: 13, fontWeight: "800", marginTop: 3 },
  overline: { color: C.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 20, marginBottom: 12 }, quickActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 0 }, quickAction: { alignItems: "center", width: "24%", minHeight: 86 }, actionIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.primary, borderWidth: 1, borderColor: C.primary, alignItems: "center", justifyContent: "center", position: "relative", ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 2 }, default: {} }) }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, actionLabel: { color: C.secondary, fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 7, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 12, paddingHorizontal: 0, minHeight: 40 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, viewAll: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.primary }, viewAllText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 20, padding: 16, minHeight: 0, borderWidth: 1, borderColor: C.line, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, jobTop: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { backgroundColor: "#FDECEF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }, statusText: { color: C.red, fontSize: 13, lineHeight: 18, fontWeight: "700" }, customer: { color: C.text, fontSize: 18, lineHeight: 25, fontWeight: "700", marginTop: 8 }, vehicle: { color: C.secondary, fontSize: 14, lineHeight: 20, marginTop: 3, marginBottom: 8 }, routeRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9 }, routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginLeft: 2 }, destinationDot: { backgroundColor: C.primary }, routeText: { color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }, routeLabel: { color: C.secondary, fontSize: 12 }, concern: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 2 }, concernText: { color: C.secondary, fontSize: 14, lineHeight: 20, flex: 1 }, primary: { height: 54, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, primaryText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  emptyCard: { minHeight: 104, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EAF2FF", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, emptyHint: { color: C.secondary, fontSize: 13, lineHeight: 18 }, requestCard: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 13, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, requestIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#FDECEF", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1, gap: 2 }, requestName: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, requestHint: { color: C.secondary, fontSize: 12, lineHeight: 18 }, requestArrow: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }, listingHint: { minHeight: 72, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginTop: 0, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, ...Platform.select({ ios: { shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, listingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1, gap: 2, minWidth: 0 }, listingTitle: { color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }, listingSubtitle: { color: C.secondary, fontSize: 12, lineHeight: 17 }, editListing: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },

scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
});
