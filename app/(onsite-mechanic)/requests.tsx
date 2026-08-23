// app/(onsite-mechanic)/requests.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  success: "#2E7D32",
  successMuted: "#E8F5E9",
};

type RequestStatus = "PENDING" | "ACCEPTED" | "COMPLETED";
type FilterKey = "NEW" | "ACCEPTED" | "COMPLETED";

interface ServiceRequest {
  id: string;
  customerName: string;
  phone: string;
  vehicle: string;
  year: number;
  plate: string;
  serviceType: string;
  problem: string;
  location: string;
  distanceKm: number;
  estimatedFee: string;
  status: RequestStatus;
}

// Mock data — matches the records shown on request-details.tsx
export const MOCK_REQUESTS: ServiceRequest[] = [
  {
    id: "req-001",
    customerName: "Maria Santos",
    phone: "0917 456 7821",
    vehicle: "Toyota Vios",
    year: 2020,
    plate: "ABC 1234",
    serviceType: "Battery Replacement",
    problem: "Vehicle won't start and battery appears weak.",
    location: "Quezon City",
    distanceKm: 2.4,
    estimatedFee: "\u20B1650",
    status: "PENDING",
  },
  {
    id: "req-002",
    customerName: "Carlos Reyes",
    phone: "0918 234 6712",
    vehicle: "Honda Civic",
    year: 2019,
    plate: "DEF 5678",
    serviceType: "Engine Diagnostics",
    problem: "Engine warning light is on and vehicle is losing power.",
    location: "Diliman, Quezon City",
    distanceKm: 4.1,
    estimatedFee: "\u20B1900",
    status: "PENDING",
  },
  {
    id: "req-003",
    customerName: "Angela Cruz",
    phone: "0920 781 3456",
    vehicle: "Mitsubishi Mirage",
    year: 2021,
    plate: "GHI 9012",
    serviceType: "Tire Replacement",
    problem: "Flat front-right tire.",
    location: "Cubao, Quezon City",
    distanceKm: 5.8,
    estimatedFee: "\u20B1750",
    status: "PENDING",
  },
];

const FILTERS: FilterKey[] = ["NEW", "ACCEPTED", "COMPLETED"];

function matchesFilter(status: RequestStatus, filter: FilterKey): boolean {
  if (filter === "NEW") return status === "PENDING";
  return status === filter;
}

function statusBadgeStyle(status: RequestStatus) {
  if (status === "COMPLETED") {
    return { backgroundColor: COLORS.successMuted, color: COLORS.success };
  }
  if (status === "ACCEPTED") {
    return { backgroundColor: COLORS.primaryMuted, color: COLORS.primary };
  }
  return { backgroundColor: COLORS.sectionBackground, color: COLORS.textMuted };
}

export default function RequestsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("NEW");
  const insets = useSafeAreaInsets();

  const filteredRequests = useMemo(
    () => MOCK_REQUESTS.filter((request) => matchesFilter(request.status, activeFilter)),
    [activeFilter]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Requests</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={22} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>No requests in this category.</Text>
          </View>
        )}

        {filteredRequests.map((request) => {
          const badge = statusBadgeStyle(request.status);
          return (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/(onsite-mechanic)/request-details",
                  params: { id: request.id },
                })
              }
            >
              <View style={styles.requestHeaderRow}>
                <Text style={styles.customerName}>{request.customerName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                    {request.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.vehicle}>
                {request.vehicle} {request.year} &middot; {request.plate}
              </Text>

              <View style={styles.requestDivider} />

              <View style={styles.requestDetailRow}>
                <Feather name="tool" size={14} color={COLORS.textMuted} />
                <Text style={styles.requestDetailText}>{request.serviceType}</Text>
              </View>
              <View style={styles.requestDetailRow}>
                <Feather name="map-pin" size={14} color={COLORS.textMuted} />
                <Text style={styles.requestDetailText}>
                  {request.location} &middot; {request.distanceKm} km
                </Text>
              </View>
              <View style={styles.requestDetailRow}>
                <Feather name="credit-card" size={14} color={COLORS.textMuted} />
                <Text style={styles.requestDetailText}>Estimated {request.estimatedFee}</Text>
              </View>

              <View style={styles.viewRequestButton}>
                <Text style={styles.viewRequestButtonText}>View Request</Text>
                <Feather name="chevron-right" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: COLORS.background,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.sectionBackground,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  filterChipTextActive: { color: "#FFFFFF" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyStateText: { fontSize: 13, color: COLORS.textMuted },

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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  viewRequestButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});