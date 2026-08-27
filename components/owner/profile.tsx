import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUserProfile, logout } from "../../services/auth";
import { auth } from "../../services/firebase";
import { getOwnerVerificationProfile } from "../../services/ownerVerificationProfileService";
import type { UserProfile, UserRole } from "../../types/user";
import type { OwnerVerificationProfile } from "../../types/ownerVerificationProfile";

const COLORS = {
  primary: "#D32F2F",
  darkRed: "#B71C1C",
  white: "#FFFFFF",
  background: "#F7F7F7",
  textPrimary: "#1A1A1A",
  textSecondary: "#7A7A7A",
  border: "#EDEDED",
};

function formatRole(role: UserRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "onsite-mechanic":
      return "Onsite Mechanic";
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
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </Wrapper>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export default function ProfileScreen() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verificationProfile, setVerificationProfile] = useState<OwnerVerificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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

      setLoading(true);
      setLoadError(null);
      try {
        const [userProfile, ownerVerification] = await Promise.all([
          getUserProfile(user.uid),
          getOwnerVerificationProfile(user.uid),
        ]);
        setProfile(userProfile);
        setVerificationProfile(ownerVerification);
        if (!userProfile) {
          setLoadError("We couldn't find your profile details.");
        }
      } catch (err) {
        setLoadError((err as Error)?.message ?? "Failed to load your profile.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert("Log Out Failed", (err as Error)?.message ?? "Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  // Sensible fallbacks — UserProfile has no phone field at all yet, and
  // displayName/email could theoretically be missing from the Firestore
  // doc even though Auth has them, so we fall back across both sources.
  const displayName = profile?.displayName || firebaseUser?.displayName || "Unnamed User";
  const email = profile?.email || firebaseUser?.email || "No email on file";
  const roleLabel = profile ? formatRole(profile.role) : "—";
  const phone = verificationProfile?.personal.phone || "Not provided";

  const verificationStatus = verificationProfile?.verificationStatus ?? "INCOMPLETE";
  const verificationLabel = verificationStatus === "VERIFIED" ? "Verified" : verificationStatus === "PENDING" ? "Verification Pending" : verificationStatus === "REJECTED" ? "Verification Rejected" : "Complete Verification";

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={40} color={COLORS.white} />
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>

          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        </View>

        {/* Account Section */}
        <SectionLabel text="Account" />
        <View style={styles.card}>
          <ProfileRow
            icon="person-outline"
            label="Personal Information"
            onPress={() => router.push("/(v_owner)/personal-information")}
          />
          <ProfileRow
            icon="call-outline"
            label="Phone Number"
            value={phone}
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
        <SectionLabel text="My VeResc" />
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
        <SectionLabel text="Settings" />
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

        {/* Log Out */}
        <TouchableOpacity
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={COLORS.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>

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
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 16,
  },

  // Profile card
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    marginTop: 14,
    backgroundColor: "#FDECEC",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.darkRed,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: "center",
  },

  // Section labels
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Rectangular grouped card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  rowValue: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Log out button
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
