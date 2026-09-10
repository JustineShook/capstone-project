// app/(towing-company)/requests.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { subscribeToTowingRequests } from "../../services/owner/towingService";
import type { TowingBookingRequest } from "../../types/owner/towing";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

type RequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

type RequestPriority = "HIGH" | "MEDIUM" | "LOW";

interface TowingRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  plateNumber: string;
  requestType: string;
  problemDescription: string;
  pickupLocation: string;
  pickupAddress: string;
  destination: string;
  destinationAddress: string;
  distanceKm: number;
  estimatedFee: string;
  status: RequestStatus;
  requestedAt: string;
  priority: RequestPriority;
  latitude: number;
  longitude: number;
}

// Mock towing requests. IDs must stay in sync with request-details.tsx
// (tow-001, tow-002, ...) so navigation resolves to matching data.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained only for legacy UI reference while live requests use Firestore
const TOWING_REQUESTS: TowingRequest[] = [
  {
    id: "tow-001",
    customerName: "Maria Santos",
    customerPhone: "0917 456 7821",
    vehicleMake: "Toyota",
    vehicleModel: "Vios",
    vehicleYear: 2020,
    plateNumber: "ABC 1234",
    requestType: "Emergency Towing",
    problemDescription: "Vehicle suddenly stopped and will not start.",
    pickupLocation: "Quezon City",
    pickupAddress: "Commonwealth Avenue, Quezon City",
    destination: "Auto Repair Shop",
    destinationAddress: "Diliman, Quezon City",
    distanceKm: 3.2,
    estimatedFee: "\u20B11,200",
    status: "PENDING",
    requestedAt: "Today, 5:20 PM",
    priority: "HIGH",
    latitude: 14.676,
    longitude: 121.0437,
  },
  {
    id: "tow-002",
    customerName: "Carlos Reyes",
    customerPhone: "0918 223 4456",
    vehicleMake: "Honda",
    vehicleModel: "Civic",
    vehicleYear: 2019,
    plateNumber: "NDW 8821",
    requestType: "Vehicle Breakdown",
    problemDescription: "Engine overheated and shut off on the road.",
    pickupLocation: "Commonwealth Avenue",
    pickupAddress: "Commonwealth Avenue cor. Regalado, Quezon City",
    destination: "Quezon City Auto Center",
    destinationAddress: "Tandang Sora, Quezon City",
    distanceKm: 5.6,
    estimatedFee: "\u20B11,800",
    status: "ACCEPTED",
    requestedAt: "Today, 4:05 PM",
    priority: "MEDIUM",
    latitude: 14.6929,
    longitude: 121.0805,
  },
  {
    id: "tow-003",
    customerName: "Angela Cruz",
    customerPhone: "0920 774 1198",
    vehicleMake: "Mitsubishi",
    vehicleModel: "Mirage",
    vehicleYear: 2021,
    plateNumber: "GHY 5093",
    requestType: "Flat Tire / Roadside Assistance",
    problemDescription: "Rear tire blowout, spare tire not available.",
    pickupLocation: "Cubao",
    pickupAddress: "Gen. Araneta Avenue, Cubao, Quezon City",
    destination: "Customer's preferred shop",
    destinationAddress: "Aurora Boulevard, Cubao, Quezon City",
    distanceKm: 4.8,
    estimatedFee: "\u20B11,500",
    status: "IN_PROGRESS",
    requestedAt: "Today, 3:40 PM",
    priority: "MEDIUM",
    latitude: 14.6199,
    longitude: 121.0528,
  },
  {
    id: "tow-004",
    customerName: "Jerome Bautista",
    customerPhone: "0915 662 9034",
    vehicleMake: "Ford",
    vehicleModel: "Ranger",
    vehicleYear: 2018,
    plateNumber: "KFC 2201",
    requestType: "Accident Recovery",
    problemDescription: "Minor collision, front bumper detached, vehicle undrivable.",
    pickupLocation: "Katipunan Avenue",
    pickupAddress: "Katipunan Avenue, Loyola Heights, Quezon City",
    destination: "Ford Service Center",
    destinationAddress: "E. Rodriguez Sr. Avenue, Quezon City",
    distanceKm: 6.1,
    estimatedFee: "\u20B12,400",
    status: "COMPLETED",
    requestedAt: "Today, 1:15 PM",
    priority: "HIGH",
    latitude: 14.6394,
    longitude: 121.0774,
  },
  {
    id: "tow-005",
    customerName: "Patricia Lim",
    customerPhone: "0927 331 8850",
    vehicleMake: "Suzuki",
    vehicleModel: "Ertiga",
    vehicleYear: 2022,
    plateNumber: "TRZ 7742",
    requestType: "Battery / Won't Start",
    problemDescription: "Dead battery, requested tow to nearest service center instead of jumpstart.",
    pickupLocation: "Fairview",
    pickupAddress: "Fairview Terraces, Quezon City",
    destination: "Suzuki Auto Service",
    destinationAddress: "Regalado Avenue, Fairview, Quezon City",
    distanceKm: 2.9,
    estimatedFee: "\u20B11,000",
    status: "DECLINED",
    requestedAt: "Today, 12:30 PM",
    priority: "LOW",
    latitude: 14.7369,
    longitude: 121.0555,
  },
  {
    id: "tow-006",
    customerName: "Michael Tan",
    customerPhone: "0933 118 6620",
    vehicleMake: "Nissan",
    vehicleModel: "Navara",
    vehicleYear: 2017,
    plateNumber: "WLD 4489",
    requestType: "Vehicle Breakdown",
    problemDescription: "Transmission issue, vehicle stuck in gear.",
    pickupLocation: "Novaliches",
    pickupAddress: "Quirino Highway, Novaliches, Quezon City",
    destination: "Nissan Service Center",
    destinationAddress: "Mindanao Avenue, Quezon City",
    distanceKm: 7.3,
    estimatedFee: "\u20B12,000",
    status: "CANCELLED",
    requestedAt: "Today, 11:05 AM",
    priority: "LOW",
    latitude: 14.7306,
    longitude: 121.0402,
  },
  {
    id: "tow-007",
    customerName: "Rachel Aquino",
    customerPhone: "0916 809 2277",
    vehicleMake: "Kia",
    vehicleModel: "Soluto",
    vehicleYear: 2021,
    plateNumber: "PLM 9931",
    requestType: "Emergency Towing",
    problemDescription: "Car stalled in the middle of an intersection during rain.",
    pickupLocation: "Timog Avenue",
    pickupAddress: "Timog Avenue, Quezon City",
    destination: "Kia Service Center",
    destinationAddress: "Quezon Avenue, Quezon City",
    distanceKm: 3.9,
    estimatedFee: "\u20B11,350",
    status: "PENDING",
    requestedAt: "Today, 5:48 PM",
    priority: "HIGH",
    latitude: 14.6377,
    longitude: 121.0367,
  },
];

