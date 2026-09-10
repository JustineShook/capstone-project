// app/(owner)/mechanic-booking/book-mechanic.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBooking } from "../../../services/owner/bookingService";

import { colors } from "../../../constants/owner/theme";
import { MockProvider } from "../../../data/owner/mockProviders";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import type { SavedVehicle } from "../../../types/owner/vehicle";

// General problem categories the owner picks from — the mechanic diagnoses
// the exact repair/service on arrival, so this is intentionally coarse and
// independent of any specific provider's service list.
const PROBLEM_CATEGORIES = [
  "Engine Problem",
  "Electrical / Wiring Problem",
  "Battery / Starting Problem",
  "Brake Problem",
  "Tire / Wheel Problem",
  "Steering Problem",
  "Suspension Problem",
  "Transmission Problem",
  "Cooling / Overheating Problem",
  "Air Conditioning Problem",
  "Fuel System Problem",
  "Chain / Drive Problem",
  "Accident / Collision",
  "Vehicle Won't Start",
  "Other / Unknown Problem",
];

export default function BookMechanicScreen() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const [provider, setProvider] = useState<MockProvider | null>(null);
  const [providerError, setProviderError] = useState("");

  useEffect(() => {
    if (!providerId) { setProviderError("No provider was selected."); return; }
    getPublicProviderListing(providerId).then((listing) => {
      if (!listing || listing.role !== "onsite-mechanic") { setProviderError("This mechanic is no longer available."); return; }
      setProvider({ id: listing.providerId, name: listing.businessName, category: listing.category,
        rating: listing.ratingSummary.average, reviewCount: listing.ratingSummary.count, distanceKm: 0,
        startingPrice: listing.startingPrice == null ? "Price on assessment" : `₱${listing.startingPrice.toLocaleString()}`,
        isPositiveStatus: listing.availability === "available", initials: listing.businessName.slice(0, 2).toUpperCase(),
        color: colors.primary, lat: listing.location.latitude, lng: listing.location.longitude,
        description: listing.serviceAreaLabel, services: listing.services, hours: listing.operatingHours,
        emergencyServiceAvailable: listing.emergencyServiceAvailable, phone: "", vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"], reviews: [] });
    }).catch(() => setProviderError("Unable to load this provider."));
  }, [providerId]);

  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehicleError, setVehicleError] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);

  useEffect(() => {
    try {
      return subscribeToMyVehicles((items) => {
        setVehicles(items);
        setSelectedVehicleId((current) => current && items.some((item) => item.vehicleId === current)
          ? current : items[0]?.vehicleId ?? null);
        setVehiclesLoading(false);
      }, (error) => { setVehicleError(error.message); setVehiclesLoading(false); });
    } catch (error) {
      setVehicleError((error as Error).message);
      setVehiclesLoading(false);
    }
  }, []);

  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [isProblemModalVisible, setProblemModalVisible] = useState(false);

  const [notes, setNotes] = useState("");

  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleId === selectedVehicleId) ?? null;
  const isSelectedVehicleCompatible = selectedVehicle
    ? provider?.vehicleTypes.includes(selectedVehicle.type) ?? true
    : true;

  const canConfirm = !!selectedVehicle;

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setVehicleModalVisible(false);
  };

  const handleSelectProblem = (problem: string) => {
    setSelectedProblem(problem);
    setProblemModalVisible(false);
  };

  const handleConfirm = async () => {
  if (!canConfirm || !selectedVehicle || !provider) return;

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Location permission is required to send an onsite request.");
  const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

  const booking = await createBooking({
    providerId: provider.id,
    providerName: provider.name,
    vehicleId: selectedVehicle.vehicleId,
    vehicle: `${selectedVehicle.make} ${selectedVehicle.model}`,
    vehicleYear: selectedVehicle.year,
    vehiclePlate: selectedVehicle.plateNumber,
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
    problem: selectedProblem ?? "Other / Unknown Problem",
    notes,
    startingPrice: provider.startingPrice,
  });

  router.push({
    pathname: "/mechanic-booking/booking-confirmation",
    params: {
      bookingId: booking.id,
    },
  });

};

  if (!provider) {
    return <SafeAreaView style={styles.root}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={styles.validationText}>{providerError || "Loading provider…"}</Text></View></SafeAreaView>;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.replace("/(v_owner)")}
            hitSlop={10}
          >
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

        {/* Vehicle — single selected vehicle, tap to change */}
        <Text style={styles.sectionLabel}>Vehicle</Text>
        <Text style={styles.sectionSubtitle}>Which vehicle needs assistance?</Text>

        {selectedVehicle ? (
          <Pressable style={styles.selectedCard} onPress={() => setVehicleModalVisible(true)}>
            <View
              style={[styles.vehicleCardThumb, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.vehicleCardThumbText}>{`${selectedVehicle.make[0] ?? ""}${selectedVehicle.model[0] ?? ""}`.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedCardTitle}>
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </Text>
              <Text style={styles.selectedCardSubtitle}>{selectedVehicle.type} · {selectedVehicle.plateNumber}</Text>
              {!isSelectedVehicleCompatible && (
                <View style={styles.compatibilityRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={colors.rating} />
                  <Text style={styles.compatibilityText}>
                    This provider may not typically service this vehicle type
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.changeLabel}>Change</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => {
            if (vehiclesLoading) return;
            if (vehicles.length) setVehicleModalVisible(true);
            else router.push("/(v_owner)/vehicle");
          }}>
            <Ionicons name="car-outline" size={18} color={colors.primary} />
            <Text style={styles.emptyCardText}>{vehiclesLoading ? "Loading your vehicles..." : vehicleError || "Add a vehicle in My Vehicles"}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Problem — single selected problem, tap to change */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>What&apos;s the Problem?</Text>
        <Text style={styles.sectionSubtitle}>
          Pick the general issue — the mechanic will diagnose the exact repair
        </Text>

        {selectedProblem ? (
          <Pressable style={styles.selectedCard} onPress={() => setProblemModalVisible(true)}>
            <View style={styles.problemIconWrap}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedCardTitle}>{selectedProblem}</Text>
            </View>
            <Text style={styles.changeLabel}>Change</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => setProblemModalVisible(true)}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.emptyCardText}>Select the problem</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Notes */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Additional Notes (optional)</Text>
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
        {!canConfirm && <Text style={styles.validationText}>Please select a vehicle.</Text>}
        <Pressable
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
        >
          <Text style={[styles.confirmButtonText, !canConfirm && styles.confirmButtonTextDisabled]}>
            Confirm Booking
          </Text>
        </Pressable>
      </SafeAreaView>

      {/* Change Vehicle modal */}
      <Modal
        visible={isVehicleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setVehicleModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <Pressable onPress={() => setVehicleModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {vehiclesLoading ? <Text style={styles.validationText}>Loading your vehicles...</Text> : vehicles.length === 0 ? <Text style={styles.validationText}>{vehicleError || "No saved vehicles. Add one from My Vehicles first."}</Text> : vehicles.map((vehicle) => {
              const isSelected = vehicle.vehicleId === selectedVehicleId;
              return (
                <Pressable
                  key={vehicle.vehicleId}
                  style={[styles.modalOptionCard, isSelected && styles.modalOptionCardSelected]}
                  onPress={() => handleSelectVehicle(vehicle.vehicleId)}
                >
                  <View style={[styles.vehicleCardThumb, { backgroundColor: colors.primary }]}>
                    <Text style={styles.vehicleCardThumbText}>{`${vehicle.make[0] ?? ""}${vehicle.model[0] ?? ""}`.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedCardTitle}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={styles.selectedCardSubtitle}>{vehicle.type} · {vehicle.plateNumber}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Select Problem modal */}
      <Modal
        visible={isProblemModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProblemModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setProblemModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Select Problem</Text>
            <Pressable onPress={() => setProblemModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {PROBLEM_CATEGORIES.map((problem) => {
              const isSelected = problem === selectedProblem;
              return (
                <Pressable
                  key={problem}
                  style={[styles.modalOptionCard, isSelected && styles.modalOptionCardSelected]}
                  onPress={() => handleSelectProblem(problem)}
                >
                  <View style={styles.problemIconWrap}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.selectedCardTitle, { flex: 1 }]}>{problem}</Text>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  content: { padding: 16, paddingBottom: 24 },

  providerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12, marginBottom: 20,
  },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  providerName: { fontSize: 14.5, fontWeight: "500", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 12.5, color: colors.textSecondary },
  metaDot: { fontSize: 12, color: colors.textMuted },

  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 4, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  sectionSubtitle: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginBottom: 10 },

  // Generic "current selection" card — reused for both Vehicle and Problem
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.surfaceAlt,
  },
  selectedCardTitle: { fontSize: 14.5, fontWeight: "500", color: colors.textPrimary },
  selectedCardSubtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  changeLabel: { fontSize: 12.5, fontWeight: "600", color: colors.primary },

  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
  },
  emptyCardText: { flex: 1, fontSize: 14.5, fontWeight: "500", color: colors.primary },

  vehicleCardThumb: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  vehicleCardThumbText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  problemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  compatibilityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  compatibilityText: { fontSize: 12, lineHeight: 17, color: colors.rating, flexShrink: 1 },

  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 14, lineHeight: 20, color: colors.textPrimary,
    minHeight: 80, textAlignVertical: "top",
  },

  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingTop: 12,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  priceLabel: { fontSize: 12.5, color: colors.textSecondary },
  priceValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  validationText: { fontSize: 12.5, lineHeight: 18, color: colors.rating, marginBottom: 8, textAlign: "center" },
  confirmButton: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
  },
  confirmButtonText: { fontSize: 15, fontWeight: "700", color: colors.white },
  confirmButtonTextDisabled: { color: colors.textMuted },

  // Shared bottom-sheet modal (Vehicle + Problem)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingHorizontal: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  modalList: { gap: 10, paddingBottom: 20 },

  modalOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
  },
  modalOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
