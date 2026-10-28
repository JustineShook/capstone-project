import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View, Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import MapHtmlSurface from "../maps/MapHtmlSurface";

import { auth } from "../../services/firebase";
import { updatePublicProviderListing } from "../../services/publicProviderListingService";
import { uploadVerificationFile } from "../../services/providerProfileService";
import type { PublicProviderListingInput } from "../../types/providerListing";
import { buildDestinationMapHtml } from "../../utils/owner/buildDestinationMapHtml";

type ProviderRole = "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage";
type Availability = PublicProviderListingInput["availability"];
type HoursType = "24_7" | "same_daily" | "weekly";
type DayHours = { day: string; open: boolean; openingTime: string | null; closingTime: string | null };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_OPTIONS = ["12:00 AM", "1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"];
const defaultWeek = (): DayHours[] => DAYS.map((day) => ({ day, open: true, openingTime: "8:00 AM", closingTime: "6:00 PM" }));
function legacyHours(value: string | undefined): { type: HoursType; days: DayHours[] } {
  const days = defaultWeek();
  const text = value?.toLowerCase() ?? "";
  if (/24\s*\/\s*7|24\s*hours/.test(text)) return { type: "24_7", days };
  const times = value?.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*[-\u2013]\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
  const openingTime = times?.[1]?.toUpperCase() ?? "8:00 AM";
  const closingTime = times?.[2]?.toUpperCase() ?? "6:00 PM";
  if (/daily|every day/.test(text)) {
    return { type: "same_daily", days: days.map((day) => ({ ...day, openingTime, closingTime })) };
  }
  const openThrough = /mon(?:day)?\s*[-\u2013]\s*sat(?:urday)?|monday.*saturday/.test(text) ? 5
    : /mon(?:day)?\s*[-\u2013]\s*fri(?:day)?|weekday/.test(text) ? 4 : 6;
  return { type: "weekly", days: days.map((day, index) => ({ ...day, open: index <= openThrough, openingTime, closingTime })) };
}
const summary = (type: HoursType, days: DayHours[]) => type === "24_7" ? "Open 24/7" : type === "same_daily" ? `Daily, ${days[0].openingTime}\u2013${days[0].closingTime}` : days.map((day) => `${day.day.slice(0, 3)} ${day.open ? `${day.openingTime}\u2013${day.closingTime}` : "Closed"}`).join(" \u00b7 ");

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
const HOME_GARAGE_SERVICES = [
  "Oil change", "Brake service", "Engine repair", "Battery service",
  "Tire service", "Air-conditioning service",
];
const MECHANIC_VEHICLE_TYPES = ["Cars", "SUVs", "Pickup Trucks", "Vans", "Motorcycles"];
const TOWING_VEHICLE_TYPES = ["Motorcycle", "Car", "SUV", "Pickup Truck", "Van", "Truck"];
const SHOP_VEHICLE_TYPES = ["Cars", "SUVs", "Pickup Trucks", "Vans", "Motorcycles", "Truck"];
const DEFAULT_MAP_CENTER = { latitude: 10.3157, longitude: 123.8854 };
const DEFAULT_MAP_CENTER_LEAFLET = { lat: DEFAULT_MAP_CENTER.latitude, lng: DEFAULT_MAP_CENTER.longitude };

type AreaSuggestion = {
  id: string;
  label: string;
  location: PublicProviderListingInput["location"];
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
};

