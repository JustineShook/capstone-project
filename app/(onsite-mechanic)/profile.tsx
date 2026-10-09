import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getProviderProfile } from "../../services/providerProfileService";
import type { OnsiteMechanicProviderProfile, VerificationStatus } from "../../types/onsiteMechanicProfile";

const C = { canvas: "#090A0C", card: "#191A1D", text: "#ECE8E6", muted: "#B7B2B0", line: "#303135", red: "#F52239", status: "#2A2B2E" };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<OnsiteMechanicProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setError("You need to sign in to view your profile."); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setProfile(await getProviderProfile(user.uid)); }
    catch { setError("We couldn't load your profile. Check your connection and try again."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const status: VerificationStatus = profile?.verificationStatus ?? "INCOMPLETE";
  const name = profile?.personal.fullName || auth.currentUser?.displayName || "Onsite Mechanic";
  const canVerify = status === "INCOMPLETE" || status === "REJECTED";
  const photo = profile?.identification.profilePhotoUrl;
  const openVerification = () => router.push("/(onsite-mechanic)/verification");
  const confirmLogout = () => Alert.alert("Log Out", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Log Out", style: "destructive", onPress: () => void performLogout() }]);
  const performLogout = async () => { if (signingOut) return; setSigningOut(true); try { await logout(); router.replace("/(auth)/login"); } catch (cause) { Alert.alert("Log Out Failed", (cause as Error)?.message || "Please try again."); } finally { setSigningOut(false); } };

  if (loading) return <ScreenState loading text="Loading profile..." />;
  if (error) return <ScreenState text={error} action={() => void load()} />;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><TouchableOpacity style={s.bell} accessibilityLabel="Notifications" onPress={() => router.push("/(onsite-mechanic)/requests")}><Feather name="bell" size={21} color={C.text} /></TouchableOpacity></View>
      <View style={s.identity}>
        <View style={s.avatar}>{photo ? <Image source={{ uri: photo }} style={s.avatarImage} /> : <Feather name="tool" size={30} color={C.muted} />}</View>
        <View style={s.identityInfo}><Text style={s.name} numberOfLines={1}>{name}</Text><Text style={s.role}>Onsite Mechanic</Text>{status === "VERIFIED" ? <View style={s.verified}><Feather name="check-circle" size={13} color="#F7EFED" /><Text style={s.verifiedText}>Verified</Text></View> : <TouchableOpacity style={s.pending} onPress={openVerification}><Text style={s.pendingText}>{status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Complete Verification"}</Text></TouchableOpacity>}<TouchableOpacity style={s.editProfile} onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} activeOpacity={0.8}><Feather name="edit-2" size={12} color="#F7EFED" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity></View>
      </View>

      <View style={s.shortcuts}>
        <Menu icon="map" title="Public Listing" onPress={() => router.push("/(onsite-mechanic)/public-listing")} />
        <Menu icon="tool" title="Services" onPress={() => router.push("/(onsite-mechanic)/verification")} />
        <Menu icon="file-text" title="Documents" onPress={openVerification} />
      </View>

      <View style={s.menu}>
        <MenuRow icon="settings" title="Account Settings" onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} />
        <MenuRow icon="user" title="Contact Details" onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} />
        <MenuRow icon="help-circle" title="Help & Support" onPress={() => Alert.alert("Help & Support", "Contact support through your account administrator.")} last />
      </View>
      {canVerify && <TouchableOpacity style={s.verify} onPress={openVerification}><Feather name="shield" size={17} color="#fff" /><Text style={s.buttonText}>{status === "REJECTED" ? "Correct & Resubmit" : profile ? "Edit Profile" : "Complete Verification"}</Text></TouchableOpacity>}
      <TouchableOpacity disabled={signingOut} style={s.logout} onPress={confirmLogout}>{signingOut ? <ActivityIndicator color={C.red} /> : <><Feather name="log-out" size={17} color={C.red} /><Text style={s.logoutText}>Log Out</Text></>}</TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Menu({ icon, title, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void }) { return <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.75}><View style={s.shortcutIcon}><Feather name={icon} size={20} color={C.text} /></View><Text style={s.shortcutTitle} numberOfLines={1}>{title}</Text></TouchableOpacity>; }
function MenuRow({ icon, title, onPress, last }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void; last?: boolean }) { return <TouchableOpacity style={[s.menuRow, last && s.lastMenuRow]} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={20} color={C.muted} /><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 14, paddingTop: 5, flexGrow: 1 }, header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, marginBottom: 4 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 19, fontWeight: "800" }, brandRed: { color: C.red }, bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 15, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  identity: { minHeight: 132, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, backgroundColor: C.red }, avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#ECE8E6", alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarImage: { width: "100%", height: "100%" }, identityInfo: { marginLeft: 13, flex: 1 }, name: { color: "#F7EFED", fontSize: 18, lineHeight: 24, fontWeight: "800" }, role: { color: "#F7EFED", fontSize: 13, lineHeight: 19, marginTop: 2 }, verified: { alignSelf: "flex-start", flexDirection: "row", gap: 5, alignItems: "center", marginTop: 4 }, verifiedText: { color: "#F7EFED", fontSize: 12, fontWeight: "700" }, pending: { alignSelf: "flex-start", backgroundColor: C.status, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginTop: 5 }, pendingText: { color: C.text, fontSize: 12, fontWeight: "700" }, editProfile: { alignSelf: "flex-start", minWidth: 116, minHeight: 32, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 8, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 6 }, editProfileText: { color: "#F7EFED", fontSize: 12, fontWeight: "700" },
  shortcuts: { flexDirection: "row", justifyContent: "space-around", marginTop: 14, marginBottom: 15 }, shortcut: { flex: 1, alignItems: "center", gap: 6, minHeight: 76 }, shortcutIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.card, borderWidth: 1, borderColor: "#3A3B3F", alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: C.text, fontSize: 12, lineHeight: 17, textAlign: "center" }, menu: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 3, borderWidth: 1, borderColor: C.line }, menuRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#2B2C2F", paddingHorizontal: 2 }, lastMenuRow: { borderBottomWidth: 0 }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: "500" }, verify: { minHeight: 50, backgroundColor: C.red, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 15 }, logout: { minHeight: 50, borderWidth: 1, borderColor: C.red, borderRadius: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 13 }, logoutText: { color: C.red, fontSize: 14, fontWeight: "700" },
});
