import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
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
  View, Image, Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "../../services/firebase";
import { updatePublicProviderListing } from "../../services/publicProviderListingService";
import { uploadVerificationFile } from "../../services/providerProfileService";
import type { PublicProviderListingInput } from "../../types/providerListing";

type ProviderRole = "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage";
type Availability = PublicProviderListingInput["availability"];
type HoursType = "24_7" | "same_daily" | "weekly";
type DayHours = { day: string; open: boolean; openingTime: string | null; closingTime: string | null };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_OPTIONS = ["12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"];
const defaultWeek = (): DayHours[] => DAYS.map((day) => ({ day, open: true, openingTime: "8:00 AM", closingTime: "6:00 PM" }));
const summary = (type: HoursType, days: DayHours[]) => type === "24_7" ? "Open 24/7" : type === "same_daily" ? "Daily, " + days[0].openingTime + "–" + days[0].closingTime : days.map((day) => day.day.slice(0, 3) + " " + (day.open ? day.openingTime + "–" + day.closingTime : "Closed")).join(" · ");

interface Props {
  role: ProviderRole;
  initialListing?: Partial<PublicProviderListingInput>;
  defaultBusinessName: string;
}

const COLORS = {
  primary: "#F51F3B",
  background: "#0B1115",
  surface: "#151E25",
  border: "#354249",
  text: "#F7F9FA",
  muted: "#A1ABB2",
};

const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];
const OPERATING_HOURS = ["24/7", "Mon-Sat, 8:00 AM-6:00 PM", "Mon-Fri, 8:00 AM-5:00 PM", "Daily, 8:00 AM-8:00 PM"];

const MECHANIC_SERVICES = [
  "Engine Diagnostics", "Battery Replacement", "Brake Repair",
  "Tire Replacement", "Electrical Repair", "Air Conditioning",
];
const TOWING_SERVICES = [
  "Flatbed Towing", "Wheel-Lift Towing", "Emergency Roadside Assistance",
  "Accident Recovery", "Motorcycle Towing",
];
const SHOP_SERVICES = [
  "Oil change", "Brake service", "Engine repair", "Battery service",
  "Tire service", "Air-conditioning service", "Preventive maintenance",
];
const PARKING_SERVICES = ["Hourly Parking", "Overnight Parking", "Covered Parking", "24/7 Parking", "EV Charging", "Valet Parking"];
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

