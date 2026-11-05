import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getUserProfile, logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getOwnerVerificationProfile } from "../../services/ownerVerificationProfileService";
import type { UserProfile, UserRole } from "../../types/user";
import type { OwnerVerificationProfile } from "../../types/ownerVerificationProfile";
import { homeColors as colors } from "../../constants/owner/homeTheme";

const COLORS = {
  primary: colors.primary,
  darkRed: colors.busy,
  white: colors.white,
  background: colors.background,
  surface: colors.surface,
  surfaceAlt: colors.surfaceAlt,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  border: colors.border,
};

function formatRole(role: UserRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "onsite-mechanic":
      return "Indie Mechanic";
    case "shop-owner":
      return "Shop Owner";
    case "towing-company":
      return "Towing Company";
    default:
      return role;
  }
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
};

function ProfileRow({ icon, label, value, onPress, isLast }: RowProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.row, isLast && styles.rowLast]}
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowLabel}>{label}</Text>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} /> : <View style={styles.rowEndSpacer} />}
    </Wrapper>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Shortcut({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
    <View style={styles.shortcutIcon}><Ionicons name={icon} size={21} color={COLORS.textPrimary} /></View>
    <Text style={styles.shortcutTitle} >{title}</Text>
  </TouchableOpacity>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verificationProfile, setVerificationProfile] = useState<OwnerVerificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const hasFocusedOnce = useRef(false);

  const loadAccountData = useCallback(async (user: FirebaseUser) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [userProfile, ownerVerification] = await Promise.all([
        getUserProfile(user.uid),
        getOwnerVerificationProfile(user.uid),
      ]);
      setProfile(userProfile);
      setVerificationProfile(ownerVerification);
      if (!userProfile) setLoadError("We couldn't find your profile details.");
    } catch (err) {
      setLoadError((err as Error)?.message ?? "Failed to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Live auth state — no separate global auth listener was found in the
  // files provided, so this component owns its own onAuthStateChanged.
  // If you already have a shared useAuth()/AuthContext elsewhere, swap
  // this effect out for that instead of running two listeners.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        // Not signed in — nothing to show here.
        setProfile(null);
        setLoading(false);
        router.replace("/(auth)/login");
        return;
      }

      await loadAccountData(user);
    });

    return unsubscribe;
  }, [loadAccountData, router]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      const user = auth.currentUser;
      if (user) void loadAccountData(user);
    }, [loadAccountData])
  );

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (err) {
      setLogoutError((err as Error)?.message || "We couldn't log you out. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  // Sensible fallbacks — UserProfile has no phone field at all yet, and
  // displayName/email could theoretically be missing from the Firestore
  // doc even though Auth has them, so we fall back across both sources.
  const displayName = verificationProfile?.personal.fullName || profile?.displayName || firebaseUser?.displayName || "Unnamed User";
  const email = profile?.email || firebaseUser?.email || "No email on file";
  const roleLabel = profile ? formatRole(profile.role) : "—";
  const phone = verificationProfile?.personal.phone || firebaseUser?.phoneNumber || "Not provided";
  const address = verificationProfile?.personal.address || "Not provided";
  const cityMunicipality = verificationProfile?.personal.cityMunicipality || "Not provided";
  const profilePhotoUrl = verificationProfile?.identification.profilePhotoUrl || firebaseUser?.photoURL;

  const verificationStatus = verificationProfile?.verificationStatus ?? "INCOMPLETE";
  const verificationLabel = verificationStatus === "VERIFIED" ? "Verified" : verificationStatus === "PENDING" ? "Verification Pending" : verificationStatus === "REJECTED" ? "Verification Rejected" : "Complete Verification";

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle={"light-content"} backgroundColor={"#0F52BA"} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, styles.profileScreen]} edges={["left", "right"]}>
      <StatusBar barStyle={"light-content"} backgroundColor={"#0F52BA"} />
      <SafeAreaView style={[styles.header, styles.staticHeader]} edges={["top"]}>
        <View style={styles.brandRow}><Text style={[styles.brandMark, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>V</Text><Text style={[styles.brandText, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>Ve<Text style={[styles.brandRed, { color: "#FFFFFF" }]}>Resc</Text></Text></View>
        <TouchableOpacity style={[styles.headerAction, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }]} onPress={() => router.push("/(v_owner)/notifications")} accessibilityRole="button" accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={21} color={"#FFFFFF"} />
        </TouchableOpacity>
      </SafeAreaView>
      <View style={styles.scrollSurface}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >

        {/* Profile summary */}
        <View style={styles.profileCard}>
          <View style={styles.identityContent}>
            <View style={styles.avatarWrap}>
              {profilePhotoUrl ? <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} /> : <Ionicons name="person" size={36} color={COLORS.primary} />}
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.identityEyebrow}>VEHICLE OWNER</Text>
              <Text style={styles.profileName} >{displayName}</Text>
              <Text style={styles.profileEmail} >{email}</Text>
              <View style={styles.identityMetaRow}>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
                <TouchableOpacity style={styles.verificationPill} onPress={() => router.push("/(v_owner)/verification")} accessibilityRole="button">
                  <View style={[styles.verificationDot, verificationStatus === "VERIFIED" && styles.verificationDotActive, verificationStatus === "REJECTED" && styles.verificationDotRejected]} />
                  <Text style={styles.verificationText} >{verificationLabel}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.editProfileButton} activeOpacity={0.82} onPress={() => router.push("/(v_owner)/personal-information")} accessibilityRole="button">
                <Ionicons name="create-outline" size={15} color={COLORS.white} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        </View>

        <View style={styles.shortcuts}>
          <Shortcut icon="car-outline" title="My Vehicles" onPress={() => router.push("/(v_owner)/vehicle")} />
          <Shortcut icon="time-outline" title="Service History" onPress={() => router.push("/(v_owner)/history")} />
          <Shortcut icon="shield-checkmark-outline" title="Verification" onPress={() => router.push("/(v_owner)/verification")} />
        </View>

        {/* Account Section */}
        <View style={styles.sectionHeading}><SectionLabel text="Account" /><Text style={styles.sectionHint}>Your personal and contact information</Text></View>
        <View style={styles.card}>
          <ProfileRow
            icon="person-outline"
            label="Personal Information"
            value={displayName}
            onPress={() => router.push("/(v_owner)/personal-information")}
          />
          <ProfileRow
            icon="call-outline"
            label="Phone Number"
            value={phone}
          />
          <ProfileRow
            icon="location-outline"
            label="Address"
            value={address}
          />
          <ProfileRow
            icon="business-outline"
            label="City / Municipality"
            value={cityMunicipality}
          />
          <ProfileRow
            icon="shield-checkmark-outline"
            label="Account Verification"
            value={verificationLabel}
            onPress={() => router.push("/(v_owner)/verification")}
          />
          <ProfileRow
            icon="mail-outline"
            label="Email Address"
            value={email}
            isLast
          />
        </View>

        {/* My VeResc Section */}
        <View style={styles.sectionHeading}><SectionLabel text="My VeResc" /><Text style={styles.sectionHint}>Your vehicles and service activity</Text></View>
        <View style={styles.card}>
          <ProfileRow
            icon="car-outline"
            label="My Vehicles"
            onPress={() => router.push("/(v_owner)/vehicle")}
          />
          <ProfileRow
            icon="document-text-outline"
            label="Service History"
            onPress={() => router.push("/(v_owner)/history")}
            isLast
          />
        </View>

        {/* Settings Section */}
        <View style={styles.sectionHeading}><SectionLabel text="Settings" /><Text style={styles.sectionHint}>Manage your account preferences</Text></View>
        <View style={styles.card}>
          <ProfileRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/(v_owner)/notifications")}
          />
          <ProfileRow
            icon="lock-closed-outline"
            label="Privacy & Security"
            onPress={() => router.push("/(v_owner)/privacy-security")}
          />
          <ProfileRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push("/(v_owner)/help-support")}
            isLast
          />
        </View>

        {(verificationStatus === "INCOMPLETE" || verificationStatus === "REJECTED") && (
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => router.push("/(v_owner)/verification")}
            accessibilityRole="button"
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
            <Text style={styles.verifyButtonText}>{verificationStatus === "REJECTED" ? "Correct & Resubmit" : "Complete Verification"}</Text>
          </TouchableOpacity>
        )}

        {/* Log Out */}
        <TouchableOpacity
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.darkRed} />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={COLORS.darkRed}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>
        {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}

        <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileScreen: { backgroundColor: "#0F52BA" },
  staticHeader: { marginHorizontal: 0, marginTop: 0, marginBottom: 0, backgroundColor: "#0F52BA", borderBottomWidth: 0, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
  scrollSurface: { flex: 1, backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  container: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: 16, paddingTop: 5, paddingBottom: 30, flexGrow: 1 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginBottom: 8 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandMark: { color: COLORS.primary, fontSize: 34, lineHeight: 39, fontWeight: "700", fontStyle: "italic", marginRight: 5 },
  brandText: { color: COLORS.textPrimary, fontSize: 21, fontWeight: "700" },
  brandRed: { color: COLORS.primary },
  headerAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Profile card
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  identityContent: { flexDirection: "row", alignItems: "center" },
  identityInfo: { flex: 1, minWidth: 0, marginLeft: 14 },
  identityEyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, marginBottom: 4 },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  profileName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 13, lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  identityMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 8 },
  roleBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  verificationPill: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: COLORS.surfaceAlt },
  verificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#854D0E" },
  verificationDotActive: { backgroundColor: colors.success },
  verificationDotRejected: { backgroundColor: colors.busy },
  verificationText: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: "500", flexShrink: 1 },
  editProfileButton: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: COLORS.primary, borderRadius: 11, paddingHorizontal: 12, marginTop: 10 },
  editProfileText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: "center",
  },

  // Section labels
  sectionLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textTransform: "none",
    letterSpacing: 0.2,
  },
  sectionHeading: { marginTop: 20, marginBottom: 10, marginLeft: 2 },
  sectionHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Rectangular grouped card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15, lineHeight: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  rowValue: {
    fontSize: 13, lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowEndSpacer: { width: 18 },

  // Log out button
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.darkRed,
    borderRadius: 14,
    minHeight: 54,
    marginTop: 2,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: COLORS.darkRed,
    fontSize: 15,
    fontWeight: "700",
  },
  logoutError: {
    color: COLORS.darkRed,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 8,
  },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 3 },
  shortcut: { flex: 1, minWidth: 84, alignItems: "center", justifyContent: "center", gap: 9, minHeight: 100, borderRadius: 20, paddingHorizontal: 7, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  shortcutIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center" },
  shortcutTitle: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  verifyButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 2, marginBottom: 12, backgroundColor: COLORS.primary, borderRadius: 12 },
  verifyButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "700" },
});
