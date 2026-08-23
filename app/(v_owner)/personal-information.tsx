// app/(v_owner)/personal-information.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUserProfile } from "@/services/auth";
import { auth } from "@/services/firebase";
import type { UserProfile, UserRole } from "@/types/user";

// Same design tokens as components/profile.tsx — keep in sync if that
// palette changes, or move both to a shared theme file.
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

// Same row component as Profile — display-only rows just omit onPress,
// but still render the chevron so the two screens look identical.
type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  isLast?: boolean;
};

function InfoRow({ icon, label, value, isLast }: RowProps) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View>
          <Text style={styles.rowLabel}>{label}</Text>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

// ---------------------------------------------------------------------------
// SCREEN — read-only for now. Editing (updateDoc / updateProfile) isn't
// wired up yet since it wasn't part of the current scope; this just shows
// the live Auth + Firestore values so the row isn't a dead end.
// ---------------------------------------------------------------------------
export default function PersonalInformationScreen() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const userProfile = await getUserProfile(user.uid);
        setProfile(userProfile);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const displayName = profile?.displayName || firebaseUser?.displayName || "Unnamed User";
  const email = profile?.email || firebaseUser?.email || "No email on file";
  const roleLabel = profile ? formatRole(profile.role) : "—";

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
        {/* Back + title, same typography scale as the rest of the app */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={styles.pageTitle}>Personal Information</Text>
        </View>

        {/* Profile Card — identical hero to components/profile.tsx */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={40} color={COLORS.white} />
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Details Section */}
        <SectionLabel text="Details" />
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Full Name" value={displayName} />
          <InfoRow icon="mail-outline" label="Email Address" value={email} />
          <InfoRow icon="call-outline" label="Phone Number" value="Not provided" />
          <InfoRow icon="shield-checkmark-outline" label="Role" value={roleLabel} isLast />
        </View>

        <Text style={styles.note}>
          Editing personal information isn&apos;t available yet — this screen currently
          shows your account details for reference only.
        </Text>

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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },

  // Profile card — matches components/profile.tsx exactly
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
    marginBottom: 20,
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

  note: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginLeft: 4,
  },
});