import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getHomeGarageVerificationProfile } from "../../services/homeGarageVerificationService";
import type { HomeGarageVerificationProfile } from "../../types/homeGarageVerificationProfile";
import { homeColors as colors } from "../../constants/owner/homeTheme";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", line: "#D5DEE9", red: "#0F52BA", green: "#166534", status: "#F1F5F9", surfaceAlt: "#F1F5F9", primary: "#0F52BA", primaryDark: "#0B3D8A", shadow: "#000000" };

export default function HomeGarageProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [profile, setProfile] = useState<HomeGarageVerificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setProfile(null); setError("Sign in to view your profile."); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setProfile(await getHomeGarageVerificationProfile(uid)); }
    catch { setError("We couldn't load your profile. Check your connection and try again."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const status = profile?.verificationStatus ?? "INCOMPLETE";
  const canVerify = status === "INCOMPLETE" || status === "REJECTED";
  const name = profile?.business.name || userProfile?.displayName || "Home Garage Provider";
  const openVerification = () => router.push("/(homegarage)/verification");
  const confirmLogout = () => { setLogoutError(null); setLogoutVisible(true); };
  const performLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError(null);
    try { await logout(); setLogoutVisible(false); router.replace("/(auth)/login"); }
    catch (cause) { setLogoutError(cause instanceof Error ? cause.message : "We couldn't log you out. Check your connection and try again."); }
    finally { setSigningOut(false); }
  };

  if (loading) return <ScreenState loading text="Loading profile..." />;
  if (error) return <ScreenState text={error} action={() => void load()} />;
  const verificationLabel = status === "VERIFIED" ? "Verified" : status === "PENDING" ? "Verification Pending" : status === "REJECTED" ? "Verification Rejected" : "Complete Verification";

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><View style={s.headerActions}><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Account updates" onPress={() => router.push("/(homegarage)/account-updates")}><Feather name="shield" size={20} color="#FFFFFF" /></TouchableOpacity><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Reservations" onPress={() => router.push("/(homegarage)/parking-sessions")}><Feather name="bell" size={21} color="#FFFFFF" /></TouchableOpacity></View></View>
    <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>

      <ImageBackground source={require("../../assets/images/homegarage-motorcycle-sapphire.png")} style={s.identity} imageStyle={s.identityImage}>
        <View style={s.identityShade} />
        <View style={s.identityContent}>
          <View style={s.avatar}><Feather name="home" size={31} color={C.red} /></View>
          <View style={s.identityInfo}>
            <Text style={s.identityEyebrow}>HOME GARAGE PROFILE</Text>
            <Text style={s.name} numberOfLines={2}>{name}</Text>
            <TouchableOpacity style={s.verified} disabled={status === "VERIFIED"} onPress={openVerification}><Feather name={status === "VERIFIED" ? "check-circle" : "clock"} size={15} color={status === "VERIFIED" ? "#5DE0A0" : "#FFD27B"} /><Text style={s.verifiedText}>{verificationLabel}</Text></TouchableOpacity>
            <TouchableOpacity style={s.editProfile} onPress={openVerification} activeOpacity={0.8}><Feather name="edit-2" size={15} color="#FFFFFF" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Manage your business</Text><Text style={s.sectionHint}>Quick access to your Home Garage information</Text></View>
      <View style={s.shortcuts}>
        <Menu icon="map" title="Public Listing" onPress={() => router.push("/(homegarage)/public-listing")} />
        <Menu icon="grid" title="Home Dashboard" onPress={() => router.push("/(homegarage)")} />
        <Menu icon="file-text" title="Verification" onPress={openVerification} />
        <Menu icon="credit-card" title="Subscription" onPress={() => router.push("/(homegarage)/subscription")} />
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Account</Text><Text style={s.sectionHint}>Your account and contact information</Text></View>
      <View style={s.menu}>
        <MenuRow icon="settings" title="Account Settings" onPress={openVerification} />
        <MenuRow icon="user" title="Contact Details" onPress={openVerification} />
        <MenuRow icon="help-circle" title="Help & Support" onPress={() => Alert.alert("Help & Support", "Contact support through your account administrator.")} last />
      </View>
      {canVerify && <TouchableOpacity style={s.verify} onPress={openVerification}><Feather name="shield" size={17} color="#FFFFFF" /><Text style={s.buttonText}>{status === "REJECTED" ? "Correct & Resubmit" : "Complete Verification"}</Text></TouchableOpacity>}
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

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.primary} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Menu({ icon, title, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void }) { return <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.75}><View style={s.shortcutIcon}><Feather name={icon} size={21} color="#FFFFFF" /></View><Text style={s.shortcutTitle} numberOfLines={2}>{title}</Text></TouchableOpacity>; }
function MenuRow({ icon, title, onPress, last }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void; last?: boolean }) { return <TouchableOpacity style={[s.menuRow, last && s.lastMenuRow]} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={20} color={C.muted} /><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.red }, content: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 }, header: { backgroundColor: C.red, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.4 }, brandRed: { color: "#FFFFFF" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  state: { flex: 1, backgroundColor: C.canvas, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", justifyContent: "center", alignItems: "center", padding: 24 }, modalCard: { width: "100%", maxWidth: 420, borderRadius: 18, padding: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, modalTitle: { color: C.text, fontSize: 21, fontWeight: "900" }, modalMessage: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 9 }, modalError: { color: "#9F1239", fontSize: 14, lineHeight: 20, marginTop: 12 }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 22 }, modalCancel: { minHeight: 46, minWidth: 104, paddingHorizontal: 16, borderRadius: 11, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, modalCancelText: { color: C.text, fontSize: 15, fontWeight: "800" }, modalConfirm: { minHeight: 46, minWidth: 112, paddingHorizontal: 16, borderRadius: 11, backgroundColor: "#9F1239", alignItems: "center", justifyContent: "center" }, modalConfirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  identityImage: { borderRadius: 20, opacity: 0.9 },
  identityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,61,138,0.42)" },
  identity: { minHeight: 180, borderRadius: 20, overflow: "hidden", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 16, backgroundColor: C.red, borderWidth: 1, borderColor: C.line }, identityDecoration: { position: "absolute", width: 210, height: 210, borderRadius: 105, right: -74, top: -99, backgroundColor: "#0B3D8A", opacity: 0.75 }, identityContent: { flexDirection: "row", alignItems: "center" }, avatar: { width: 76, height: 76, borderRadius: 24, backgroundColor: C.status, alignItems: "center", justifyContent: "center", overflow: "hidden" }, identityInfo: { marginLeft: 14, flex: 1, minWidth: 0 }, identityEyebrow: { color: "#FFFFFF", fontSize: 11, letterSpacing: 1.1, fontWeight: "700", marginBottom: 4 }, name: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }, verified: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8, maxWidth: "100%" }, verifiedText: { color: "#FFFFFF", fontSize: 13, lineHeight: 19, fontWeight: "500", flexShrink: 1 }, editProfile: { alignSelf: "flex-start", minHeight: 44, backgroundColor: C.red, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 }, editProfileText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sectionHeading: { marginTop: 20, marginBottom: 10 }, sectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700" }, sectionHint: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, shortcuts: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, shortcut: { alignItems: "center", width: "24%", minHeight: 86 }, shortcutIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.red, borderWidth: 1, borderColor: C.red, alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: "#475569", fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 7, textAlign: "center" }, menu: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 1, borderColor: C.line, overflow: "hidden" }, menuRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 12, paddingHorizontal: 15 }, lastMenuRow: { borderBottomWidth: 0 }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "700", flexShrink: 1 }, verify: { minHeight: 52, backgroundColor: C.red, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 2, marginBottom: 12 }, logout: { minHeight: 54, borderWidth: 1, borderColor: colors.busy, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 2 }, logoutText: { color: colors.busy, fontSize: 15, fontWeight: "700" },
 scroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }});
