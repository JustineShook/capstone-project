// components/VehicleDetailCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../constants/theme";
import {
  ExpiryStatus,
  getExpiryLabel,
  getExpiryStatus,
  getFuelIcon,
  MockVehicle,
} from "../data/mockVehicles";

function expiryColors(status: ExpiryStatus) {
  if (status === "valid") return { bg: colors.successLight, fg: colors.success };
  if (status === "expiring") return { bg: "#FFF3E0", fg: "#EF6C00" };
  return { bg: colors.busyLight, fg: colors.busy };
}

function ExpiryRow({ label, date, isoDate }: { label: string; date: string; isoDate: string }) {
  const status = getExpiryStatus(isoDate);
  const c = expiryColors(status);
  return (
    <View style={styles.expiryRow}>
      <View>
        <Text style={styles.expiryLabel}>{label}</Text>
        <Text style={styles.expiryDate}>{date}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.fg }]}>{getExpiryLabel(status)}</Text>
      </View>
    </View>
  );
}

export function VehicleDetailCard({ vehicle }: { vehicle: MockVehicle }) {
  const nextMaintenance = vehicle.upcomingMaintenance[0];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: vehicle.thumbColor }]}>
          <Text style={styles.avatarText}>{vehicle.initials}</Text>
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.isPrimary && (
              <View style={styles.primaryTag}>
                <Text style={styles.primaryTagText}>PRIMARY</Text>
              </View>
            )}
          </View>
          <Text style={styles.plate}>{vehicle.plate}</Text>
        </View>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
          <Text style={styles.statValue}>{vehicle.mileage.toLocaleString()} km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Ionicons name={getFuelIcon(vehicle.fuelType)} size={16} color={colors.primary} />
          <Text style={styles.statValue}>{vehicle.fuelType}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Ionicons name="build-outline" size={16} color={colors.primary} />
          <Text style={styles.statValue}>{vehicle.lastServiceDate}</Text>
        </View>
      </View>

      {/* Insurance & Registration */}
      <ExpiryRow
        label="Insurance"
        date={vehicle.insurance.expiryDate}
        isoDate={vehicle.insurance.expiryDateIso}
      />
      <ExpiryRow
        label="Registration"
        date={vehicle.registrationExpiry}
        isoDate={vehicle.registrationExpiryIso}
      />

      {/* Next maintenance */}
      {nextMaintenance && (
        <View style={styles.maintenanceRow}>
          <View style={styles.maintenanceIconWrap}>
            <Ionicons name={nextMaintenance.icon} size={15} color={colors.primary} />
          </View>
          <View style={styles.maintenanceBody}>
            <Text style={styles.maintenanceLabel}>Next Maintenance</Text>
            <Text style={styles.maintenanceTask}>{nextMaintenance.task}</Text>
          </View>
          <Text style={styles.maintenanceDue}>
            {nextMaintenance.dueDate ?? `${nextMaintenance.dueMileage?.toLocaleString()} km`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 4 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  headerInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, flexShrink: 1 },
  primaryTag: { backgroundColor: colors.successLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  primaryTagText: { fontSize: 9, fontWeight: "800", color: colors.success, letterSpacing: 0.3 },
  plate: { fontSize: 13, color: colors.textSecondary },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expiryLabel: { fontSize: 12, color: colors.textMuted },
  expiryDate: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginTop: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: "800" },

  maintenanceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  maintenanceIconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  maintenanceBody: { flex: 1 },
  maintenanceLabel: { fontSize: 11, color: colors.textMuted },
  maintenanceTask: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginTop: 1 },
  maintenanceDue: { fontSize: 12, fontWeight: "700", color: colors.primary },
});