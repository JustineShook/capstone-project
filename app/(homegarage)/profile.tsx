import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getHomeGarageVerificationProfile } from "../../services/homeGarageVerificationService";
import type { HomeGarageVerificationProfile } from "../../types/homeGarageVerificationProfile";

const C = { canvas: "#08090B", card: "#17191C", text: "#F5F2F0", muted: "#B7B2B0", line: "#303135", red: "#F52239", green: "#25C47A", status: "#2A2B2E" };

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
    <StatusBar barStyle="light-content" backgroundColor={C.canvas} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brandRow}><Text style={s.mark}>V</Text><Text style={s.brand}>Ve<Text style={s.brandRed}>Resc</Text></Text></View><View style={s.headerActions}><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Account updates" onPress={() => router.push("/(homegarage)/account-updates")}><Feather name="shield" size={20} color={C.text} /></TouchableOpacity><TouchableOpacity style={s.bell} accessibilityRole="button" accessibilityLabel="Reservations" onPress={() => router.push("/(homegarage)/parking-sessions")}><Feather name="bell" size={21} color={C.text} /></TouchableOpacity></View></View>
      <View style={s.identity}>
        <View style={s.identityDecoration} />
        <View style={s.identityContent}>
          <View style={s.avatar}><Feather name="home" size={31} color={C.red} /></View>
          <View style={s.identityInfo}>
            <Text style={s.identityEyebrow}>HOME GARAGE PROFILE</Text>
            <Text style={s.name} numberOfLines={2}>{name}</Text>
            <TouchableOpacity style={s.verified} disabled={status === "VERIFIED"} onPress={openVerification}><Feather name={status === "VERIFIED" ? "check-circle" : "clock"} size={15} color={status === "VERIFIED" ? C.green : "#FFD27B"} /><Text style={s.verifiedText}>{verificationLabel}</Text></TouchableOpacity>
            <TouchableOpacity style={s.editProfile} onPress={openVerification} activeOpacity={0.8}><Feather name="edit-2" size={15} color="#FFFFFF" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>Manage your business</Text><Text style={s.sectionHint}>Quick access to your Home Garage information</Text></View>
      <View style={s.shortcuts}>
        <Menu icon="map" title="Public Listing" onPress={() => router.push("/(homegarage)/public-listing")} />
        <Menu icon="grid" title="Home Dashboard" onPress={() => router.push("/(homegarage)")} />
        <Menu icon="file-text" title="Verification" onPress={openVerification} />
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

function ScreenState({ loading, text, action }: { loading?: boolean; text: string; action?: () => void }) { return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><View style={s.state}>{loading ? <ActivityIndicator size="large" color={C.red} /> : <Feather name="alert-circle" size={32} color={C.red} />}<Text style={s.stateText}>{text}</Text>{action && <TouchableOpacity style={s.retry} onPress={action}><Text style={s.buttonText}>Try Again</Text></TouchableOpacity>}</View></SafeAreaView>; }
function Menu({ icon, title, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void }) { return <TouchableOpacity style={s.shortcut} onPress={onPress} activeOpacity={0.75}><View style={s.shortcutIcon}><Feather name={icon} size={21} color={C.text} /></View><Text style={s.shortcutTitle} numberOfLines={2}>{title}</Text></TouchableOpacity>; }
function MenuRow({ icon, title, onPress, last }: { icon: keyof typeof Feather.glyphMap; title: string; onPress: () => void; last?: boolean }) { return <TouchableOpacity style={[s.menuRow, last && s.lastMenuRow]} onPress={onPress} activeOpacity={0.7}><Feather name={icon} size={20} color={C.muted} /><Text style={s.menuTitle}>{title}</Text><View style={s.menuSpacer} /><Feather name="chevron-right" size={21} color={C.muted} /></TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 5, flexGrow: 1 }, header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginBottom: 8 }, brandRow: { flexDirection: "row", alignItems: "center" }, mark: { color: C.red, fontSize: 34, lineHeight: 39, fontWeight: "900", fontStyle: "italic", marginRight: 5 }, brand: { color: C.text, fontSize: 21, fontWeight: "900" }, brandRed: { color: C.red }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30 }, stateText: { color: C.muted, fontSize: 17, textAlign: "center" }, retry: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", justifyContent: "center", alignItems: "center", padding: 24 }, modalCard: { width: "100%", maxWidth: 420, borderRadius: 18, padding: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, modalTitle: { color: C.text, fontSize: 21, fontWeight: "900" }, modalMessage: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 9 }, modalError: { color: "#FF9AA8", fontSize: 14, lineHeight: 20, marginTop: 12 }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 22 }, modalCancel: { minHeight: 46, minWidth: 104, paddingHorizontal: 16, borderRadius: 11, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, modalCancelText: { color: C.text, fontSize: 15, fontWeight: "800" }, modalConfirm: { minHeight: 46, minWidth: 112, paddingHorizontal: 16, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }, modalConfirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  identity: { minHeight: 180, borderRadius: 20, overflow: "hidden", justifyContent: "center", padding: 18, backgroundColor: "#22262C", borderWidth: 1, borderColor: "#353A40" }, identityDecoration: { position: "absolute", width: 210, height: 210, borderRadius: 105, right: -74, top: -99, backgroundColor: "#342027", opacity: 0.75 }, identityContent: { flexDirection: "row", alignItems: "center" }, avatar: { width: 76, height: 76, borderRadius: 23, backgroundColor: "#F7EFED", alignItems: "center", justifyContent: "center", overflow: "hidden" }, identityInfo: { marginLeft: 15, flex: 1 }, identityEyebrow: { color: "#FF9A9D", fontSize: 11, letterSpacing: 1.1, fontWeight: "900", marginBottom: 4 }, name: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "900" }, verified: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }, verifiedText: { color: "#F7EFED", fontSize: 13, fontWeight: "800" }, editProfile: { alignSelf: "flex-start", minWidth: 126, minHeight: 37, backgroundColor: C.red, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 }, editProfileText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionHeading: { marginTop: 20, marginBottom: 10 }, sectionTitle: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: "900" }, sectionHint: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }, shortcuts: { flexDirection: "row", gap: 10, marginBottom: 2 }, shortcut: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9, minHeight: 105, borderRadius: 17, paddingHorizontal: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, shortcutIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#292C31", alignItems: "center", justifyContent: "center" }, shortcutTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" }, menu: { backgroundColor: C.card, borderRadius: 17, marginTop: 0, paddingHorizontal: 15, paddingVertical: 4, borderWidth: 1, borderColor: C.line }, menuRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderBottomColor: "#2B2C2F", paddingHorizontal: 2 }, lastMenuRow: { borderBottomWidth: 0 }, menuSpacer: { flex: 1 }, menuTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "700" }, verify: { minHeight: 50, backgroundColor: C.red, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 15 }, logout: { minHeight: 57, borderWidth: 1, borderColor: C.red, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 16 }, logoutText: { color: C.red, fontSize: 16, fontWeight: "800" },
});
