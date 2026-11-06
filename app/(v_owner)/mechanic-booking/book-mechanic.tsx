// app/(owner)/mechanic-booking/book-mechanic.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBooking, getActiveMechanicBooking } from "../../../services/owner/bookingService";
import { getBookingLocation } from "../../../utils/owner/getBookingLocation";
import { BookingTimingActions, timingActionStyles } from "../../../components/owner/BookingTimingActions";
import type { BookingTimingInput } from "../../../types/bookingTiming";
import { formatBookingTimingLabel, isBookingTimingReady } from "../../../utils/bookingTiming";

import { homeColors as colors } from "../../../constants/owner/homeTheme";
import { MockProvider } from "../../../data/owner/mockProviders";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { getProviderContactPhone } from "../../../services/providerContactService";
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
  const { providerId, initialTimingMode } = useLocalSearchParams<{ providerId: string; initialTimingMode?: "now" | "scheduled" }>();
  const [provider, setProvider] = useState<MockProvider | null>(null);
  const [providerError, setProviderError] = useState("");
  const [checkingExistingBooking, setCheckingExistingBooking] = useState(true);

  useEffect(() => {
    if (!providerId) { setProviderError("No provider was selected."); setCheckingExistingBooking(false); return; }
    let active = true;
    let redirecting = false;
    setCheckingExistingBooking(true);
    void getActiveMechanicBooking(providerId).then((booking) => {
      if (active && booking) {
        redirecting = true;
        router.replace({ pathname: "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: booking.id } });
      }
    }).catch(() => {
      // Submission performs the same check before creating a new booking.
    }).finally(() => { if (active && !redirecting) setCheckingExistingBooking(false); });

    getPublicProviderListing(providerId).then(async (listing) => {
      if (!active) return;
      if (!listing || listing.role !== "onsite-mechanic") { setProviderError("This mechanic is no longer available."); return; }
      let phone = listing.contactPhone ?? "";
      try { phone = await getProviderContactPhone(providerId) || phone; } catch { /* Legacy listing fallback remains available during migration. */ }
      if (!active) return;
      setProvider({ id: listing.providerId, name: listing.businessName, category: listing.category,
        rating: listing.ratingSummary.average, reviewCount: listing.ratingSummary.count, distanceKm: 0,
        startingPrice: listing.startingPrice == null ? "Price on assessment" : `₱${listing.startingPrice.toLocaleString()}`,
        isPositiveStatus: listing.availability === "available", initials: listing.businessName.slice(0, 2).toUpperCase(),
        color: colors.primary, lat: listing.location.latitude, lng: listing.location.longitude,
        description: listing.serviceAreaLabel, services: listing.services, hours: listing.operatingHours,
        emergencyServiceAvailable: listing.emergencyServiceAvailable, acceptsScheduledBookings: listing.acceptsScheduledBookings === true,
        phone, vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"], reviews: [] });
    }).catch(() => { if (active) setProviderError("Unable to load this provider."); });
    return () => { active = false; };
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
          ? current : null);
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
  const [timing, setTiming] = useState<BookingTimingInput | null>(() => initialTimingMode === "scheduled"
    ? { timingMode: "scheduled", urgency: "standard" }
    : initialTimingMode === "now" ? { timingMode: "now", urgency: "standard" } : null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleId === selectedVehicleId) ?? null;
  const isSelectedVehicleCompatible = selectedVehicle
    ? provider?.vehicleTypes.includes(selectedVehicle.type) ?? true
    : true;

  const timingAllowed = timing?.timingMode === "scheduled"
    ? provider?.acceptsScheduledBookings === true
    : timing?.urgency === "emergency"
      ? provider?.emergencyServiceAvailable === true && provider.isPositiveStatus
      : false;
  const emergencyAvailable = provider?.emergencyServiceAvailable === true && provider.isPositiveStatus;
  const providerUnavailable = !emergencyAvailable && provider?.acceptsScheduledBookings !== true;
  const emergencyUnavailableMessage = provider?.emergencyServiceAvailable === true && !provider.isPositiveStatus
    ? "Emergency unavailable: this mechanic is not available right now."
    : undefined;
  const standardNowMessage = providerUnavailable ? undefined
    : "Now from discovery remains a standard Now selection. Choose a supported option explicitly to continue; it will not be changed to Emergency for you.";
  const requiredFieldsValid = !!selectedVehicle;
  const canConfirm = requiredFieldsValid && timingAllowed && isBookingTimingReady(timing);

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setVehicleModalVisible(false);
  };

  const handleSelectProblem = (problem: string) => {
    setSelectedProblem(problem);
    setProblemModalVisible(false);
  };

  const handleConfirm = async () => {
  if (!canConfirm || !selectedVehicle || !provider || submitting) return;
  setSubmitting(true);
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Location permission is required to send an onsite request.");
    }
    const currentLocation = await getBookingLocation();
    const booking = await createBooking({
      providerId: provider.id,
      providerName: provider.name,
      providerPhone: provider.phone,
      vehicleId: selectedVehicle.vehicleId,
      vehicle: `${selectedVehicle.make} ${selectedVehicle.model}`,
      vehicleYear: selectedVehicle.year,
      vehiclePlate: selectedVehicle.plateNumber,
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      problem: selectedProblem ?? "Other / Unknown Problem",
      notes,
      startingPrice: provider.startingPrice,
      timing: timing ?? undefined,
    });
    setReviewVisible(false);
    router.replace({
      pathname: "/(v_owner)/mechanic-booking/booking-detail",
      params: { bookingId: booking.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Please check your connection and try again.";
    Alert.alert("Booking could not be sent", message);
  } finally {
    setSubmitting(false);
  }
};

  if (checkingExistingBooking) {
    return <SafeAreaView style={styles.root}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={styles.validationText}>Checking your existing request...</Text></View></SafeAreaView>;
  }

  if (!provider) {
    return <SafeAreaView style={styles.root}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={[styles.validationText, providerError && styles.fieldError]}>{providerError || "Loading provider…"}</Text></View></SafeAreaView>;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={"light-content"} backgroundColor={"#0F52BA"} />
      <SafeAreaView style={[styles.header, { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 0, paddingVertical: 0 }]} edges={["top"]}>
        <View style={[styles.headerRow, { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, height: undefined }]}>
          <Pressable
            onPress={() => router.replace({ pathname: "/(v_owner)", params: providerId ? { selectedProviderId: providerId } : {} })}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={"#FFFFFF"} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>Book Mechanic</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0F52BA" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
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
            <Text style={styles.emptyCardText}>{vehiclesLoading ? "Loading your vehicles..." : vehicleError || (vehicles.length ? "Please select a vehicle" : "Add a vehicle in My Vehicles")}</Text>
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
      {(() => { const message = !selectedVehicle ? "Please select a vehicle." : timing?.timingMode === "scheduled" && !isBookingTimingReady(timing) ? "Choose a valid future hour." : undefined; return message ? <Text accessibilityRole="alert" style={styles.formValidation}>{message}</Text> : null; })()}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={[styles.footer, timingActionStyles.safeFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Starting price</Text>
          <Text style={[styles.priceValue, provider.startingPrice === "Price on assessment" && { fontSize: 13, lineHeight: 18, fontWeight: "600" }]}>
            {provider.startingPrice === "Price on assessment"
              ? "Contact the provider for a price estimate."
              : `Starts at ${provider.startingPrice}`}
          </Text>
        </View>
        <BookingTimingActions formAppearance value={timing} emergencyAvailable={emergencyAvailable}
          acceptsScheduled={provider.acceptsScheduledBookings === true} requiredFieldsValid={requiredFieldsValid}
          reviewDisabled={submitting || !timingAllowed} hideUnsupportedSchedule standardNowMessage={standardNowMessage}
          emergencyUnavailableMessage={emergencyUnavailableMessage}
          unavailableMessage={providerUnavailable ? "This mechanic is unavailable for new bookings because no available Emergency service or Schedule is enabled." : undefined}
          onChange={setTiming}
          onEmergency={() => { const next = { timingMode: "now" as const, urgency: "emergency" as const }; setTiming(next); if (requiredFieldsValid) setReviewVisible(true); }}
          onReview={() => setReviewVisible(true)}
          validationOutside />
      </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal visible={reviewVisible} transparent animationType="fade" onRequestClose={() => !submitting && setReviewVisible(false)}>
        <KeyboardAvoidingView style={styles.reviewOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}><SafeAreaView style={styles.reviewSheet} edges={["bottom"]}>
          <Text style={styles.reviewTitle}>Review Booking</Text>
          <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent}>
            <View style={styles.reviewGroup}>
              <Text style={styles.reviewGroupTitle}>Provider & vehicle</Text>
              <Text style={styles.reviewText}>Provider · {provider.name}</Text>
              <Text style={styles.reviewText}>Vehicle · {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.plateNumber}` : "Select a vehicle"}</Text>
            </View>
            <View style={styles.reviewGroup}>
              <Text style={styles.reviewGroupTitle}>Service details</Text>
              <Text style={styles.reviewText}>Problem · {selectedProblem ?? "Other / Unknown Problem"}</Text>
              {notes.trim() ? <Text style={styles.reviewText}>Notes · {notes}</Text> : null}
            </View>
            <View style={styles.reviewGroup}>
              <Text style={styles.reviewGroupTitle}>Schedule & notices</Text>
              <Text style={styles.reviewText}>Timing · {timing?.timingMode === "scheduled" && !isBookingTimingReady(timing) ? "Choose a valid hour" : timing ? formatBookingTimingLabel(timing) : "Choose a timing option"}</Text>
              {timing?.urgency === "emergency" ? <Text style={styles.reviewMuted}>Acceptance and response time are not guaranteed.</Text> : null}
              {timing?.timingMode === "scheduled" ? <Text style={styles.reviewMuted}>Subject to provider confirmation. This reserves a start window, not service duration.</Text> : null}
            </View>
          </ScrollView>
          <Pressable disabled={!canConfirm || submitting} style={[styles.confirmButton, (!canConfirm || submitting) && styles.confirmButtonDisabled]} onPress={() => void handleConfirm()}><Text style={styles.confirmButtonText}>{submitting ? "Sending..." : "Confirm Booking"}</Text></Pressable>
          <Pressable disabled={submitting} onPress={() => setReviewVisible(false)} style={styles.reviewCancel}><Text style={styles.validationText}>Back to edit</Text></Pressable>
        </SafeAreaView></KeyboardAvoidingView>
      </Modal>

      {/* Change Vehicle modal */}
      <Modal
        visible={isVehicleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVehicleModalVisible(false)} accessibilityLabel="Close vehicle selection" />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <Pressable onPress={() => setVehicleModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {vehiclesLoading ? <Text style={styles.validationText}>Loading your vehicles...</Text> : vehicles.length === 0 ? <Text style={[styles.validationText, vehicleError && styles.fieldError]}>{vehicleError || "No saved vehicles. Add one from My Vehicles first."}</Text> : vehicles.map((vehicle) => {
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Select Problem modal */}
      <Modal
        visible={isProblemModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProblemModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setProblemModalVisible(false)} accessibilityLabel="Close problem selection" />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Select Problem</Text>
            <Pressable onPress={() => setProblemModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  formValidation: { color: colors.busy, fontSize: 13, lineHeight: 19, marginTop: 12 },
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  content: { padding: 16, paddingBottom: 24 },

  providerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: 20, padding: 16, marginBottom: 16,
  },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  providerName: { fontSize: 18, fontWeight: "700", color: colors.textPrimary , lineHeight: 25 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 13, color: colors.textSecondary , lineHeight: 19, fontWeight: "400" },
  metaDot: { fontSize: 13, color: colors.textMuted , lineHeight: 19 },

  sectionLabel: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, marginBottom: 8, marginTop: 20, textTransform: "none", letterSpacing: 0, lineHeight: 19},
  sectionSubtitle: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginBottom: 12, fontWeight: "400"},

  // Generic "current selection" card — reused for both Vehicle and Problem
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
    minHeight: 54 },
  selectedCardTitle: { fontSize: 15, fontWeight: "400", color: colors.textPrimary , lineHeight: 22 , flexShrink: 1 },
  selectedCardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 , lineHeight: 19, fontWeight: "400" },
  changeLabel: { fontSize: 15, fontWeight: "700", color: colors.primary , lineHeight: 20 },

  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "solid",
    borderRadius: 12,
    padding: 16,
    minHeight: 54 , backgroundColor: colors.surface },
  emptyCardText: { flex: 1, fontSize: 15, fontWeight: "400", color: colors.textSecondary , lineHeight: 22 },

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
  compatibilityText: { fontSize: 13, lineHeight: 19, color: colors.rating, flexShrink: 1 , fontWeight: "400" },

  notesInput: { maxHeight: 160,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 16, fontSize: 15, lineHeight: 22, color: colors.textPrimary,
    minHeight: 80, textAlignVertical: "top", fontWeight: "400", backgroundColor: colors.surface },

  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 0, paddingTop: 12,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 0 , gap: 8 , flexWrap: "wrap" , marginHorizontal: 16 },
  priceLabel: { fontSize: 13, color: colors.textSecondary , lineHeight: 19, fontWeight: "500" },
  priceValue: { fontSize: 18, fontWeight: "700", color: colors.textPrimary , lineHeight: 25 },
  fieldError: { color: colors.busy },
  validationText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginBottom: 8, textAlign: "center", fontWeight: "400", marginTop: 8 },
  confirmButton: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: "center", marginBottom: 0,
   minHeight: 54 },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
  },
  confirmButtonText: { fontSize: 15, fontWeight: "700", color: colors.white , lineHeight: 20 },
  confirmButtonTextDisabled: { color: colors.textMuted },
  reviewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  reviewSheet: { width: "100%", maxWidth: 520, maxHeight: "90%", flexShrink: 1, backgroundColor: colors.background, borderRadius: 20, padding: 16, gap: 12 },
  reviewScroll: { flexShrink: 1 },
  reviewContent: { gap: 12, paddingBottom: 2 },
  reviewGroup: { gap: 8, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16 },
  reviewGroupTitle: { color: colors.primary, fontSize: 16, fontWeight: "700", textTransform: "none", letterSpacing: 0, marginBottom: 1, lineHeight: 22},
  reviewTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", lineHeight: 25},
  reviewText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 , fontWeight: "400" },
  reviewMuted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 , fontWeight: "400" },
  reviewCancel: { minHeight: 54, alignItems: "center", justifyContent: "center" , paddingVertical: 10 , backgroundColor: colors.surface , borderRadius: 10 , borderColor: colors.border , borderWidth: 1 },

  // Centered selection dialog (Vehicle + Problem)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: colors.background,
    width: "100%",
    maxWidth: 480,
    maxHeight: "86%",
    flexShrink: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 10,
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
  modalScroll: { flexShrink: 1 },

  modalOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 12,
    backgroundColor: colors.background,
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
