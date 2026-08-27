// app/(owner)/vehicle.tsx
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VehicleDetailCard } from "../../components/owner/VehicleDetailCard";
import { colors } from "../../constants/owner/theme";
import { MOCK_VEHICLES } from "../../data/owner/mockVehicles";

export default function VehicleScreen() {
  const primaryVehicle = MOCK_VEHICLES.find((v) => v.isPrimary) ?? MOCK_VEHICLES[0];
  const [selectedVehicleId, setSelectedVehicleId] = useState(primaryVehicle.id);

  const selectedVehicle =
    MOCK_VEHICLES.find((v) => v.id === selectedVehicleId) ?? primaryVehicle;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Vehicles</Text>
          <Pressable style={styles.addButton}>
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Vehicle switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.switcherRow}
        style={styles.switcherWrap}
      >
        {MOCK_VEHICLES.map((vehicle) => {
          const isSelected = vehicle.id === selectedVehicleId;
          return (
            <Pressable
              key={vehicle.id}
              style={[styles.switcherCard, isSelected && styles.switcherCardSelected]}
              onPress={() => setSelectedVehicleId(vehicle.id)}
            >
              <View style={[styles.switcherThumb, { backgroundColor: vehicle.thumbColor }]}>
                <Text style={styles.switcherThumbText}>{vehicle.initials}</Text>
              </View>
              <View style={styles.switcherBody}>
                <Text style={styles.switcherName} numberOfLines={1}>
                  {vehicle.make} {vehicle.model}
                </Text>
                <Text style={styles.switcherPlate} numberOfLines={1}>{vehicle.plate}</Text>
              </View>
              {vehicle.isPrimary && (
                <View style={styles.switcherPrimaryDot} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Detail view for selected vehicle */}
      <VehicleDetailCard vehicle={selectedVehicle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  header: { backgroundColor: colors.white },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  addButton: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },

  switcherWrap: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  switcherRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  switcherCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    minWidth: 150,
  },
  switcherCardSelected: { borderColor: colors.primary, backgroundColor: colors.white },
  switcherThumb: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  switcherThumbText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  switcherBody: { flex: 1 },
  switcherName: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  switcherPlate: { fontSize: 10, color: colors.textMuted },
  switcherPrimaryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
});