function photonLabel(properties: PhotonFeature["properties"]) {
  if (!properties) return "Selected location";
  const parts = [properties.name, properties.housenumber, properties.street, properties.district,
    properties.city, properties.county, properties.state, properties.country];
  return [...new Set(parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0))].join(", ");
}

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
  const mapRef = useRef<{ injectJavaScript: (script: string) => void } | null>(null);
  const mapReady = useRef(false);
  const pendingMapMarker = useRef<PublicProviderListingInput["location"] | null>(null);
  const areaSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaSearchController = useRef<AbortController | null>(null);
  const [businessName, setBusinessName] = useState(
    role === "shop-owner" || role === "homegarage"
      ? (initialListing?.businessName || defaultBusinessName).toUpperCase()
      : initialListing?.businessName || defaultBusinessName
  );
  const [availability, setAvailability] = useState<Availability>(initialListing?.availability ?? "offline");
  const [acceptsScheduledBookings, setAcceptsScheduledBookings] = useState(initialListing?.acceptsScheduledBookings === true);
  const [location, setLocation] = useState(initialListing?.location ?? null);
  const [serviceAreaLabel, setServiceAreaLabel] = useState(initialListing?.serviceAreaLabel ?? "");
  const [areaSuggestions, setAreaSuggestions] = useState<AreaSuggestion[]>([]);
  const [searchingArea, setSearchingArea] = useState(false);
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [areaSearchMessage, setAreaSearchMessage] = useState("");
  const [garageMapHtml] = useState(() => buildDestinationMapHtml(
    DEFAULT_MAP_CENTER_LEAFLET,
    COLORS.primary,
    initialListing?.location ? { lat: initialListing.location.latitude, lng: initialListing.location.longitude } : null,
  ));
  const [description, setDescription] = useState(initialListing?.description ?? "");
  const [contactPhone, setContactPhone] = useState(initialListing?.contactPhone ?? "");
  const [services, setServices] = useState<string[]>(role === "homegarage"
    ? (initialListing?.services ?? []).filter((service) => HOME_GARAGE_SERVICES.includes(service))
    : initialListing?.services ?? []);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(initialListing?.vehicleTypes ?? []);
  const [operatingHours, setOperatingHours] = useState(initialListing?.operatingHours ?? "");
  const legacySchedule = legacyHours(initialListing?.operatingHours);
  const [hoursType, setHoursType] = useState<HoursType>(initialListing?.hoursType ?? legacySchedule.type);
  const [weeklyHours, setWeeklyHours] = useState<DayHours[]>(initialListing?.weeklyHours ?? legacySchedule.days);
  const [startingPrice, setStartingPrice] = useState(
    initialListing?.startingPrice == null ? "" : String(initialListing.startingPrice)
  );
  const [emergencyServiceAvailable, setEmergencyServiceAvailable] = useState<boolean | null>(
    initialListing?.emergencyServiceAvailable ?? null
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialListing?.photoUrls ?? []);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const usesStructuredHours = role === "onsite-mechanic" || role === "shop-owner" || role === "homegarage";
  const showsListingPhotos = true;
  const serviceOptions = role === "towing-company" ? TOWING_SERVICES : role === "shop-owner" ? SHOP_SERVICES : role === "homegarage" ? HOME_GARAGE_SERVICES : MECHANIC_SERVICES;
  const vehicleTypeOptions = role === "onsite-mechanic" ? MECHANIC_VEHICLE_TYPES : role === "shop-owner" ? SHOP_VEHICLE_TYPES : TOWING_VEHICLE_TYPES;

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const addPhotos = async () => {
    const remaining = 3 - photoUrls.length;
    if (remaining <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission required", "Allow photo-library access to add listing photos.");
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
      moveGarageMarker(nextLocation.latitude, nextLocation.longitude);
    } catch (error) {
      console.error("Failed to obtain public provider location", error);
      Alert.alert("Location unavailable", "We couldn't get your current location. Try again.");
    } finally {
      setLocating(false);
    }
  };

  const moveGarageMarker = (latitude: number, longitude: number, zoom = 16) => {
    if (mapReady.current) {
      mapRef.current?.injectJavaScript(`window.setMarker(${latitude}, ${longitude}, ${zoom}); true;`);
    } else {
      pendingMapMarker.current = { latitude, longitude };
    }
  };

  const fetchAreaSuggestions = async (query: string) => {
    areaSearchController.current?.abort();
    const controller = new AbortController();
    areaSearchController.current = controller;
    const bias = location
      ? `&lat=${location.latitude}&lon=${location.longitude}`
      : `&lat=${DEFAULT_MAP_CENTER.latitude}&lon=${DEFAULT_MAP_CENTER.longitude}`;
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5&lang=en${bias}`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
    );
    if (!response.ok) throw new Error(`Location search failed (${response.status}).`);
    const data = (await response.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).flatMap((feature, index) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return [];
      return [{
        id: `${feature.properties?.osm_type ?? "place"}-${feature.properties?.osm_id ?? index}`,
        label: photonLabel(feature.properties),
        location: { latitude: coordinates[1], longitude: coordinates[0] },
      }];
    });
  };

  const searchGarageArea = (query: string) => {
    if (areaSearchTimeout.current) clearTimeout(areaSearchTimeout.current);
    areaSearchController.current?.abort();
    setAreaSearchMessage("");
    if (query.trim().length < 3) {
      setAreaSuggestions([]);
      setSearchingArea(false);
      return;
    }
    areaSearchTimeout.current = setTimeout(async () => {
      try {
        setSearchingArea(true);
        const results = await fetchAreaSuggestions(query);
        setAreaSuggestions(results);
        setAreaSearchMessage(results.length ? "" : "No matching locations found.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAreaSuggestions([]);
          setAreaSearchMessage("Location search is unavailable. Try again or tap the map.");
        }
      } finally {
        setSearchingArea(false);
      }
    }, 650);
  };

  const handleGarageAreaChange = (text: string) => {
    setServiceAreaLabel(text);
    if (role === "homegarage") setLocation(null);
    setShowAreaSuggestions(true);
    searchGarageArea(text);
  };

  const selectGarageArea = (suggestion: AreaSuggestion) => {
    // Search providers may return a full street address that exceeds the
    // public listing rule's 120 character limit. Keep the visible value valid.
    setServiceAreaLabel(suggestion.label.slice(0, 120));
    // Auto Shop coordinates are bound to the verified shop profile. Use the
    // selected place to populate its public service-area label without moving
    // the approved business pin.
    if (role === "homegarage") setLocation(suggestion.location);
    setAreaSuggestions([]);
    setShowAreaSuggestions(false);
    setAreaSearchMessage("");
    moveGarageMarker(suggestion.location.latitude, suggestion.location.longitude);
    Keyboard.dismiss();
  };

  const selectMapPoint = (coordinates: PublicProviderListingInput["location"]) => {
    setLocation(coordinates);
    setAreaSuggestions([]);
    setShowAreaSuggestions(false);
    setAreaSearchMessage("");
    Keyboard.dismiss();
    void Location.reverseGeocodeAsync(coordinates).then(([address]) => {
      const area = [address?.district, address?.city, address?.region]
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .filter((part, index, parts) => parts.indexOf(part) === index)
        .join(", ");
      if (area) setServiceAreaLabel(area);
    }).catch(() => {
      // Keep the manually entered service area if reverse geocoding fails.
    });
  };

  const handleGarageMapMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "select" && typeof data.lat === "number" && typeof data.lng === "number") {
        selectMapPoint({ latitude: data.lat, longitude: data.lng });
      }
    } catch {
      // Ignore malformed map messages.
    }
  };

  const handleGarageMapLoadEnd = () => {
    mapReady.current = true;
    if (pendingMapMarker.current) {
      const { latitude, longitude } = pendingMapMarker.current;
      mapRef.current?.injectJavaScript(`window.setMarker(${latitude}, ${longitude}, 16); true;`);
      pendingMapMarker.current = null;
    }
  };

  useEffect(() => () => {
    if (areaSearchTimeout.current) clearTimeout(areaSearchTimeout.current);
    areaSearchController.current?.abort();
  }, []);

  const save = async () => {
    const trimmedName = role === "shop-owner" || role === "homegarage" ? businessName.trim().toUpperCase() : businessName.trim();
    if (!trimmedName) {
      Alert.alert("Business name required", "Enter the name customers should see.");
      return;
    }
    if (trimmedName.length > 120) {
      Alert.alert("Business name too long", "Use 120 characters or fewer.");
      return;
    }
    const publicContactPhone = contactPhone.trim();
    if ((publicContactPhone.length > 0 && publicContactPhone.length < 7) || publicContactPhone.length > 30) {
      Alert.alert("Invalid public contact number", "Enter at least 7 characters for a number customers can use, or leave it blank.");
      return;
    }
    if (!isValidLocation(location)) {
      Alert.alert("Location required", role === "shop-owner" ? "Set your shop coordinates in Profile before publishing." : "Use your current GPS location before saving.");
      return;
    }
    const publicArea = serviceAreaLabel.trim();
    const publicHours = usesStructuredHours ? summary(hoursType, weeklyHours) : operatingHours.trim();
    if (publicArea.length < 2 || publicArea.length > 120) {
      Alert.alert("Invalid service area", "Use a general area between 2 and 120 characters.");
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
    const publicDescription = description.trim();
    if (role === "homegarage" && publicDescription.length < 2) {
      Alert.alert("Description required", "Describe your Home Garage, experience, or repair specialties.");
      return;
    }
    if (role === "shop-owner" && publicDescription.length < 2) {
      Alert.alert("Description required", "Add a short description of your Auto Shop for customers.");
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
    if ((role === "towing-company" || role === "homegarage") && emergencyServiceAvailable === null) {
      Alert.alert("Emergency availability required", "Select whether you accept emergency service requests.");
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
          availability: role === "homegarage" ? initialListing?.availability ?? "offline" : availability,
          serviceAreaLabel: publicArea,
          description: publicDescription,
          ...(publicContactPhone ? { contactPhone: publicContactPhone } : {}),
          services,
          vehicleTypes,
          operatingHours: publicHours,
          startingPrice: publicStartingPrice,
          emergencyServiceAvailable: role === "onsite-mechanic"
            ? emergencyServiceAvailable === true
            : role === "towing-company" || role === "homegarage" ? emergencyServiceAvailable! : role === "shop-owner",
          acceptsScheduledBookings,
          photoUrls,
          hoursType,
          is24Hours: hoursType === "24_7",
          weeklyHours,
          ...(role === "homegarage" && initialListing?.totalSlots != null ? {
            totalSlots: initialListing.totalSlots,
            availableSlots: initialListing.availableSlots ?? initialListing.totalSlots,
          } : {}),
        });
      setShowSavedModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
      Alert.alert("Save failed", code ? `${message}\n\nCode: ${code}` : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace(role === "homegarage" ? "/(homegarage)/profile" : role === "shop-owner" ? "/(shop-owner)/profile" : role === "towing-company" ? "/(towing-company)/profile" : "/(onsite-mechanic)/profile")} style={styles.back}>
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
          editable
          onChangeText={(value) => setBusinessName(role === "shop-owner" || role === "homegarage" ? value.toUpperCase() : value)}
          maxLength={120}
          placeholder="Name shown to customers"
          style={styles.input}
        />

        <Text style={styles.label}>PUBLIC CONTACT NUMBER</Text>
        <TextInput value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={30} placeholder="Number customers can call or message" style={styles.input} />

        {role === "shop-owner" ? <Text style={styles.intro}>Your verified shop pin comes from Profile. Search for your public service area below. Open/Closed availability is managed from Home.</Text> : role === "homegarage" ? <Text style={styles.intro}>Open or close your listing from the Home Garage dashboard.</Text> : <>
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

        <Text style={styles.label}>{role === "towing-company" ? "TOWING SERVICES" : role === "shop-owner" ? "SHOP SERVICES" : role === "homegarage" ? "HOME GARAGE REPAIR SERVICES" : "MECHANIC SERVICES"}</Text>
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

        <Text style={styles.label}>{role === "homegarage" ? "GARAGE SERVICE AREA" : "PUBLIC SERVICE AREA"}</Text>
        {role === "homegarage" || role === "shop-owner" ? <>
          <View style={styles.areaSearchRow}>
            <Feather name="search" size={18} color={COLORS.muted} />
            <TextInput
              value={serviceAreaLabel}
              onChangeText={handleGarageAreaChange}
              returnKeyType="search"
              maxLength={120}
              placeholder="Search barangay, city, or province"
              placeholderTextColor={COLORS.muted}
              style={styles.areaSearchInput}
              accessibilityLabel={role === "homegarage" ? "Search Home Garage service area" : "Search Auto Shop service area"}
            />
            <TouchableOpacity style={styles.areaSearchButton} onPress={() => searchGarageArea(serviceAreaLabel)} disabled={searchingArea} accessibilityRole="button" accessibilityLabel="Search service area">
              {searchingArea ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Feather name="arrow-right" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          {!searchingArea && showAreaSuggestions && areaSearchMessage ? <Text style={styles.searchMessage}>{areaSearchMessage}</Text> : null}
          {areaSuggestions.length > 0 && showAreaSuggestions && <View style={styles.suggestionList}>
            {areaSuggestions.map((suggestion) => <TouchableOpacity key={suggestion.id} style={styles.suggestion} onPress={() => selectGarageArea(suggestion)} accessibilityRole="button">
              <View style={styles.suggestionIcon}><Feather name="map-pin" size={16} color={COLORS.primary} /></View>
              <View style={styles.suggestionCopy}><Text style={styles.suggestionTitle}>{suggestion.label}</Text><Text style={styles.suggestionSubtitle}>Select this area, then adjust by tapping the map</Text></View>
              <Feather name="chevron-right" size={18} color={COLORS.muted} />
            </TouchableOpacity>)}
          </View>}
          <View style={styles.mapFrame}>
            <MapHtmlSurface
              ref={mapRef}
              sourceHtml={garageMapHtml}
              style={styles.map}
              startInLoadingState
              nestedScrollEnabled
              overScrollMode="never"
              accessibilityLabel="Home Garage service area map"
              onMessage={handleGarageMapMessage}
              onLoadEnd={handleGarageMapLoadEnd}
            />
          </View>
          <Text style={styles.mapHint}>{role === "homegarage"
            ? "Choose a search result or tap the map to set your public garage location."
          : "Choose a search result or tap the map to set your public shop location."}</Text>
        </> : <TextInput
          value={serviceAreaLabel}
          onChangeText={setServiceAreaLabel}
          maxLength={120}
          placeholder="e.g. Cebu City and nearby areas"
          style={styles.input}
        />}

        {(role === "shop-owner" || role === "homegarage") && <><Text style={styles.label}>{role === "homegarage" ? "ABOUT YOUR HOME GARAGE" : "ABOUT YOUR AUTO SHOP"}</Text><TextInput value={description} onChangeText={setDescription} maxLength={600} multiline placeholder={role === "homegarage" ? "Describe your garage, repair experience, specialties, and what customers can expect" : "Describe your shop, experience, specialties, or what customers can expect"} style={[styles.input, styles.descriptionInput]} /></>}

        <Text style={styles.label}>SCHEDULED BOOKINGS</Text>
        <Text style={styles.photoHint}>Choose whether customers may request future one-hour start windows. You can confirm or decline each request.</Text>
        <View style={styles.options}>{[[true, "Accept scheduled requests"], [false, role === "onsite-mechanic" ? "Emergency only" : "Now requests only"]].map(([enabled, label]) => {
          const schedulingEnabled = enabled as boolean;
          const selected = acceptsScheduledBookings === schedulingEnabled
            && (role !== "onsite-mechanic" || schedulingEnabled || emergencyServiceAvailable === true);
          return <TouchableOpacity key={String(enabled)} style={[styles.option, selected && styles.optionActive]} onPress={() => {
            setAcceptsScheduledBookings(schedulingEnabled);
            if (role === "onsite-mechanic" && !schedulingEnabled) setEmergencyServiceAvailable(true);
          }}><Text style={[styles.optionText, selected && styles.optionTextActive]}>{label}</Text></TouchableOpacity>;
        })}</View>

        <Text style={styles.label}>OPERATING / AVAILABLE HOURS</Text>
        {usesStructuredHours ? <HoursSelector type={hoursType} days={weeklyHours} onTypeChange={setHoursType} onDaysChange={setWeeklyHours} /> : <TextInput value={operatingHours} onChangeText={setOperatingHours} maxLength={200} placeholder="e.g. Mon-Sat, 8:00 AM-6:00 PM" style={styles.input}/>}

        <Text style={styles.label}>STARTING PRICE / RATE</Text>
        <TextInput
          value={startingPrice}
          onChangeText={setStartingPrice}
          keyboardType="decimal-pad"
          maxLength={10}
          placeholder="Leave blank for Contact for price"
          style={styles.input}
        />

        {showsListingPhotos && <><Text style={styles.label}>{role === "homegarage" ? "HOME GARAGE PHOTOS (OPTIONAL)" : role === "shop-owner" ? "SHOP PHOTOS (OPTIONAL)" : role === "onsite-mechanic" ? "MECHANIC WORK PHOTOS (OPTIONAL)" : "TOWING PHOTOS (OPTIONAL)"}</Text><Text style={styles.photoHint}>{role === "homegarage" ? "Add up to 3 photos of your garage or work area." : role === "shop-owner" ? "Add up to 3 photos of your shop, service area, or exterior." : role === "onsite-mechanic" ? "Add up to 3 photos of your tools, work area, or completed repairs." : "Add up to 3 photos of your tow truck, equipment, or service."}</Text><View style={styles.photoGrid}>{photoUrls.map((url, index) => <View key={url} style={styles.photoWrap}><Image source={{ uri: url }} style={styles.photo} /><TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Feather name="x" size={15} color="#fff" /></TouchableOpacity></View>)}{photoUrls.length < 3 && <TouchableOpacity style={styles.addPhoto} disabled={uploadingPhotos} onPress={() => void addPhotos()}>{uploadingPhotos ? <ActivityIndicator color={COLORS.primary} /> : <><Feather name="image" size={21} color={COLORS.primary} /><Text style={styles.addPhotoText}>Add photo</Text></>}</TouchableOpacity>}</View></>}

        {(role === "towing-company" || role === "homegarage") && <>
        <Text style={styles.label}>{role === "homegarage" ? "EMERGENCY REPAIR SERVICE AVAILABLE" : "EMERGENCY SERVICE AVAILABLE"}</Text>
        {role === "homegarage" && <Text style={styles.photoHint}>Urgent repair requests at your garage, not roadside assistance.</Text>}
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

        {role !== "homegarage" && role !== "shop-owner" && <>
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
        <TouchableOpacity
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
        </TouchableOpacity>
        </>}

        <TouchableOpacity
          style={[styles.saveButton, (saving || locating) && styles.disabled]}
          onPress={() => void save()}
          disabled={saving || locating}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save Public Listing</Text>}
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={showSavedModal} transparent animationType="fade" onRequestClose={() => setShowSavedModal(false)}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}><Feather name="check" size={30} color="#FFFFFF" /></View>
            <Text style={styles.successEyebrow}>LISTING UPDATED</Text>
            <Text style={styles.successTitle}>Saved successfully</Text>
            <Text style={styles.successMessage}>Your public listing has been saved and is being updated for customers.</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSavedModal(false);
                if (router.canGoBack()) router.back();
                else router.replace(role === "homegarage" ? "/(homegarage)/profile" : role === "shop-owner" ? "/(shop-owner)/profile" : role === "towing-company" ? "/(towing-company)/profile" : "/(onsite-mechanic)/profile");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.successButtonText}>Done</Text>
              <Feather name="arrow-right" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  areaSearchRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 10, paddingLeft: 14, paddingRight: 6 },
  areaSearchInput: { flex: 1, minHeight: 52, color: COLORS.text, fontSize: 16 },
  areaSearchButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  suggestionList: { marginTop: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: "hidden", backgroundColor: COLORS.surface },
  suggestion: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#28232A", alignItems: "center", justifyContent: "center" },
  suggestionCopy: { flex: 1 },
  suggestionTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  suggestionSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  mapFrame: { height: 250, marginTop: 12, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  map: { flex: 1 },
  mapHint: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  searchMessage: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
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
  modalShade: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,.68)" },
  timeModal: { width: "100%", maxWidth: 480, maxHeight: "82%", flexShrink: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 18 },
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
  successBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  successCard: { width: "100%", maxWidth: 390, alignItems: "center", padding: 25, borderRadius: 22, backgroundColor: "#151E25", borderWidth: 1, borderColor: "#354249" },
  successIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#1C8D5B", marginBottom: 15 },
  successEyebrow: { color: "#55D99A", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  successTitle: { color: "#F7F9FA", fontSize: 23, fontWeight: "900", marginTop: 7, textAlign: "center" },
  successMessage: { color: "#A1ABB2", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 9, marginBottom: 20 },
  successButton: { width: "100%", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, backgroundColor: "#F51F3B" },
  successButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