type FilterKey = "ALL" | "PENDING" | "ACTIVE" | "COMPLETED";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
];

const STATUS_STYLES: Record<
  RequestStatus,
  { label: string; background: string; color: string }
> = {
  PENDING: { label: "Pending", background: "#FEF3C7", color: "#92400E" },
  ACCEPTED: { label: "Accepted", background: "#DBEAFE", color: "#1E40AF" },
  IN_PROGRESS: { label: "In Progress", background: "#E0E7FF", color: "#3730A3" },
  COMPLETED: { label: "Completed", background: "#D1FAE5", color: "#065F46" },
  DECLINED: { label: "Declined", background: "#F3F4F6", color: "#4B5563" },
  CANCELLED: { label: "Cancelled", background: "#FEE2E2", color: "#991B1B" },
};

const PRIORITY_STYLES: Record<
  RequestPriority,
  { background: string; color: string }
> = {
  HIGH: { background: "#FEE2E2", color: COLORS.primary },
  MEDIUM: { background: "#FEF3C7", color: "#92400E" },
  LOW: { background: "#E5E7EB", color: COLORS.textMuted },
};

function matchesFilter(status: RequestStatus, filter: FilterKey): boolean {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return status === "PENDING";
  if (filter === "ACTIVE") return status === "ACCEPTED" || status === "IN_PROGRESS";
  if (filter === "COMPLETED") return status === "COMPLETED";
  return true;
}

