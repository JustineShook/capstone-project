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

const COLORS = {
  primary: "#F52239",
  darkRed: "#FF8995",
  white: "#F4F6F8",
  background: "#0C1015",
  surface: "#151C23",
  surfaceAlt: "#1C252E",
  textPrimary: "#F4F6F8",
  textSecondary: "#AAB5C0",
  border: "#28313A",
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
        <View>
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
    <Text style={styles.shortcutTitle} numberOfLines={1}>{title}</Text>
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}><Text style={styles.brandMark}>V</Text><Text style={styles.brandText}>Ve<Text style={styles.brandRed}>Resc</Text></Text></View>
          <TouchableOpacity style={styles.headerAction} onPress={() => router.push("/(v_owner)/notifications")} accessibilityRole="button" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={21} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Profile summary */}
        <View style={styles.profileCard}>
          <View style={styles.identityContent}>
            <View style={styles.avatarWrap}>
              {profilePhotoUrl ? <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} /> : <Ionicons name="person" size={36} color={COLORS.primary} />}
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.identityEyebrow}>VEHICLE OWNER</Text>
              <Text style={styles.profileName} numberOfLines={2}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
              <View style={styles.identityMetaRow}>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
                <TouchableOpacity style={styles.verificationPill} onPress={() => router.push("/(v_owner)/verification")} accessibilityRole="button">
                  <View style={[styles.verificationDot, verificationStatus === "VERIFIED" && styles.verificationDotActive]} />
                  <Text style={styles.verificationText} numberOfLines={1}>{verificationLabel}</Text>
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
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={COLORS.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>
        {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: 16, paddingTop: 5, paddingBottom: 30, flexGrow: 1 },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, marginBottom: 8 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandMark: { color: COLORS.primary, fontSize: 34, lineHeight: 39, fontWeight: "900", fontStyle: "italic", marginRight: 5 },
  brandText: { color: COLORS.textPrimary, fontSize: 21, fontWeight: "900" },
  brandRed: { color: COLORS.primary },
  headerAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Profile card
  profileCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 19,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FF5365",
    overflow: "hidden",
  },
  identityContent: { flexDirection: "row", alignItems: "center" },
  identityInfo: { flex: 1, marginLeft: 14 },
  identityEyebrow: { color: "#FFD7DC", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: 3 },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#F4F0EF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  profileName: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileEmail: {
    fontSize: 12,
    color: "#FFE4E7",
    marginTop: 4,
  },
  identityMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 8 },
  roleBadge: {
    backgroundColor: "rgba(40,10,16,0.35)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  verificationPill: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 180, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: "rgba(40,10,16,0.35)" },
  verificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFD27B" },
  verificationDotActive: { backgroundColor: "#62D5A5" },
  verificationText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  editProfileButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(40,10,16,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.52)", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 9 },
  editProfileText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: "center",
  },

  // Section labels
  sectionLabel: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  sectionHeading: { marginTop: 10, marginBottom: 10, marginLeft: 2 },
  sectionHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Rectangular grouped card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
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
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  rowValue: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rowEndSpacer: { width: 18 },

  // Log out button
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    minHeight: 54,
    marginTop: 2,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  logoutError: {
    color: "#FF8995",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 8,
  },
  shortcuts: { flexDirection: "row", gap: 10, marginBottom: 3 },
  shortcut: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, minHeight: 96, borderRadius: 17, paddingHorizontal: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  shortcutIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center" },
  shortcutTitle: { color: COLORS.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: "700", textAlign: "center" },
  verifyButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 2, marginBottom: 12, backgroundColor: COLORS.primary, borderRadius: 12 },
  verifyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