function HoursSelector({ type, days, onTypeChange, onDaysChange }: { type: HoursType; days: DayHours[]; onTypeChange: (type: HoursType) => void; onDaysChange: (days: DayHours[]) => void }) {
  const [picker, setPicker] = useState<{ index: number; field: "openingTime" | "closingTime" } | null>(null);
  const update = (index: number, next: Partial<DayHours>) => onDaysChange(days.map((day, i) => i === index ? { ...day, ...next } : day));
  const setSame = (field: "openingTime" | "closingTime", value: string) => onDaysChange(days.map((day) => ({ ...day, open: true, [field]: value })));
  return <><View style={styles.options}>{([["24_7", "24/7"], ["same_daily", "Same every day"], ["weekly", "Weekly"]] as [HoursType, string][]).map(([value, label]) => <TouchableOpacity key={value} style={[styles.option, type === value && styles.optionActive]} onPress={() => onTypeChange(value)}><Text style={[styles.optionText, type === value && styles.optionTextActive]}>{label}</Text></TouchableOpacity>)}</View>{type === "same_daily" && <View style={styles.timePair}><TimeButton label="OPENING" value={days[0].openingTime ?? ""} onPress={() => setPicker({ index: 0, field: "openingTime" })} /><TimeButton label="CLOSING" value={days[0].closingTime ?? ""} onPress={() => setPicker({ index: 0, field: "closingTime" })} /></View>}{type === "weekly" && <View style={styles.week}>{days.map((day, index) => <View key={day.day} style={styles.dayRow}><Text style={styles.dayName}>{day.day}</Text><TouchableOpacity style={[styles.dayToggle, day.open && styles.optionActive]} onPress={() => update(index, { open: !day.open })}><Text style={[styles.optionText, day.open && styles.optionTextActive]}>{day.open ? "Open" : "Closed"}</Text></TouchableOpacity>{day.open && <><TimeButton label="" value={day.openingTime ?? ""} onPress={() => setPicker({ index, field: "openingTime" })} /><TimeButton label="" value={day.closingTime ?? ""} onPress={() => setPicker({ index, field: "closingTime" })} /></>}</View>)}</View>}<Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}><View style={styles.modalShade}><View style={styles.timeModal}><Text style={styles.modalTitle}>Select time</Text><ScrollView>{TIME_OPTIONS.map((time) => <TouchableOpacity key={time} style={styles.timeOption} onPress={() => { if (!picker) return; if (type === "same_daily") setSame(picker.field, time); else update(picker.index, { [picker.field]: time }); setPicker(null); }}><Text style={styles.timeOptionText}>{time}</Text></TouchableOpacity>)}</ScrollView></View></View></Modal></>;
}
function TimeButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <TouchableOpacity style={styles.timeButton} onPress={onPress}>{label ? <Text style={styles.timeCaption}>{label}</Text> : null}<Text style={styles.timeValue}>{value}</Text></TouchableOpacity>; }

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
  const [description, setDescription] = useState(initialListing?.description ?? "");
  const [contactPhone, setContactPhone] = useState(initialListing?.contactPhone ?? "");
  const [services, setServices] = useState<string[]>(initialListing?.services ?? []);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(initialListing?.vehicleTypes ?? []);
  const [operatingHours, setOperatingHours] = useState(initialListing?.operatingHours ?? "");
  const [hoursType, setHoursType] = useState<HoursType>(initialListing?.hoursType ?? "weekly");
  const [weeklyHours, setWeeklyHours] = useState<DayHours[]>(initialListing?.weeklyHours ?? defaultWeek());
  const [startingPrice, setStartingPrice] = useState(
    initialListing?.startingPrice == null ? "" : String(initialListing.startingPrice)
  );
  const [emergencyServiceAvailable, setEmergencyServiceAvailable] = useState<boolean | null>(
    initialListing?.emergencyServiceAvailable ?? null
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialListing?.photoUrls ?? []);
  const [totalSlots, setTotalSlots] = useState(initialListing?.totalSlots == null ? "" : String(initialListing.totalSlots));
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const usesStructuredHours = role === "shop-owner" || role === "homegarage";
  const showsListingPhotos = role === "shop-owner" || role === "homegarage";
  const serviceOptions = role === "towing-company" ? TOWING_SERVICES : role === "shop-owner" ? SHOP_SERVICES : role === "homegarage" ? PARKING_SERVICES : MECHANIC_SERVICES;
  const vehicleTypeOptions = role === "onsite-mechanic" ? MECHANIC_VEHICLE_TYPES : TOWING_VEHICLE_TYPES;

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const addPhotos = async () => {
    const remaining = 3 - photoUrls.length;
    if (remaining <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission required", "Allow photo-library access to add shop photos.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: remaining, quality: .8 });
    if (result.canceled) return;
    const uid = auth.currentUser?.uid; if (!uid) return;
    setUploadingPhotos(true);
    try {
      const urls = await Promise.all(result.assets.slice(0, remaining).map((asset) => uploadVerificationFile(uid, "profile-photo", { uri: asset.uri, mimeType: asset.mimeType, name: asset.fileName, size: asset.fileSize })));
      setPhotoUrls((current) => [...current, ...urls].slice(0, 3));
    } catch (error) { Alert.alert("Photo upload failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setUploadingPhotos(false); }
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
    const publicContactPhone = contactPhone.trim();
    if (publicContactPhone.length < 7 || publicContactPhone.length > 30) {
      Alert.alert("Public contact number required", "Enter a valid phone number customers can use to call or message you.");
      return;
    }
    if (!isValidLocation(location)) {
      Alert.alert("Location required", role === "shop-owner" ? "Set your shop coordinates in Profile before publishing." : "Use your current GPS location before saving.");
      return;
    }
    const publicArea = role === "homegarage" ? "On-site parking" : serviceAreaLabel.trim();
    const publicHours = usesStructuredHours ? summary(hoursType, weeklyHours) : operatingHours.trim();
    if (publicArea.length < 2) {
      Alert.alert("Service area required", "Enter the general area customers should see.");
      return;
    }
    if (role !== "homegarage" && !services.length) {
      Alert.alert("Services required", "Select at least one public service.");
      return;
    }
    if (!vehicleTypes.length) {
      Alert.alert("Vehicle types required", "Select at least one supported vehicle type.");
      return;
    }
    const publicDescription = description.trim();
    if (role === "homegarage" && publicDescription.length < 2) {
      Alert.alert("Description required", "Add a short description of your parking lot.");
      return;
    }
    if (publicDescription.length > 600) {
      Alert.alert("Description too long", "Use 600 characters or fewer.");
      return;
    }
    if (publicHours.length < 2 || publicHours.length > 200) {
      Alert.alert("Invalid operating hours", "Use between 2 and 200 characters for the hours customers should see.");
      return;
    }
    const priceText = startingPrice.trim();
    const publicStartingPrice = priceText === "" ? null : Number(priceText);
    if (publicStartingPrice !== null && (!Number.isFinite(publicStartingPrice) || publicStartingPrice < 0 || publicStartingPrice > 1_000_000)) {
      Alert.alert("Invalid starting price", "Enter a price from 0 to 1,000,000, or leave it blank.");
      return;
    }
    const parsedSlots = Number(totalSlots);
    if (role === "homegarage" && (!Number.isInteger(parsedSlots) || parsedSlots < 1 || parsedSlots > 500)) {
      Alert.alert("Parking capacity required", "Enter a whole number from 1 to 500.");
      return;
    }
    if (role !== "homegarage" && emergencyServiceAvailable === null) {
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
          description: publicDescription,
          contactPhone: publicContactPhone,
          services: role === "homegarage" ? ["Parking"] : services,
          vehicleTypes,
          operatingHours: publicHours,
          startingPrice: publicStartingPrice,
          emergencyServiceAvailable: role === "homegarage" ? false : emergencyServiceAvailable!,
          photoUrls,
          hoursType,
          is24Hours: hoursType === "24_7",
          weeklyHours,
          ...(role === "homegarage" ? { totalSlots: parsedSlots, availableSlots: initialListing?.availableSlots == null ? parsedSlots : Math.min(initialListing.availableSlots, parsedSlots) } : {}),
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
          editable={role !== "shop-owner" && role !== "homegarage"}
          onChangeText={setBusinessName}
          maxLength={120}
          placeholder="Name shown to customers"
          style={styles.input}
        />

        <Text style={styles.label}>PUBLIC CONTACT NUMBER</Text>
        <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={30} placeholder="Number customers can call or message" style={styles.input} />

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

        {role !== "homegarage" && <><Text style={styles.label}>{role === "towing-company" ? "TOWING SERVICES" : role === "shop-owner" ? "SHOP SERVICES" : "MECHANIC SERVICES"}</Text>
        <View style={styles.chips}>
          {serviceOptions.map((option) => {
            const selected = services.includes(option);
            return (
              <TouchableOpacity key={option} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggle(option, services, setServices)}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View></>}

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

        {role !== "homegarage" && <><Text style={styles.label}>PUBLIC SERVICE AREA</Text>
        <TextInput
          value={serviceAreaLabel}
          onChangeText={setServiceAreaLabel}
          maxLength={120}
          placeholder="e.g. Cebu City and nearby areas"
          style={styles.input}
        /></>}

        {role === "homegarage" && <><Text style={styles.label}>PARKING CAPACITY</Text><TextInput value={totalSlots} onChangeText={setTotalSlots} keyboardType="number-pad" placeholder="Total parking slots" style={styles.input} /><Text style={styles.label}>PARKING LOT DESCRIPTION</Text><TextInput value={description} onChangeText={setDescription} maxLength={600} multiline placeholder="Describe your parking lot, entrance, safety, or important instructions" style={[styles.input, styles.descriptionInput]} /></>}

        <Text style={styles.label}>OPERATING / AVAILABLE HOURS</Text>
        {usesStructuredHours ? <HoursSelector type={hoursType} days={weeklyHours} onTypeChange={setHoursType} onDaysChange={setWeeklyHours} /> : role === "onsite-mechanic" ? <View style={styles.chips}>
          {OPERATING_HOURS.map((option) => <TouchableOpacity key={option} style={[styles.chip, operatingHours === option && styles.chipActive]} onPress={() => setOperatingHours(option)}><Text style={[styles.chipText, operatingHours === option && styles.chipTextActive]}>{option}</Text></TouchableOpacity>)}
        </View> : <TextInput value={operatingHours} onChangeText={setOperatingHours} maxLength={200} placeholder="e.g. Mon-Sat, 8:00 AM-6:00 PM" style={styles.input}/>} 

        <Text style={styles.label}>STARTING PRICE / RATE</Text>
        <TextInput
          value={startingPrice}
          onChangeText={setStartingPrice}
          keyboardType="decimal-pad"
          maxLength={10}
          placeholder="Leave blank for Contact for price"
          style={styles.input}
        />

        {showsListingPhotos && <><Text style={styles.label}>{role === "homegarage" ? "PARKING LOT PHOTOS (OPTIONAL)" : "SHOP PHOTOS (OPTIONAL)"}</Text><Text style={styles.photoHint}>Add up to 3 photos of the parking entrance, spaces, or exterior.</Text><View style={styles.photoGrid}>{photoUrls.map((url, index) => <View key={url} style={styles.photoWrap}><Image source={{ uri: url }} style={styles.photo} /><TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Feather name="x" size={15} color="#fff" /></TouchableOpacity></View>)}{photoUrls.length < 3 && <TouchableOpacity style={styles.addPhoto} disabled={uploadingPhotos} onPress={() => void addPhotos()}>{uploadingPhotos ? <ActivityIndicator color={COLORS.primary} /> : <><Feather name="image" size={21} color={COLORS.primary} /><Text style={styles.addPhotoText}>Add photo</Text></>}</TouchableOpacity>}</View></>}

        {role !== "shop-owner" && role !== "homegarage" && <>
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
        {role !== "shop-owner" && role !== "onsite-mechanic" && <TouchableOpacity
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
  header: { backgroundColor: COLORS.background, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "700" },
  content: { padding: 18, paddingBottom: 36 },
  intro: { color: COLORS.muted, fontSize: 16, lineHeight: 23, marginBottom: 24 },
  label: { color: COLORS.muted, fontSize: 15, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10, marginTop: 22 },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 15, color: COLORS.text, fontSize: 18 },
  descriptionInput: { minHeight: 108, textAlignVertical: "top" },
  options: { flexDirection: "row", gap: 8 },
  timePair: { flexDirection: "row", gap: 8, marginTop: 10 },
  week: { gap: 8, marginTop: 10 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", backgroundColor: COLORS.surface, borderRadius: 8, padding: 8 },
  dayName: { color: COLORS.text, fontSize: 13, fontWeight: "700", width: 76 },
  dayToggle: { minWidth: 62, alignItems: "center", paddingVertical: 8, paddingHorizontal: 7, borderRadius: 7, borderWidth: 1, borderColor: COLORS.border },
  timeButton: { flex: 1, minWidth: 86, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 9, backgroundColor: COLORS.surface },
  timeCaption: { color: COLORS.muted, fontSize: 10, fontWeight: "700" },
  timeValue: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginTop: 2 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  timeModal: { maxHeight: "70%", backgroundColor: COLORS.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  timeOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  timeOptionText: { color: COLORS.text, fontSize: 17 },
  option: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  optionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  optionText: { color: COLORS.muted, fontSize: 15, fontWeight: "600" },
  optionTextActive: { color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  chipText: { color: COLORS.muted, fontSize: 15, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  locationCard: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14 },
  locationBody: { flex: 1 },
  locationTitle: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  coordinates: { color: COLORS.muted, fontSize: 14, marginTop: 4 },
  locationHint: { color: COLORS.muted, fontSize: 14, marginTop: 4 },
  locationButton: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 12 },
  locationButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: "700" },
  saveButton: { marginTop: 30, backgroundColor: COLORS.primary, borderRadius: 10, minHeight: 56, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  photoHint: { color: COLORS.muted, fontSize: 14, marginTop: -5 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  photoWrap: { width: 102, height: 88, borderRadius: 8, overflow: "hidden", position: "relative" },
  photo: { width: "100%", height: "100%" },
  removePhoto: { position: "absolute", top: 5, right: 5, width: 25, height: 25, borderRadius: 13, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 102, height: 88, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center", gap: 5 },
  addPhotoText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
