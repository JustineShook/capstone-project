import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import type { TowingCompanyProfile } from "../../types/towingCompanyProfile";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", line: "#303135", red: "#F52239", status: "#2A2B2E" };

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
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/requests")}><Feather name="bell" size={21} color={C.text} /></TouchableOpacity></View>
      <View style={s.identity}>
        <View style={s.avatar}>{photo ? <Image source={{ uri: photo }} style={s.avatarImage} /> : <Feather name="truck" size={30} color={C.muted} />}</View>
        <View style={s.identityInfo}><Text style={s.name} numberOfLines={1}>{name}</Text><Text style={s.role}>Towing Company</Text>{status === "VERIFIED" ? <View style={s.verified}><Feather name="check-circle" size={13} color="#D7FFE8" /><Text style={s.verifiedText}>Verified</Text></View> : <TouchableOpacity style={s.pending} onPress={openVerification}><Text style={s.pendingText}>{status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Complete Verification"}</Text></TouchableOpacity>}<TouchableOpacity style={s.editProfile} onPress={() => router.push({ pathname: "/(towing-company)/verification", params: { mode: "edit" } })} activeOpacity={0.8}><Feather name="edit-2" size={12} color="#F7EFED" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity></View>
      </View>

      <View style={s.shortcuts}>
        <Menu icon="map" title="Public Listing" onPress={() => router.push("/(towing-company)/public-listing")} />
        <Menu icon="tag" title="Pricing" onPress={() => router.push("/(towing-company)/towing-pricing")} />
        <Menu icon="file-text" title="Documents" onPress={openVerification} />
      </View>

      <View style={s.menu}>
        <TouchableOpacity style={s.menuRow} onPress={() => router.push("/(towing-company)/verification")} activeOpacity={0.7}><Feather name="settings" size={21} color={C.muted} /><Text style={s.menuTitle}>Account Settings</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={22} color={C.muted} /></TouchableOpacity>
        <TouchableOpacity style={s.menuRow} onPress={() => router.push("/(towing-company)/verification")} activeOpacity={0.7}><Feather name="user" size={21} color={C.muted} /><Text style={s.menuTitle}>Contact Details</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={22} color={C.muted} /></TouchableOpacity>
        <TouchableOpacity style={[s.menuRow, s.lastMenuRow]} onPress={() => router.push("/(towing-company)/verification")} activeOpacity={0.7}><Feather name="help-circle" size={21} color={C.muted} /><Text style={s.menuTitle}>Help &amp; Support</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={22} color={C.muted} /></TouchableOpacity>
      </View>
      {canVerify && <TouchableOpacity style={s.verify} onPress={openVerification}><Feather name="shield" size={18} color="#fff" /><Text style={s.buttonText}>{status === "REJECTED" ? "Correct & Resubmit" : profile ? "Edit Profile" : "Complete Verification"}</Text></TouchableOpacity>}
      <TouchableOpacity disabled={signingOut} style={s.logout} onPress={confirmLogout}>{signingOut ? <ActivityIndicator color={C.red} /> : <><Feather name="log-out" size={17} color={C.red} /><Text style={s.logoutText}>Log Out</Text></>}</TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Menu({ icon, title, subtitle, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; subtitle?: string; onPress: () => void }) {
  if (!subtitle) return <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.75}><View style={s.shortcutIcon}><Feather name={icon} size={21} color={C.text} /></View><Text style={s.shortcutTitle} numberOfLines={1}>{title}</Text></TouchableOpacity>;
  return <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7}><View style={s.menuIcon}><Feather name={icon} size={20} color={C.muted} /></View><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 5, flexGrow: 1 }, header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, marginBottom: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 19, fontWeight: "800" }, brandRed: { color: C.red }, bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, title: { color: C.text, fontSize: 24, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 16, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  identity: { minHeight: 142, flexDirection: "row", alignItems: "center", marginTop: 0, paddingHorizontal: 16, paddingVertical: 15, borderRadius: 16, backgroundColor: C.red }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#ECE8E6", alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarImage: { width: "100%", height: "100%" }, identityInfo: { marginLeft: 15, flex: 1 }, name: { color: "#F7EFED", fontSize: 21, lineHeight: 28, fontWeight: "800" }, role: { color: "#F7EFED", fontSize: 15, lineHeight: 21, marginTop: 2 }, verified: { alignSelf: "flex-start", borderRadius: 9, flexDirection: "row", gap: 6, alignItems: "center", marginTop: 5 }, verifiedText: { color: "#F7EFED", fontSize: 14, fontWeight: "700" }, pending: { alignSelf: "flex-start", backgroundColor: C.status, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6 }, pendingText: { color: C.text, fontSize: 13, fontWeight: "700" }, editProfile: { alignSelf: "flex-start", minWidth: 126, minHeight: 34, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 7 }, editProfileText: { color: "#F7EFED", fontSize: 13, fontWeight: "700" },
  shortcuts: { flexDirection: "row", justifyContent: "space-around", marginTop: 16, marginBottom: 18 }, shortcut: { flex: 1, alignItems: "center", gap: 7, minHeight: 82 }, shortcutIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#191A1D", borderWidth: 1, borderColor: "#3A3B3F", alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: C.text, fontSize: 13, lineHeight: 18, textAlign: "center" }, menu: { backgroundColor: "#191A1D", borderRadius: 12, marginTop: 2, paddingHorizontal: 13, paddingVertical: 3, borderWidth: 1, borderColor: "#303135" }, menuRow: { height: 54, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#2B2C2F", paddingHorizontal: 2 }, lastMenuRow: { borderBottomWidth: 0 }, menuIcon: { width: 18, alignItems: "center", justifyContent: "center" }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "500" }, verify: { height: 54, backgroundColor: C.red, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 16 }, logout: { height: 54, borderWidth: 1, borderColor: C.red, borderRadius: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 16 }, logoutText: { color: C.red, fontSize: 15, fontWeight: "700" },
});
