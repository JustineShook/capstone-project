import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { setShopAvailability } from "../../services/shopOwnerService";
import { isActiveShopService, SHOP_STATUS_LABELS, type ShopBookingRequest } from "../../types/shopBooking";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", red: "#F52239", line: "#303135" };
function label(status: ShopBookingRequest["status"]) { return SHOP_STATUS_LABELS[status]; }

export default function ShopOwnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, profile, requests, profileLoading, requestsLoading, profileError, requestsError, retry } = useShopDashboard();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const pending = requests.filter((item) => item.status === "pending");
  const active = useMemo(() => requests.find((item) => isActiveShopService(item.status)), [requests]);
  const completed = requests.filter((item) => item.status === "completed").length;
  const toggle = async (open: boolean) => {
    if (locked.current) return;
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
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>VeResc</Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Requests" onPress={() => router.push("/(shop-owner)/requests")}><Feather name="bell" size={25} color={C.text} /><View style={s.bellDot} /></TouchableOpacity></View>

      <View style={s.hero}>
        <View style={s.heroTop}><View style={s.heroCopy}><Text style={s.locationLabel}>{profile.address || "Auto shop"}</Text><Text style={s.heroTitle}>{profile.status === "open" ? "Ready to assist" : "Shop is closed"}</Text><Text style={s.heroHint}>{saving ? "Saving availability..." : profile.status === "open" ? "Your shop is accepting requests." : "Open your shop to receive requests."}</Text></View>
          <View style={s.availabilityToggle}><Text style={s.availableLabel}>{profile.status === "open" ? "Open" : "Closed"}</Text><Switch value={profile.status === "open"} onValueChange={(value) => void toggle(value)} disabled={saving} trackColor={{ false: "#FFFFFF", true: "#FFFFFF" }} thumbColor={profile.status === "open" ? C.red : "#77797D"} style={s.switch} /></View>
        </View>
        <View style={s.heroDivider} />
        <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{pending.length}</Text><Text style={s.statLabel}>New requests</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statValue}>{completed}</Text><Text style={s.statLabel}>Completed today</Text></View></View>
      </View>
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
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 5 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 9, paddingHorizontal: 20, paddingVertical: 13 },
  header: { height: 57, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 36, lineHeight: 42, fontWeight: "900", fontStyle: "italic", marginRight: 6 }, brand: { color: C.text, fontSize: 22, fontWeight: "800" }, bell: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", position: "relative" }, bellDot: { position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red },
  hero: { minHeight: 178, backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 15 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCopy: { flex: 1 }, locationLabel: { color: "#F7EFED", fontSize: 14, lineHeight: 20 }, heroTitle: { color: "#F7EFED", fontSize: 27, lineHeight: 35, fontWeight: "800" }, heroHint: { color: "#F7EFED", fontSize: 14, lineHeight: 20 }, availabilityToggle: { minHeight: 45, backgroundColor: "#F7EFED", borderRadius: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }, availableLabel: { color: "#292629", fontSize: 13, fontWeight: "700" }, switch: { transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }], width: 49, marginLeft: 2 }, heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.35)", marginTop: 12, marginBottom: 8 }, stats: { minHeight: 48, flexDirection: "row", alignItems: "center" }, stat: { flex: 1 }, statDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.4)", marginHorizontal: 16 }, statValue: { color: "#F7EFED", fontSize: 32, lineHeight: 37, fontWeight: "800" }, statLabel: { color: "#F7EFED", fontSize: 14, lineHeight: 20 }, error: { color: "#FF9AA8", fontSize: 15, lineHeight: 21, marginTop: 10 },
  overline: { color: "#C0BCBA", fontSize: 14, fontWeight: "800", letterSpacing: 1, marginTop: 20, marginBottom: 12 }, quickActions: { flexDirection: "row", justifyContent: "space-between" }, quickAction: { width: "24%", minHeight: 91, alignItems: "center" }, actionIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#202124", alignItems: "center", justifyContent: "center", position: "relative" }, actionBadge: { position: "absolute", right: -2, top: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }, actionBadgeText: { color: "#F7EFED", fontSize: 12, fontWeight: "800" }, actionLabel: { color: C.text, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center", marginTop: 6 },
  sectionHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", marginTop: 17, marginBottom: 9, paddingHorizontal: 2 }, sectionTitle: { color: C.text, fontSize: 22, lineHeight: 29, fontWeight: "800" }, viewAll: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" }, viewAllText: { color: C.red, fontSize: 14, fontWeight: "700" },
  jobCard: { backgroundColor: C.card, borderRadius: 16, padding: 18 }, jobTop: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, status: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "#343538" }, statusText: { color: C.text, fontSize: 13, fontWeight: "700" }, customer: { color: C.text, fontSize: 21, lineHeight: 28, fontWeight: "800", marginTop: 7 }, vehicle: { color: C.muted, fontSize: 16, lineHeight: 22, marginTop: 2, marginBottom: 8 }, routeRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 9 }, routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.red }, destinationDot: { backgroundColor: "#8F9296" }, routeText: { color: C.text, flex: 1, fontSize: 15, lineHeight: 21 }, routeLabel: { color: C.muted, fontSize: 13 }, concern: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: "#303135", marginTop: 8, paddingTop: 10 }, concernText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 }, primary: { minHeight: 52, backgroundColor: C.red, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }, primaryText: { color: "#F7EFED", fontSize: 16, fontWeight: "800" },
  emptyCard: { minHeight: 125, borderRadius: 16, backgroundColor: C.card, paddingHorizontal: 17, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 13 }, emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, emptyCopy: { flex: 1, gap: 5 }, emptyTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "700" }, emptyHint: { color: C.muted, fontSize: 14, lineHeight: 20 }, requestCard: { minHeight: 82, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, requestIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, requestCopy: { flex: 1 }, requestName: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, requestHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }, requestArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }, listingHint: { minHeight: 75, borderRadius: 12, backgroundColor: C.card, marginTop: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, listingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" }, listingCopy: { flex: 1 }, listingTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700" }, listingSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 }, editListing: { color: C.red, fontSize: 12, fontWeight: "700" },
});
