// app/(v_owner)/history.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MOCK_HISTORY, MockHistory } from "@/constants/mockHistory";
import { CustomerShopHistory } from "../../components/owner/CustomerShopHistory";

// ---------------------------------------------------------------------------
// THEME (matches the rest of VeResc — move to a shared theme file when ready)
// ---------------------------------------------------------------------------
const colors = {
  primary: "#D32F2F",
  primaryDark: "#B71C1C",
  background: "#FFFFFF",
  surface: "#FAFAFA",
  surfaceAlt: "#F2F2F2",
  border: "#EEE0E0",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  textMuted: "#9E9E9E",
  success: "#2E7D32",
  successLight: "#E8F5E9",
  cancelled: "#B71C1C",
  cancelledLight: "#FDECEA",
  rating: "#B8860B",
  white: "#FFFFFF",
};

type FilterOption = "All" | "Towing" | "Onsite Mechanic" | "Auto Shop";

const FILTERS: FilterOption[] = ["All", "Towing", "Onsite Mechanic", "Auto Shop"];

function getServiceIcon(type: MockHistory["serviceType"]): keyof typeof Ionicons.glyphMap {
  return type === "Towing" ? "car-outline" : "construct-outline";
}

function getStatusColors(status: MockHistory["status"]) {
  return status === "Completed"
    ? { text: colors.success, bg: colors.successLight }
    : { text: colors.cancelled, bg: colors.cancelledLight };
}

function formatPrice(price: number, status: MockHistory["status"]) {
  if (status === "Cancelled" && price === 0) return "—";
  return `₱${price.toLocaleString()}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");

  const filteredHistory = useMemo(() => {
    if (activeFilter === "Auto Shop") return [];
    if (activeFilter === "All") return MOCK_HISTORY;
    return MOCK_HISTORY.filter((record) => record.serviceType === activeFilter);
  }, [activeFilter]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Your vehicle assistance requests</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <Pressable
              key={filter}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={activeFilter === "All" || activeFilter === "Auto Shop" ? <CustomerShopHistory /> : null}
        ListEmptyComponent={
          activeFilter === "Auto Shop" ? null :
          <View style={styles.emptyWrap}>
            <Ionicons name="time-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>No {activeFilter.toLowerCase()} history yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusColors = getStatusColors(item.status);
          return (
            <View style={styles.card}>
              {/* Top row: service type + status */}
              <View style={styles.cardTopRow}>
                <View style={styles.serviceTypeRow}>
                  <View style={styles.serviceIconWrap}>
                    <Ionicons name={getServiceIcon(item.serviceType)} size={15} color={colors.primary} />
                  </View>
                  <Text style={styles.serviceTypeText}>{item.serviceType}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.statusPillText, { color: statusColors.text }]}>{item.status}</Text>
                </View>
              </View>

              {/* Service name */}
              <Text style={styles.serviceName}>{item.serviceName}</Text>

              {/* Vehicle */}
              <View style={styles.metaRow}>
                <Ionicons name="car-sport-outline" size={13} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {item.vehicleName} · {item.plateNumber}
                </Text>
              </View>

              {/* Date */}
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={styles.metaText}>{item.date}</Text>
              </View>

              <View style={styles.divider} />

              {/* Provider + price */}
              <View style={styles.cardBottomRow}>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {item.providerName}
                  </Text>
                  <View style={styles.providerRatingRow}>
                    <Ionicons name="star" size={12} color={colors.rating} />
                    <Text style={styles.providerRatingText}>{item.providerRating.toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.priceText}>{formatPrice(item.price, item.status)}</Text>
              </View>

              {/* View details */}
              <Pressable
                style={styles.detailsButton}
                onPress={() =>
                  router.push({
                    pathname: "/(v_owner)/history",
                    params: { id: item.id },
                  })
                }
              >
                <Text style={styles.detailsButtonText}>View Service Details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// Typography values below are matched to app/(v_owner)/profile.tsx's scale:
//   Page title      -> 24 / 700
//   Section label   -> 13 / 600 / uppercase / letterSpacing 0.4
//   Row label       -> 14.5 / 500 (primary text)
//   Row value       -> 12.5 / 400 (secondary text)
//   Profile name    -> 18 / 700 (headline emphasis)
//   Small badge     -> 12 / 600 (roleBadgeText)
//   Button text     -> 15 / 700 (logoutText)
// No custom fontFamily is set in profile.tsx, so none is introduced here —
// both screens inherit the same system default font.
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textSecondary,
    marginTop: 2,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: colors.primary,
  },
  filterChipTextActive: { color: colors.white },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  serviceTypeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  serviceIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTypeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: colors.primary,
  },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  serviceName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: {
    fontSize: 12.5,
    fontWeight: "400",
    color: colors.textSecondary,
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  providerInfo: { flex: 1, marginRight: 8 },
  providerName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  providerRatingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  providerRatingText: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: colors.primary,
  },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyText: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
