import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "../../services/firebase";
import { updatePublicProviderListing } from "../../services/publicProviderListingService";
import type { PublicProviderListingInput } from "../../types/providerListing";

type ProviderRole = "onsite-mechanic" | "towing-company" | "shop-owner";
type Availability = PublicProviderListingInput["availability"];

interface Props {
  role: ProviderRole;
  initialListing?: Partial<PublicProviderListingInput>;
  defaultBusinessName: string;
}

const COLORS = {
  primary: "#D32F2F",
  background: "#FFFFFF",
  surface: "#F7F7F8",
  border: "#E5E7EB",
  text: "#1A1A1A",
  muted: "#6B7280",
};

const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

const MECHANIC_SERVICES = [
  "Engine Diagnostics", "Battery Replacement", "Brake Repair",
  "Tire Replacement", "Electrical Repair", "Air Conditioning",
];
const TOWING_SERVICES = [
  "Flatbed Towing", "Wheel-Lift Towing", "Emergency Roadside Assistance",
  "Accident Recovery", "Motorcycle Towing",
];
const MECHANIC_VEHICLE_TYPES = ["Cars", "SUVs", "Pickup Trucks", "Vans", "Motorcycles"];
const TOWING_VEHICLE_TYPES = ["Motorcycle", "Car", "SUV", "Pickup Truck", "Van", "Truck"];

function isValidLocation(location: PublicProviderListingInput["location"] | null) {
  return Boolean(
    location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      !(location.latitude === 0 && location.longitude === 0)
  );
}

