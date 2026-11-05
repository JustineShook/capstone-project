import { Feather, Ionicons } from "@expo/vector-icons";
import { MechanicNotificationBell } from "../../components/onsite-mechanic/MechanicNotificationBell";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ImageBackground, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getProviderProfile } from "../../services/providerProfileService";
import type { OnsiteMechanicProviderProfile, VerificationStatus } from "../../types/onsiteMechanicProfile";
import { homeColors as colors } from "../../constants/owner/homeTheme";

const C = { canvas: colors.background, card: colors.surface, text: colors.textPrimary, muted: colors.textSecondary, line: colors.border, red: colors.primary, green: colors.success, status: colors.surfaceAlt };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<OnsiteMechanicProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
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
  const confirmLogout = () => { setLogoutError(null); setLogoutVisible(true); };
  const performLogout = async () => { if (signingOut) return; setSigningOut(true); setLogoutError(null); try { await logout(); setLogoutVisible(false); router.replace("/(auth)/login"); } catch (cause) { setLogoutError((cause as Error)?.message || "We couldn't log you out. Check your connection and try again."); } finally { setSigningOut(false); } };

  if (loading) return <ScreenState loading text="Loading profile..." />;
  if (error) return <ScreenState text={error} action={() => void load()} />;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.red} />
    <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><View style={s.headerActions}><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Account updates" onPress={() => router.push("/(onsite-mechanic)/account-updates")}><Feather name="shield" size={20} color="#FFFFFF" /></TouchableOpacity><MechanicNotificationBell style={s.bell} size={21} color="#FFFFFF" /></View></View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <ImageBackground source={require("../../assets/images/mechanic-dashboard-bg.png")} style={s.identity} imageStyle={s.identityImage}>
        <View style={s.identityShade} />
        <View style={s.identityContent}>
          <View style={s.avatar}>{photo ? <Image source={{ uri: photo }} style={s.avatarImage} /> : <Feather name="tool" size={31} color={C.red} />}</View>
          <View style={s.identityInfo}>
            <Text style={s.identityEyebrow}>ONSITE MECHANIC PROFILE</Text>
            <Text style={s.name}>{name}</Text>
            <TouchableOpacity style={s.verified} disabled={status === "VERIFIED"} onPress={openVerification}><Feather name={status === "VERIFIED" ? "check-circle" : "clock"} size={15} color={status === "VERIFIED" ? C.green : "#FFD27B"} /><Text style={s.verifiedText}>{status === "VERIFIED" ? "Verified" : status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Verification Incomplete"}</Text></TouchableOpacity>
            <TouchableOpacity style={s.editProfile} onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} activeOpacity={0.8}><Feather name="edit-2" size={15} color="#FFFFFF" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Manage your services</Text><Text style={s.sectionHint}>Quick access to your mechanic information</Text></View>
      <View style={s.shortcuts}>
        <Shortcut icon="map-outline" title="Public Listing" onPress={() => router.push("/(onsite-mechanic)/public-listing")} />
        <Shortcut icon="build-outline" title="Services" onPress={() => router.push("/(onsite-mechanic)/verification")} />
        <Shortcut icon="shield-checkmark-outline" title="Verification" onPress={openVerification} />
        <Shortcut icon="card-outline" title="Subscription" onPress={() => router.push("/(onsite-mechanic)/subscription")} />
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Account</Text><Text style={s.sectionHint}>Your account and contact information</Text></View>
      <View style={s.menu}>
        <MenuRow icon="settings" title="Account Settings" onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} />
        <MenuRow icon="user" title="Contact Details" onPress={() => router.push({ pathname: "/(onsite-mechanic)/verification", params: { mode: "edit" } })} />
        <MenuRow icon="help-circle" title="Help & Support" onPress={() => Alert.alert("Help & Support", "Contact support through your account administrator.")} last />
      </View>
      {canVerify && <TouchableOpacity style={s.verify} onPress={openVerification}><Feather name="shield" size={17} color="#fff" /><Text style={s.buttonText}>{status === "REJECTED" ? "Correct & Resubmit" : profile ? "Edit Profile" : "Complete Verification"}</Text></TouchableOpacity>}
      <TouchableOpacity disabled={signingOut} style={s.logout} onPress={confirmLogout}>{signingOut ? <ActivityIndicator color={C.red} /> : <><Feather name="log-out" size={17} color={C.red} /><Text style={s.logoutText}>Log Out</Text></>}</TouchableOpacity>
    </ScrollView>
    <Modal visible={logoutVisible} transparent animationType="fade" onRequestClose={() => !signingOut && setLogoutVisible(false)}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <Text style={s.modalTitle}>Log Out</Text><Text style={s.modalMessage}>Are you sure you want to log out?</Text>
        {logoutError ? <Text style={s.modalError}>{logoutError}</Text> : null}
        <View style={s.modalActions}>
          <TouchableOpacity style={s.modalCancel} disabled={signingOut} onPress={() => setLogoutVisible(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={s.modalConfirm} disabled={signingOut} onPress={() => void performLogout()}>{signingOut ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.modalConfirmText}>Log Out</Text>}</TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.red} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Shortcut({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) { return <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.78} accessibilityRole="button"><View style={s.shortcutIcon}><Ionicons name={icon} size={25} color="#FFFFFF" /></View><Text style={s.shortcutTitle}>{title}</Text></TouchableOpacity>; }
