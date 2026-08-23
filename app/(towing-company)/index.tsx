// app/(towing-company)/index.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

type Availability = "AVAILABLE" | "NOT AVAILABLE";

interface SummaryStat {
  label: string;
  value: string;
}

interface TowingRequest {
  id: string;
  customerName: string;
  vehicle: string;
  requestType: string;
  location: string;
  destination: string;
  distanceKm: number;
  estimatedPrice: string;
}

const SUMMARY_STATS: SummaryStat[] = [
  { label: "New Requests", value: "4" },
  { label: "Active Tow", value: "1" },
  { label: "Completed Tows", value: "38" },
  { label: "Today's Earnings", value: "\u20B13,200" },
];

const TOWING_REQUESTS: TowingRequest[] = [
  {
    id: "tow-1",
    customerName: "Maria Santos",
    vehicle: "Toyota Vios 2020",
    requestType: "Emergency Towing",
    location: "Quezon City",
    destination: "Auto Repair Shop, Diliman",
    distanceKm: 3.2,
    estimatedPrice: "\u20B11,200",
  },
  {
    id: "tow-2",
    customerName: "Carlos Reyes",
    vehicle: "Honda Civic 2019",
    requestType: "Vehicle Breakdown",
    location: "Commonwealth Avenue",
    destination: "Quezon City Auto Center",
    distanceKm: 5.6,
    estimatedPrice: "\u20B11,800",
  },
  {
    id: "tow-3",
    customerName: "Angela Cruz",
    vehicle: "Mitsubishi Mirage 2021",
    requestType: "Flat Tire / Roadside Assistance",
    location: "Cubao",
    destination: "Customer's preferred shop",
    distanceKm: 4.8,
    estimatedPrice: "\u20B11,500",
  },
];

const QUICK_ACTIONS: { label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { label: "Requests", icon: "file-text" },
  { label: "Active Tow", icon: "truck" },
  { label: "Availability", icon: "toggle-right" },
  { label: "History", icon: "clock" },
  { label: "Earnings", icon: "credit-card" },
  { label: "Notifications", icon: "bell" },
];

export default function TowingCompanyDashboard() {
  const router = useRouter();
  const [availability, setAvailability] = useState<Availability>("AVAILABLE");
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primary}
      />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.brand}>VeResc</Text>
          <Text style={styles.role}>Towing Service</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="bell" size={20} color="#FFFFFF" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatar}>
            <Feather name="user" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Availability */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                availability === "AVAILABLE" && styles.segmentActive,
              ]}
              onPress={() => setAvailability("AVAILABLE")}
            >
              <Text
                style={[
                  styles.segmentText,
                  availability === "AVAILABLE" && styles.segmentTextActive,
                ]}
              >
                AVAILABLE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                availability === "NOT AVAILABLE" && styles.segmentActive,
              ]}
              onPress={() => setAvailability("NOT AVAILABLE")}
            >
              <Text
                style={[
                  styles.segmentText,
                  availability === "NOT AVAILABLE" && styles.segmentTextActive,
                ]}
              >
                NOT AVAILABLE
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.availabilityDescription}>
            {availability === "AVAILABLE"
              ? "You are currently available to receive towing requests."
              : "You will not receive new towing requests while unavailable."}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          {SUMMARY_STATS.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.summaryRow,
                index === SUMMARY_STATS.length - 1 && styles.summaryRowLast,
              ]}
            >
              <Text style={styles.summaryLabel}>{stat.label}</Text>
              <Text style={styles.summaryValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Towing Requests */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>TOWING REQUESTS</Text>
        </View>

        {TOWING_REQUESTS.map((request) => (
          <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: "/(towing-company)/request-details",
                params: { id: request.id },
              })
            }
          >
            <View style={styles.requestHeaderRow}>
              <Text style={styles.customerName}>{request.customerName}</Text>
              <Text style={styles.distance}>{request.distanceKm} km</Text>
            </View>
            <Text style={styles.vehicle}>{request.vehicle}</Text>

            <View style={styles.requestDivider} />

            <View style={styles.requestDetailRow}>
              <Feather name="truck" size={14} color={COLORS.textMuted} />
              <Text style={styles.requestDetailText}>{request.requestType}</Text>
            </View>
            <View style={styles.requestDetailRow}>
              <Feather name="map-pin" size={14} color={COLORS.textMuted} />
              <Text style={styles.requestDetailText}>{request.location}</Text>
            </View>
            <View style={styles.requestDetailRow}>
              <Feather name="flag" size={14} color={COLORS.textMuted} />
              <Text style={styles.requestDetailText}>{request.destination}</Text>
            </View>
            <View style={styles.requestDetailRow}>
              <Feather name="credit-card" size={14} color={COLORS.textMuted} />
              <Text style={styles.requestDetailText}>
                Estimated {request.estimatedPrice}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewRequestButton}
              onPress={() =>
                router.push({
                  pathname: "/(towing-company)/request-details",
                  params: { id: request.id },
                })
              }
            >
              <Text style={styles.viewRequestButtonText}>View Request</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Quick Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickAction}>
              <View style={styles.quickActionIcon}>
                <Feather name={action.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
  },
  brand: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.2 },
  role: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconButton: { padding: 4 },
  notificationDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },

  segmentedControl: {
    flexDirection: "row",
    backgroundColor: COLORS.sectionBackground,
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.3 },
  segmentTextActive: { color: "#FFFFFF" },
  availabilityDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 10,
    lineHeight: 17,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  summaryLabel: { fontSize: 13, color: COLORS.textMuted },
  summaryValue: { fontSize: 15, fontWeight: "700", color: COLORS.text },

  sectionHeaderRow: { marginTop: 22, marginBottom: 10 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },

  requestCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  requestHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  distance: { fontSize: 12, color: COLORS.textMuted },
  vehicle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  requestDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  requestDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  requestDetailText: { fontSize: 13, color: COLORS.text },
  viewRequestButton: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  viewRequestButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickAction: {
    flexBasis: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.sectionBackground,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionLabel: { fontSize: 11, color: COLORS.text, fontWeight: "500", textAlign: "center" },
});