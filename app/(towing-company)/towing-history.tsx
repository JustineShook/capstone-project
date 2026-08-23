// app/(towing-company)/towing-history.tsx
//
// Towing History screen for the (towing-company) provider dashboard.
// Mirrors the visual architecture of requests.tsx (header, search, filter
// chips, card list) so it reads as part of the same screen family.
//
// Mock data only — no Firebase/database changes. The TowingHistoryRecord
// shape below is intentionally flat and serializable so it can later be
// swapped for a Firestore query (e.g. towingRequests where providerId ==
// currentProvider and status in [COMPLETED, CANCELLED, DECLINED], ordered
// by completedAt desc) without touching the render logic.
//
// Navigation: tapping "View Details" (or the card itself) pushes to the
// EXISTING /(towing-company)/request-details screen with { id }, exactly
// like requests.tsx does — no separate history-details screen was created.
// Records tow-004 / tow-005 / tow-006 reuse the same ids already present
// in request-details.tsx's MOCK_REQUEST_DETAILS, so those three open with
// full details. The remaining mock entries (tow-008+) are history-only for
// now; tapping them falls back to request-details.tsx's existing
// "Request not found" state (already built into that screen) until
// matching records are added there or this is wired to real data — that
// fallback is why routing here is safe without modifying request-details.

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
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

export type HistoryStatus = "COMPLETED" | "CANCELLED" | "DECLINED";

// Deliberately flat/serializable — maps 1:1 onto a future Firestore document.
// No plate number field by design.
export interface TowingHistoryRecord {
  id: string;
  customerName: string;
  vehicleType: string; // "Motorcycle" | "Car" | "SUV" | "Pickup Truck" | "Van" | ...
  vehicleMake: string;
  vehicleModel: string;
  requestType: string;
  pickupLocation: string;
  destination: string;
  dateTime: string; // display string for now; swap for a Firestore Timestamp later
  distanceKm: number;
  finalFee: string;
  status: HistoryStatus;
}

// Mock towing history. Ids tow-004/005/006 intentionally match the records
// already defined in request-details.tsx.
const TOWING_HISTORY: TowingHistoryRecord[] = [
  {
    id: "tow-004",
    customerName: "Jerome Bautista",
    vehicleType: "Pickup Truck",
    vehicleMake: "Ford",
    vehicleModel: "Ranger",
    requestType: "Accident Recovery",
    pickupLocation: "Katipunan Avenue",
    destination: "Ford Service Center",
    dateTime: "Aug 23, 2026 \u00B7 1:15 PM",
    distanceKm: 6.1,
    finalFee: "\u20B12,400",
    status: "COMPLETED",
  },
  {
    id: "tow-005",
    customerName: "Patricia Lim",
    vehicleType: "Van",
    vehicleMake: "Suzuki",
    vehicleModel: "Ertiga",
    requestType: "Battery / Won't Start",
    pickupLocation: "Fairview",
    destination: "Suzuki Auto Service",
    dateTime: "Aug 23, 2026 \u00B7 12:30 PM",
    distanceKm: 2.9,
    finalFee: "\u20B11,000",
    status: "DECLINED",
  },
  {
    id: "tow-006",
    customerName: "Michael Tan",
    vehicleType: "SUV",
    vehicleMake: "Nissan",
    vehicleModel: "Navara",
    requestType: "Vehicle Breakdown",
    pickupLocation: "Novaliches",
    destination: "Nissan Service Center",
    dateTime: "Aug 23, 2026 \u00B7 11:05 AM",
    distanceKm: 7.3,
    finalFee: "\u20B12,000",
    status: "CANCELLED",
  },
  {
    id: "tow-008",
    customerName: "Ella Ramirez",
    vehicleType: "Motorcycle",
    vehicleMake: "Yamaha",
    vehicleModel: "Mio",
    requestType: "Motorcycle Breakdown Tow",
    pickupLocation: "Banawe",
    destination: "Yamaha Service Center, Banawe",
    dateTime: "Aug 20, 2026 \u00B7 9:12 AM",
    distanceKm: 4.0,
    finalFee: "\u20B1700",
    status: "COMPLETED",
  },
  {
    id: "tow-009",
    customerName: "Noel Villanueva",
    vehicleType: "Car",
    vehicleMake: "Toyota",
    vehicleModel: "Wigo",
    requestType: "Emergency Towing",
    pickupLocation: "Elliptical Road",
    destination: "Preferred Auto Shop, Quezon City",
    dateTime: "Aug 18, 2026 \u00B7 6:40 PM",
    distanceKm: 5.2,
    finalFee: "\u20B11,300",
    status: "CANCELLED",
  },
  {
    id: "tow-010",
    customerName: "Grace Manalo",
    vehicleType: "Pickup Truck",
    vehicleMake: "Isuzu",
    vehicleModel: "D-Max",
    requestType: "Flat Tire / Roadside Assistance",
    pickupLocation: "Congressional Avenue",
    destination: "Isuzu Service Center",
    dateTime: "Aug 17, 2026 \u00B7 2:05 PM",
    distanceKm: 3.5,
    finalFee: "\u20B1900",
    status: "DECLINED",
  },
  {
    id: "tow-011",
    customerName: "Ramon Dizon",
    vehicleType: "Car",
    vehicleMake: "Hyundai",
    vehicleModel: "Accent",
    requestType: "Vehicle Breakdown",
    pickupLocation: "Visayas Avenue",
    destination: "Hyundai Service Center",
    dateTime: "Aug 16, 2026 \u00B7 4:50 PM",
    distanceKm: 6.8,
    finalFee: "\u20B12,100",
    status: "COMPLETED",
  },
  {
    id: "tow-012",
    customerName: "Cristina Padilla",
    vehicleType: "Van",
    vehicleMake: "Toyota",
    vehicleModel: "Hiace",
    requestType: "Accident Recovery",
    pickupLocation: "EDSA cor. Quezon Avenue",
    destination: "Toyota Service Center",
    dateTime: "Aug 14, 2026 \u00B7 8:30 AM",
    distanceKm: 9.4,
    finalFee: "\u20B13,200",
    status: "COMPLETED",
  },
  {
    id: "tow-013",
    customerName: "Victor Enriquez",
    vehicleType: "SUV",
    vehicleMake: "Chevrolet",
    vehicleModel: "Trailblazer",
    requestType: "Emergency Towing",
    pickupLocation: "Mindanao Avenue",
    destination: "Chevrolet Service Center",
    dateTime: "Aug 12, 2026 \u00B7 7:15 PM",
    distanceKm: 4.6,
    finalFee: "\u20B11,600",
    status: "DECLINED",
  },
];