function MenuRow({ icon, title, onPress, last }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void; last?: boolean }) { return <TouchableOpacity style={[s.menuRow, last && s.lastMenuRow]} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={20} color={C.muted} /><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.red }, scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, content: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 }, header: { backgroundColor: C.red, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.4 }, brandRed: { color: "#FFFFFF" }, bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", justifyContent: "center", alignItems: "center", padding: 24 }, modalCard: { width: "100%", maxWidth: 420, borderRadius: 18, padding: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, modalTitle: { color: C.text, fontSize: 21, fontWeight: "900" }, modalMessage: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 9 }, modalError: { color: "#FF9AA8", fontSize: 14, lineHeight: 20, marginTop: 12 }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 22 }, modalCancel: { minHeight: 46, minWidth: 104, paddingHorizontal: 16, borderRadius: 11, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, modalCancelText: { color: C.text, fontSize: 15, fontWeight: "800" }, modalConfirm: { minHeight: 46, minWidth: 112, paddingHorizontal: 16, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }, modalConfirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  identity: { minHeight: 180, borderRadius: 20, overflow: "hidden", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 16, backgroundColor: C.red, borderWidth: 1, borderColor: C.line }, identityImage: { borderRadius: 20, opacity: 0.9 }, identityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" }, identityContent: { flexDirection: "row", alignItems: "center" }, avatar: { width: 76, height: 76, borderRadius: 24, backgroundColor: C.status, alignItems: "center", justifyContent: "center", overflow: "hidden" }, avatarImage: { width: "100%", height: "100%" }, identityInfo: { marginLeft: 14, flex: 1, minWidth: 0 }, identityEyebrow: { color: "#FFFFFF", fontSize: 11, letterSpacing: 1.1, fontWeight: "700", marginBottom: 4 }, name: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }, verified: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8, maxWidth: "100%" }, verifiedText: { color: "#FFFFFF", fontSize: 13, lineHeight: 19, fontWeight: "500", flexShrink: 1 }, editProfile: { alignSelf: "flex-start", minHeight: 44, backgroundColor: C.red, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 }, editProfileText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sectionHeading: { marginTop: 20, marginBottom: 10 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, sectionHint: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, shortcuts: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, shortcut: { alignItems: "center", width: "24%", minHeight: 86 }, shortcutIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.red, borderWidth: 1, borderColor: C.red, alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: "#475569", fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 7, textAlign: "center" }, menu: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 1, borderColor: C.line, overflow: "hidden" }, menuRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 12, paddingHorizontal: 15 }, lastMenuRow: { borderBottomWidth: 0 }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "700", flexShrink: 1 }, verify: { minHeight: 52, backgroundColor: C.red, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 2, marginBottom: 12 }, logout: { minHeight: 54, borderWidth: 1, borderColor: colors.busy, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 2 }, logoutText: { color: colors.busy, fontSize: 15, fontWeight: "700" },
});
