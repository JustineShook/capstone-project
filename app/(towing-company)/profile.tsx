// app/(towing)/profile.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#2E7D32",
  successMuted: "#E8F5E9",
};

const TOWING_PROFILE = {
  name: "Metro Towing Services",
  role: "Towing Company",
  email: "contact@metrotowing.example.com",
  phone: "0917 555 2468",
  operatingHours: "24/7 - Every Day",
  serviceArea: "Metro Cebu",
  availability: "AVAILABLE",
  rating: 4.6,
  completedJobs: 132,
  verificationStatus: "VERIFIED", // "INCOMPLETE" | "PENDING" | "VERIFIED" | "REJECTED"
};

const TOWING_SERVICES = [
  "Flatbed Towing",
  "Wheel-Lift Towing",
  "Emergency Roadside Assistance",
  "Accident Recovery",
];

const VEHICLE_TYPES_SUPPORTED = [
  "Motorcycle",
  "Car",
  "SUV",
  "Pickup Truck",
  "Van",
];

export default function TowingProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isVerified = TOWING_PROFILE.verificationStatus === "VERIFIED";

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          signOut(auth).catch((error) => {
            console.error("Logout failed:", error);
            Alert.alert("Error", "Could not log out. Please try again.");
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Feather name="truck" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{TOWING_PROFILE.name}</Text>
          <Text style={styles.role}>{TOWING_PROFILE.role}</Text>

          {isVerified ? (
            <View style={styles.verifiedBadge}>
              <Feather name="check-circle" size={12} color={COLORS.success} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.unverifiedBadge}
              onPress={() => router.push("/(towing-company)/verification")}
              activeOpacity={0.7}
            >
              <Feather name="alert-circle" size={12} color={COLORS.primary} />
              <Text style={styles.unverifiedBadgeText}>
                {TOWING_PROFILE.verificationStatus === "PENDING"
                  ? "Verification Pending"
                  : "Complete Verification"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{TOWING_PROFILE.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{TOWING_PROFILE.completedJobs}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityBadgeText}>
                  {TOWING_PROFILE.availability}
                </Text>
              </View>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editButton}>
            <Feather name="edit-2" size={14} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Personal / contact information */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>CONTACT INFORMATION</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Feather name="mail" size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{TOWING_PROFILE.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="phone" size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{TOWING_PROFILE.phone}</Text>
          </View>
        </View>

        {/* Company information */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>COMPANY INFORMATION</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Feather name="clock" size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{TOWING_PROFILE.operatingHours}</Text>
          </View>
          <Text style={styles.specializationLabel}>Towing Services Offered</Text>
          <View style={styles.tagRow}>
            {TOWING_SERVICES.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vehicle types supported */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>VEHICLE TYPES SUPPORTED</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.tagRow}>
            {VEHICLE_TYPES_SUPPORTED.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Service area */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>SERVICE AREA</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{TOWING_PROFILE.serviceArea}</Text>
          </View>
        </View>

        {/* Account */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>ACCOUNT</Text>
        </View>
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Feather name="log-out" size={16} color={COLORS.primary} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* TEMP: quick preview link for the verification screen — remove later */}
        <TouchableOpacity
          style={styles.previewButton}
          onPress={() => router.push("/(towing-company)/verification")}
        >
          <Feather name="external-link" size={13} color={COLORS.textMuted} />
          <Text style={styles.previewButtonText}>Preview Verification Page</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  identityCard: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  name: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  role: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 8,
  },
  verifiedBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.success },

  unverifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 8,
  },
  unverifiedBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.3)" },
  statValue: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  availabilityBadge: {
    backgroundColor: COLORS.successMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  availabilityBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.success },

  editButton: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  editButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  sectionHeaderRow: { marginTop: 22, marginBottom: 10 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  infoText: { fontSize: 13, color: COLORS.text },

  specializationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: COLORS.sectionBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: { fontSize: 12, color: COLORS.text, fontWeight: "500" },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoutText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },

  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    paddingVertical: 10,
  },
  previewButtonText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
});