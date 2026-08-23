// app/(owner)/book-mechanic.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../constants/theme";
import { MOCK_PROVIDERS } from "../../data/mockProviders";
import { MOCK_VEHICLES } from "../../data/mockVehicles";

export default function BookMechanicScreen() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const provider = MOCK_PROVIDERS.find((p) => p.id === providerId) ?? MOCK_PROVIDERS[0];
  const primaryVehicle = MOCK_VEHICLES.find((v) => v.isPrimary) ?? MOCK_VEHICLES[0];

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Book Mechanic</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Provider summary */}
        <View style={styles.providerCard}>
          <View style={[styles.avatar, { backgroundColor: provider.color }]}>
            <Text style={styles.avatarText}>{provider.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={12} color={colors.rating} />
              <Text style={styles.metaText}>{provider.rating.toFixed(1)}</Text>
              <Text style={styles.metaDot}>{"\u2022"}</Text>
              <Text style={styles.metaText}>{provider.distanceKm} km away</Text>
            </View>
          </View>
        </View>

        {/* Vehicle */}
        <Text style={styles.sectionLabel}>Vehicle</Text>
        <View style={styles.vehicleRow}>
          <View style={[styles.vehicleThumb, { backgroundColor: primaryVehicle.thumbColor }]}>
            <Text style={styles.vehicleThumbText}>{primaryVehicle.initials}</Text>
          </View>
          <View>
            <Text style={styles.vehicleName}>
              {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
            </Text>
            <Text style={styles.vehiclePlate}>{primaryVehicle.plate}</Text>
          </View>
        </View>

        {/* Services */}
        <Text style={styles.sectionLabel}>Select Services</Text>
        <View style={styles.chipsWrap}>
          {provider.services.map((service) => {
            const isSelected = selectedServices.includes(service);
            return (
              <Pressable
                key={service}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleService(service)}
              >
                {isSelected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {service}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Additional Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Describe the issue..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </ScrollView>

      {/* Confirm bar */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Starting price</Text>
          <Text style={styles.priceValue}>Starts at {provider.startingPrice}</Text>
        </View>
        <Pressable
          style={styles.confirmButton}
          onPress={() => router.push("/")}
        >
          <Text style={styles.confirmButtonText}>Confirm Booking</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  content: { padding: 16, paddingBottom: 24 },

  providerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12, marginBottom: 20,
  },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  providerName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  metaDot: { fontSize: 12, color: colors.textMuted },

  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.textPrimary, marginBottom: 10, marginTop: 4 },

  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  vehicleThumb: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  vehicleThumbText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  vehicleName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  vehiclePlate: { fontSize: 11, color: colors.textMuted },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  chipTextSelected: { color: colors.white },

  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 13, color: colors.textPrimary,
    minHeight: 80, textAlignVertical: "top",
  },

  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingTop: 12,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  priceLabel: { fontSize: 12, color: colors.textMuted },
  priceValue: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  confirmButton: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 8,
  },
  confirmButtonText: { fontSize: 14, fontWeight: "800", color: colors.white },
});