export default function TowingRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<TowingRequest[]>([]);

  useEffect(() => subscribeToTowingRequests((items: TowingBookingRequest[]) => setRequests(items.map((item) => {
    const vehicleParts = item.vehicle.split(" ");
    return { id: item.id, customerName: item.customerName, customerPhone: item.customerEmail,
      vehicleMake: vehicleParts[0] ?? item.vehicle, vehicleModel: vehicleParts.slice(1).join(" "),
      vehicleYear: item.vehicleYear, plateNumber: item.vehiclePlate, requestType: item.towingType,
      problemDescription: item.vehicleCondition, pickupLocation: item.pickupLocation,
      pickupAddress: item.pickupLocation, destination: item.destination, destinationAddress: item.destination,
      distanceKm: item.totalDistanceKm, estimatedFee: `₱${(item.estimatedTotalPrice ?? item.estimatedPrice ?? 0).toLocaleString("en-PH")}`,
      status: item.status === "pending" ? "PENDING" : item.status === "completed" ? "COMPLETED" : item.status === "rejected" ? "DECLINED" : item.status === "cancelled" ? "CANCELLED" : item.status === "in_progress" ? "IN_PROGRESS" : "ACCEPTED",
      requestedAt: new Date(item.createdAt).toLocaleString(), priority: "MEDIUM", latitude: item.latitude, longitude: item.longitude };
  }))), []);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      if (!matchesFilter(request.status, activeFilter)) return false;
      if (!query) return true;
      const haystack = `${request.customerName} ${request.vehicleMake} ${request.vehicleModel} ${request.plateNumber}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeFilter, requests, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Towing Requests</Text>
        <Text style={styles.headerSubtitle}>
          {filteredRequests.length} {filteredRequests.length === 1 ? "request" : "requests"}
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
        {filteredRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>No requests match your search.</Text>
          </View>
        )}

        {filteredRequests.map((request) => {
          const statusStyle = STATUS_STYLES[request.status];
          const priorityStyle = PRIORITY_STYLES[request.priority];

          return (
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
                  {request.vehicleMake} {request.vehicleModel} {request.vehicleYear}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: priorityStyle.background },
                  ]}
                >
                  <Text style={[styles.priorityBadgeText, { color: priorityStyle.color }]}>
                    {request.priority}
                  </Text>
                </View>
              </View>

              <View style={styles.requestDivider} />

              <View style={styles.requestDetailRow}>
                <Feather name="truck" size={14} color={COLORS.textMuted} />
                <Text style={styles.requestDetailText}>{request.requestType}</Text>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeColumn}>
                  <Feather name="map-pin" size={14} color={COLORS.textMuted} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {request.pickupLocation}
                  </Text>
                </View>
                <Feather name="arrow-right" size={14} color={COLORS.textMuted} />
                <View style={styles.routeColumn}>
                  <Feather name="flag" size={14} color={COLORS.textMuted} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {request.destination}
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.distance}>{request.distanceKm} km</Text>
                <Text style={styles.estimatedFee}>{request.estimatedFee}</Text>
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
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  requestDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  requestDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  requestDetailText: { fontSize: 13, color: COLORS.text },

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
  estimatedFee: { fontSize: 14, fontWeight: "700", color: COLORS.primary },

  viewRequestButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  viewRequestButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