type FilterKey = "ALL" | "COMPLETED" | "CANCELLED" | "DECLINED";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "DECLINED", label: "Declined" },
];

// Same palette used for these three statuses in requests.tsx, kept identical
// for visual consistency between the live list and the history list.
const STATUS_STYLES: Record<
  HistoryStatus,
  { label: string; background: string; color: string }
> = {
  COMPLETED: { label: "Completed", background: "#D1FAE5", color: "#065F46" },
  DECLINED: { label: "Declined", background: "#F3F4F6", color: "#4B5563" },
  CANCELLED: { label: "Cancelled", background: "#FEE2E2", color: "#991B1B" },
};

function matchesFilter(status: HistoryStatus, filter: FilterKey): boolean {
  if (filter === "ALL") return true;
  return status === filter;
}

export default function TowingHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return TOWING_HISTORY.filter((record) => {
      if (!matchesFilter(record.status, activeFilter)) return false;
      if (!query) return true;
      const haystack =
        `${record.customerName} ${record.vehicleType} ${record.vehicleMake} ${record.vehicleModel} ${record.requestType}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Towing History</Text>
        <Text style={styles.headerSubtitle}>
          {filteredHistory.length} {filteredHistory.length === 1 ? "record" : "records"}
        </Text>
      </View>

      <View style={styles.searchWrapper}>
        <Feather name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer or vehicle"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              activeFilter === filter.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter.key && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredHistory.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="archive" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>No history matches your search.</Text>
          </View>
        )}

        {filteredHistory.map((record) => {
          const statusStyle = STATUS_STYLES[record.status];

          return (
            <TouchableOpacity
              key={record.id}
              style={styles.historyCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/(towing-company)/request-details",
                  params: { id: record.id },
                })
              }
            >
              <View style={styles.historyHeaderRow}>
                <Text style={styles.customerName}>{record.customerName}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: statusStyle.background },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                    {statusStyle.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.vehicle}>
                  {record.vehicleType} · {record.vehicleMake} {record.vehicleModel}
                </Text>
              </View>

              <View style={styles.historyDivider} />

              <View style={styles.historyDetailRow}>
                <Feather name="truck" size={14} color={COLORS.textMuted} />
                <Text style={styles.historyDetailText}>{record.requestType}</Text>
              </View>

              <View style={styles.historyDetailRow}>
                <Feather name="calendar" size={14} color={COLORS.textMuted} />
                <Text style={styles.historyDetailText}>{record.dateTime}</Text>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeColumn}>
                  <Feather name="map-pin" size={14} color={COLORS.textMuted} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {record.pickupLocation}
                  </Text>
                </View>
                <Feather name="arrow-right" size={14} color={COLORS.textMuted} />
                <View style={styles.routeColumn}>
                  <Feather name="flag" size={14} color={COLORS.textMuted} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {record.destination}
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.distance}>{record.distanceKm} km</Text>
                <Text style={styles.finalFee}>{record.finalFee}</Text>
              </View>

              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() =>
                  router.push({
                    pathname: "/(towing-company)/request-details",
                    params: { id: record.id },
                  })
                }
              >
                <Text style={styles.viewDetailsButtonText}>View Details</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.sectionBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, padding: 0 },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  filterChipTextActive: { color: "#FFFFFF" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyStateText: { fontSize: 13, color: COLORS.textMuted },

  historyCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  vehicle: { fontSize: 12, color: COLORS.textMuted },

  historyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  historyDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  historyDetailText: { fontSize: 13, color: COLORS.text },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  routeColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeText: { fontSize: 12, color: COLORS.text, flexShrink: 1 },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  distance: { fontSize: 12, color: COLORS.textMuted },
  finalFee: { fontSize: 14, fontWeight: "700", color: COLORS.primary },

  viewDetailsButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  viewDetailsButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
}); 