export function PublicListingForm({ role, initialListing, defaultBusinessName }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState(
    initialListing?.businessName || defaultBusinessName
  );
  const [availability, setAvailability] = useState<Availability>(
    initialListing?.availability ?? "offline"
  );
  const [location, setLocation] = useState(initialListing?.location ?? null);
  const [serviceAreaLabel, setServiceAreaLabel] = useState(initialListing?.serviceAreaLabel ?? "");
  const [services, setServices] = useState<string[]>(initialListing?.services ?? []);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(initialListing?.vehicleTypes ?? []);
  const [operatingHours, setOperatingHours] = useState(initialListing?.operatingHours ?? "");
  const [startingPrice, setStartingPrice] = useState(
    initialListing?.startingPrice == null ? "" : String(initialListing.startingPrice)
  );
  const [emergencyServiceAvailable, setEmergencyServiceAvailable] = useState<boolean | null>(
    initialListing?.emergencyServiceAvailable ?? null
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const serviceOptions = role === "towing-company" ? TOWING_SERVICES : MECHANIC_SERVICES;
  const vehicleTypeOptions = role === "onsite-mechanic" ? MECHANIC_VEHICLE_TYPES : TOWING_VEHICLE_TYPES;

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Location permission required",
          "Allow location access to publish your current service location."
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      if (!isValidLocation(nextLocation)) {
        Alert.alert("Invalid location", "Your device did not return a valid location. Try again.");
        return;
      }
      setLocation(nextLocation);
    } catch (error) {
      console.error("Failed to obtain public provider location", error);
      Alert.alert("Location unavailable", "We couldn't get your current location. Try again.");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const trimmedName = businessName.trim();
    if (!trimmedName) {
      Alert.alert("Business name required", "Enter the name customers should see.");
      return;
    }
    if (trimmedName.length > 120) {
      Alert.alert("Business name too long", "Use 120 characters or fewer.");
      return;
    }
    if (!isValidLocation(location)) {
      Alert.alert("Location required", role === "shop-owner" ? "Set your shop coordinates in Profile before publishing." : "Use your current GPS location before saving.");
      return;
    }
    const publicArea = serviceAreaLabel.trim();
    const publicHours = operatingHours.trim();
    if (publicArea.length < 2) {
      Alert.alert("Service area required", "Enter the general area customers should see.");
      return;
    }
    if (!services.length) {
      Alert.alert("Services required", "Select at least one public service.");
      return;
    }
    if (!vehicleTypes.length) {
      Alert.alert("Vehicle types required", "Select at least one supported vehicle type.");
      return;
    }
    if (publicHours.length < 2) {
      Alert.alert("Operating hours required", "Enter the hours customers should see.");
      return;
    }
    const priceText = startingPrice.trim();
    const publicStartingPrice = priceText === "" ? null : Number(priceText);
    if (publicStartingPrice !== null && (!Number.isFinite(publicStartingPrice) || publicStartingPrice < 0 || publicStartingPrice > 1_000_000)) {
      Alert.alert("Invalid starting price", "Enter a price from 0 to 1,000,000, or leave it blank.");
      return;
    }
    if (emergencyServiceAvailable === null) {
      Alert.alert("Emergency availability required", "Select whether emergency service is available.");
      return;
    }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        Alert.alert("Sign in required", "Sign in before updating your public listing.");
        return;
      }
      await updatePublicProviderListing(uid, role, {
          businessName: trimmedName,
          location: location!,
          availability,
          serviceAreaLabel: publicArea,
          services,
          vehicleTypes,
          operatingHours: publicHours,
          startingPrice: publicStartingPrice,
          emergencyServiceAvailable,
        });
      Alert.alert("Public listing saved", "Your customer map listing is being updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to save public provider listing", error);
      Alert.alert("Save failed", "We couldn't update your public listing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Public Provider Listing</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          These are the only details shared with customers on the provider map. Your private
          verification address is never copied or geocoded.
        </Text>

        <Text style={styles.label}>PUBLIC BUSINESS NAME</Text>
        <TextInput
          value={businessName}
          editable={role !== "shop-owner"}
          onChangeText={setBusinessName}
          maxLength={120}
          placeholder="Name shown to customers"
          style={styles.input}
        />

        {role === "shop-owner" ? <Text style={styles.intro}>Your shop name and location come from Profile. Open/Closed availability is managed from Home. Customers bring their vehicles for emergency repairs.</Text> : <>
        <Text style={styles.label}>AVAILABILITY</Text>
        <View style={styles.options}>
          {AVAILABILITY.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, availability === option.value && styles.optionActive]}
              onPress={() => setAvailability(option.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  availability === option.value && styles.optionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        </>}

        <Text style={styles.label}>{role === "towing-company" ? "TOWING SERVICES" : role === "shop-owner" ? "SHOP SERVICES" : "MECHANIC SERVICES"}</Text>
        <View style={styles.chips}>
          {serviceOptions.map((option) => {
            const selected = services.includes(option);
            return (
              <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggle(option, services, setServices)}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>SUPPORTED VEHICLE TYPES</Text>
        <View style={styles.chips}>
          {vehicleTypeOptions.map((option) => {
            const selected = vehicleTypes.includes(option);
            return (
              <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggle(option, vehicleTypes, setVehicleTypes)}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>PUBLIC SERVICE AREA</Text>
        <TextInput
          value={serviceAreaLabel}
          onChangeText={setServiceAreaLabel}
          maxLength={120}
          placeholder="e.g. Cebu City and nearby areas"
          style={styles.input}
        />

        <Text style={styles.label}>OPERATING / AVAILABLE HOURS</Text>
        <TextInput
          value={operatingHours}
          onChangeText={setOperatingHours}
          maxLength={120}
          placeholder="e.g. Mon-Sat, 8:00 AM-6:00 PM"
          style={styles.input}
        />

        <Text style={styles.label}>STARTING PRICE / RATE</Text>
        <TextInput
          value={startingPrice}
          onChangeText={setStartingPrice}
          keyboardType="decimal-pad"
          maxLength={10}
          placeholder="Leave blank for Contact for price"
          style={styles.input}
        />

        {role !== "shop-owner" && <>
        <Text style={styles.label}>EMERGENCY SERVICE AVAILABLE</Text>
        <View style={styles.options}>
          {[true, false].map((option) => (
            <TouchableOpacity
              key={String(option)}
              style={[styles.option, emergencyServiceAvailable === option && styles.optionActive]}
              onPress={() => setEmergencyServiceAvailable(option)}
            >
              <Text style={[styles.optionText, emergencyServiceAvailable === option && styles.optionTextActive]}>
                {option ? "Yes" : "No"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        </>}

        <Text style={styles.label}>PUBLIC SERVICE LOCATION</Text>
        <View style={styles.locationCard}>
          <Feather name="map-pin" size={20} color={COLORS.primary} />
          <View style={styles.locationBody}>
            <Text style={styles.locationTitle}>
              {isValidLocation(location) ? "GPS location selected" : "No GPS location selected"}
            </Text>
            {isValidLocation(location) && location ? (
              <Text style={styles.coordinates}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            ) : (
              <Text style={styles.locationHint}>Capture the location you want shown publicly.</Text>
            )}
          </View>
        </View>
        {role !== "shop-owner" && <TouchableOpacity
          style={styles.locationButton}
          onPress={() => void handleUseCurrentLocation()}
          disabled={locating || saving}
        >
          {locating ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Feather name="crosshair" size={17} color={COLORS.primary} />
          )}
          <Text style={styles.locationButtonText}>Use My Current Location</Text>
        </TouchableOpacity>}

        <TouchableOpacity
          style={[styles.saveButton, (saving || locating) && styles.disabled]}
          onPress={() => void save()}
          disabled={saving || locating}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save Public Listing</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 36 },
  intro: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginBottom: 24 },
  label: { color: COLORS.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 9, marginTop: 18 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 14 },
  options: { flexDirection: "row", gap: 8 },
  option: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  optionActive: { borderColor: COLORS.primary, backgroundColor: "#FCE8E8" },
  optionText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  optionTextActive: { color: COLORS.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  locationCard: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14 },
  locationBody: { flex: 1 },
  locationTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  coordinates: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  locationHint: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  locationButton: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 12 },
  locationButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  saveButton: { marginTop: 30, backgroundColor: COLORS.primary, borderRadius: 10, minHeight: 48, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
