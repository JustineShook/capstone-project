import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import type { TowingCompanyProfile } from "../../types/towingCompanyProfile";

const C = { canvas: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", line: "#354249", red: "#F51F3B", status: "#2A363E" };

export default function TowingProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<TowingCompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setProfile(null); setError("You need to sign in to view your towing company profile."); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setProfile(await getTowingCompanyProfile(user.uid)); }
    catch { setError("We couldn't load your profile. Check your connection and try again."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const status = profile?.verificationStatus ?? "INCOMPLETE";
  const canVerify = status === "INCOMPLETE" || status === "REJECTED";
  const name = profile?.company.companyName || auth.currentUser?.displayName || "Towing Company";
  const photo = profile?.representative.profilePhotoUrl;
  const openVerification = () => router.push("/(towing-company)/verification");
  const confirmLogout = () => Alert.alert("Log Out", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Log Out", style: "destructive", onPress: () => void performLogout() }]);
  const performLogout = async () => { if (signingOut) return; setSigningOut(true); try { await logout(); router.replace("/(auth)/login"); } catch (cause) { Alert.alert("Log Out Failed", (cause as Error)?.message || "Please try again."); } finally { setSigningOut(false); } };

  if (loading) return <ScreenState loading text="Loading profile..." />;
  if (error) return <ScreenState text={error} action={() => void load()} />;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Profile</Text>
      <View style={s.identity}>
        <View style={s.avatar}>{photo ? <Image source={{ uri: photo }} style={s.avatarImage} /> : <Feather name="truck" size={30} color={C.muted} />}</View>
        <View style={s.identityInfo}><Text style={s.name}>{name}</Text><Text style={s.role}>Towing Company</Text>{status === "VERIFIED" ? <View style={s.verified}><Feather name="check-circle" size={12} color="#fff" /><Text style={s.verifiedText}>Verified</Text></View> : <TouchableOpacity style={s.pending} onPress={openVerification}><Text style={s.pendingText}>{status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Complete Verification"}</Text></TouchableOpacity>}</View>
      </View>

      <View style={s.menu}>
        <Menu icon="user" title="Contact Information" subtitle={profile?.company.phone || auth.currentUser?.email || "Not provided"} onPress={() => canVerify && openVerification()} />
        <Menu icon="map-pin" title="Service Area" subtitle={profile?.services.serviceArea || "Not provided"} onPress={() => canVerify && openVerification()} />
        <Menu icon="truck" title="Towing Services" subtitle={(profile?.services.towingServices || []).join(", ") || "Not provided"} onPress={() => canVerify && openVerification()} />
        <Menu icon="clock" title="Operating Hours" subtitle={profile?.company.operatingHours || "Not provided"} onPress={() => canVerify && openVerification()} />
        <Menu icon="file-text" title="Documents" subtitle={status === "VERIFIED" ? "Company documents verified" : "View verification documents"} onPress={openVerification} />
        {status === "VERIFIED" && <Menu icon="map" title="Public Listing" subtitle={profile?.publicListing ? "Manage your listing" : "Set up your listing"} onPress={() => router.push("/(towing-company)/public-listing")} />}
        {status === "VERIFIED" && <Menu icon="dollar-sign" title="Towing Pricing" subtitle="Manage distance pricing" onPress={() => router.push("/(towing-company)/towing-pricing")} />}
        <Menu icon="settings" title="Settings" subtitle="Account settings" onPress={confirmLogout} />
      </View>
      {canVerify && <TouchableOpacity style={s.verify} onPress={openVerification}><Feather name="shield" size={18} color="#fff" /><Text style={s.buttonText}>{status === "REJECTED" ? "Correct & Resubmit" : profile ? "Edit Profile" : "Complete Verification"}</Text></TouchableOpacity>}
      <TouchableOpacity disabled={signingOut} style={s.logout} onPress={confirmLogout}>{signingOut ? <ActivityIndicator color={C.red} /> : <><Feather name="log-out" size={17} color={C.red} /><Text style={s.logoutText}>Log Out</Text></>}</TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Menu({ icon, title, subtitle, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; onPress: () => void }) { return <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={18} color={C.muted} /><View style={s.menuText}><Text style={s.menuTitle}>{title}</Text><Text style={s.menuSubtitle} numberOfLines={1}>{subtitle}</Text></View><Feather name="chevron-right" size={20} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { padding: 16 }, title: { color: C.text, fontSize: 24, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 16, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  identity: { flexDirection: "row", alignItems: "center", marginTop: 20 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#303C44", alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarImage: { width: "100%", height: "100%" }, identityInfo: { marginLeft: 14, flex: 1 }, name: { color: C.text, fontSize: 19, fontWeight: "700" }, role: { color: C.muted, fontSize: 14, marginTop: 3 }, verified: { alignSelf: "flex-start", backgroundColor: "#1C8D5B", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", gap: 4, alignItems: "center", marginTop: 8 }, verifiedText: { color: "#fff", fontSize: 11, fontWeight: "700" }, pending: { alignSelf: "flex-start", backgroundColor: C.status, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 }, pendingText: { color: C.text, fontSize: 11, fontWeight: "700" },
  menu: { backgroundColor: C.card, borderRadius: 10, marginTop: 22, paddingHorizontal: 13 }, menuRow: { minHeight: 64, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 }, menuText: { flex: 1 }, menuTitle: { color: C.text, fontSize: 16, fontWeight: "600" }, menuSubtitle: { color: C.muted, fontSize: 12, marginTop: 3 }, verify: { height: 50, backgroundColor: C.red, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 16 }, logout: { height: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 10 }, logoutText: { color: C.red, fontSize: 15, fontWeight: "700" },
});
