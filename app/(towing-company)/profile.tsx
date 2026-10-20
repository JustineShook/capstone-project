import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getTowingCompanyProfile } from "../../services/towingCompanyProfileService";
import type { TowingCompanyProfile } from "../../types/towingCompanyProfile";

const C = { canvas: "#08090B", card: "#17191C", text: "#F5F2F0", muted: "#B7B2B0", line: "#303135", red: "#F52239", green: "#25C47A", status: "#2A2B2E" };

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
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><View style={{ flexDirection: "row", alignItems: "center" }}><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Account updates" onPress={() => router.push("/(towing-company)/account-updates")}><Feather name="shield" size={20} color={C.text} /></TouchableOpacity><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push("/(towing-company)/notifications")}><Feather name="bell" size={21} color={C.text} /></TouchableOpacity></View></View>
      <ImageBackground source={require("../../assets/images/towing-dashboard-bg.png")} style={s.identity} imageStyle={s.identityImage}>
        <View style={s.identityShade} />
        <View style={s.identityContent}>
          <View style={s.avatar}>{photo ? <Image source={{ uri: photo }} style={s.avatarImage} /> : <Feather name="truck" size={31} color={C.red} />}</View>
          <View style={s.identityInfo}>
            <Text style={s.identityEyebrow}>TOWING COMPANY PROFILE</Text>
            <Text style={s.name} numberOfLines={2}>{name}</Text>
            <TouchableOpacity style={s.verified} disabled={status === "VERIFIED"} onPress={openVerification}><Feather name={status === "VERIFIED" ? "check-circle" : "clock"} size={15} color={status === "VERIFIED" ? C.green : "#FFD27B"} /><Text style={s.verifiedText}>{status === "VERIFIED" ? "Verified" : status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Verification Incomplete"}</Text></TouchableOpacity>
            <TouchableOpacity style={s.editProfile} onPress={() => router.push({ pathname: "/(towing-company)/verification", params: { mode: "edit" } })} activeOpacity={0.8}><Feather name="edit-2" size={15} color="#FFFFFF" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Manage your business</Text><Text style={s.sectionHint}>Quick access to towing company information</Text></View>
      <View style={s.shortcuts}>
        <Menu icon="map" title="Public Listing" onPress={() => router.push("/(towing-company)/public-listing")} />
        <Menu icon="tag" title="Pricing" onPress={() => router.push("/(towing-company)/towing-pricing")} />
        <Menu icon="file-text" title="Verification" onPress={openVerification} />
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Account</Text><Text style={s.sectionHint}>Your account and contact information</Text></View>
      <View style={s.menu}>
        <MenuRow icon="settings" title="Account Settings" onPress={() => router.push("/(towing-company)/verification")} />
        <MenuRow icon="user" title="Contact Details" onPress={() => router.push({ pathname: "/(towing-company)/verification", params: { mode: "edit" } })} />
        <MenuRow icon="help-circle" title="Help & Support" onPress={() => Alert.alert("Help & Support", "Contact support through your account administrator.")} last />
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
function MenuRow({ icon, title, onPress, last }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void; last?: boolean }) { return <TouchableOpacity style={[s.menuRow, last && s.lastMenuRow]} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={20} color={C.muted} /><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 5, flexGrow: 1 }, header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginBottom: 8 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 34, lineHeight: 39, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 21, fontWeight: "900" }, brandRed: { color: C.red }, bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  identity: { minHeight: 180, borderRadius: 20, overflow: "hidden", justifyContent: "center", padding: 18, backgroundColor: "#22262C", borderWidth: 1, borderColor: "#353A40" }, identityImage: { borderRadius: 20 }, identityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,8,10,0.68)" }, identityContent: { flexDirection: "row", alignItems: "center" }, avatar: { width: 76, height: 76, borderRadius: 23, backgroundColor: "#F7EFED", alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarImage: { width: "100%", height: "100%" }, identityInfo: { marginLeft: 15, flex: 1 }, identityEyebrow: { color: "#FF9A9D", fontSize: 11, letterSpacing: 1.1, fontWeight: "900", marginBottom: 4 }, name: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "900" }, verified: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }, verifiedText: { color: "#F7EFED", fontSize: 13, fontWeight: "800" }, editProfile: { alignSelf: "flex-start", minWidth: 126, minHeight: 37, backgroundColor: C.red, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 }, editProfileText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionHeading: { marginTop: 20, marginBottom: 10 }, sectionTitle: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: "900" }, sectionHint: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }, shortcuts: { flexDirection: "row", gap: 10, marginBottom: 2 }, shortcut: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9, minHeight: 105, borderRadius: 17, paddingHorizontal: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, shortcutIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#292C31", alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" }, menu: { backgroundColor: C.card, borderRadius: 17, marginTop: 0, paddingHorizontal: 15, paddingVertical: 4, borderWidth: 1, borderColor: C.line }, menuRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderBottomColor: "#2B2C2F", paddingHorizontal: 2 }, lastMenuRow: { borderBottomWidth: 0 }, menuIcon: { width: 18, alignItems: "center", justifyContent: "center" }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, verify: { minHeight: 50, backgroundColor: C.red, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 15 }, logout: { minHeight: 57, borderWidth: 1, borderColor: C.red, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 16 }, logoutText: { color: C.red, fontSize: 16, fontWeight: "800" },
});
