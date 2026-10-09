// app/(owner)/towing-booking/book-towing.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { createTowingBooking } from "../../../services/owner/towingService";
import { getTowingPricing } from "../../../services/towingPricingService";
import type { TowingPricingConfig } from "../../../types/towingPricing";
import { haversineDistanceKm } from "../../../utils/geo";
import { buildDestinationMapHtml } from "../../../utils/owner/buildDestinationMapHtml";

import { colors } from "../../../constants/owner/theme";
import { MockProvider } from "../../../data/owner/mockProviders";
import { subscribeToMyVehicles } from "../../../services/owner/vehicleService";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { TOWING_TYPES, VEHICLE_CONDITIONS } from "../../../types/owner/towing";
import type { SavedVehicle } from "../../../types/owner/vehicle";

// Fallback center (Cebu City) shown before GPS resolves or if permission is denied.
const DEFAULT_CENTER = { lat: 10.3157, lng: 123.8854 };

type DestinationSuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
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

export default function BookTowingScreen() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const [provider, setProvider] = useState<MockProvider | null>(null);
  const [providerError, setProviderError] = useState("");
  const [pricingConfig, setPricingConfig] = useState<TowingPricingConfig | null>(null);

  useEffect(() => {
    if (!providerId) { setProviderError("No provider was selected."); return; }
    getPublicProviderListing(providerId).then((listing) => {
      if (!listing || listing.role !== "towing-company") { setProviderError("This towing provider is no longer available."); return; }
      setProvider({ id: listing.providerId, name: listing.businessName, category: listing.category,
        rating: listing.ratingSummary.average, reviewCount: listing.ratingSummary.count, distanceKm: 0,
        startingPrice: listing.startingPrice == null ? "Price on assessment" : `₱${listing.startingPrice.toLocaleString()}`,
        isPositiveStatus: listing.availability === "available", initials: listing.businessName.slice(0, 2).toUpperCase(),
        color: colors.primary, lat: listing.location.latitude, lng: listing.location.longitude,
        description: listing.serviceAreaLabel, services: listing.services, hours: listing.operatingHours,
        emergencyServiceAvailable: listing.emergencyServiceAvailable, phone: "", vehicleTypes: listing.vehicleTypes as MockProvider["vehicleTypes"], reviews: [] });
    }).catch(() => setProviderError("Unable to load this provider."));
    getTowingPricing(providerId).then(setPricingConfig).catch(() => setProviderError("Unable to load this provider's towing pricing."));
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

  // Pickup location — string state kept exactly as before so createTowingBooking()
  // keeps working unchanged.
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");

  const [selectedTowingType, setSelectedTowingType] = useState<string | null>(null);
  const [isTowingTypeModalVisible, setTowingTypeModalVisible] = useState(false);

  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [isConditionModalVisible, setConditionModalVisible] = useState(false);

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // --- Pickup GPS state --------------------------------------------------
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const pickupSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupSearchController = useRef<AbortController | null>(null);

  // --- Destination map state (tap-to-select + autocomplete-driven) ------
  const destWebViewRef = useRef<WebView | null>(null);
  const [destMapHtml] = useState(() => buildDestinationMapHtml(DEFAULT_CENTER, colors.primary));
  const isDestMapReady = useRef(false);
  const pendingDestMarker = useRef<{ lat: number; lng: number } | null>(null);
  const [isReverseGeocodingDestination, setIsReverseGeocodingDestination] = useState(false);

  // --- Destination autocomplete state ----------------------------------
  const [destinationSuggestions, setDestinationSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const destinationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchController = useRef<AbortController | null>(null);
  const [destinationSearchMessage, setDestinationSearchMessage] = useState("");
  const [isMapInteracting, setIsMapInteracting] = useState(false);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleId === selectedVehicleId) ?? null;
  const distanceEstimate = useMemo(() => {
    if (!provider || !pickupCoordinates || !destinationCoordinates) return null;
    const providerToPickupDistanceKm = haversineDistanceKm(
      { lat: provider.lat, lng: provider.lng },
      { lat: pickupCoordinates.latitude, lng: pickupCoordinates.longitude }
    );
    const pickupToDestinationDistanceKm = haversineDistanceKm(
      { lat: pickupCoordinates.latitude, lng: pickupCoordinates.longitude },
      { lat: destinationCoordinates.latitude, lng: destinationCoordinates.longitude }
    );
    return { providerToPickupDistanceKm, pickupToDestinationDistanceKm,
      totalDistanceKm: providerToPickupDistanceKm + pickupToDestinationDistanceKm };
  }, [destinationCoordinates, pickupCoordinates, provider]);
  const pricingEstimate = useMemo(() => {
    if (!distanceEstimate || !pricingConfig) return null;
    const totalDistanceKm = Number(distanceEstimate.totalDistanceKm.toFixed(2));
    const distanceCharge = Number((totalDistanceKm * pricingConfig.pricePerKm).toFixed(2));
    return {
      ...pricingConfig,
      totalDistanceKm,
      distanceCharge,
      estimatedTotalPrice: Number((pricingConfig.basePrice + distanceCharge).toFixed(2)),
    };
  }, [distanceEstimate, pricingConfig]);
  const usesDispatcherPricing = pricingConfig?.pricingMode === "dispatcher";

  const canConfirm =
    !!selectedVehicle &&
    !!pickupCoordinates &&
    !!destinationCoordinates &&
    (usesDispatcherPricing || !!pricingEstimate) &&
    pickupLocation.trim().length > 0 &&
    destination.trim().length > 0 &&
    !!selectedTowingType &&
    !!selectedCondition;

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setVehicleModalVisible(false);
  };

  const handleSelectTowingType = (towingType: string) => {
    setSelectedTowingType(towingType);
    setTowingTypeModalVisible(false);
  };

  const handleSelectCondition = (condition: string) => {
    setSelectedCondition(condition);
    setConditionModalVisible(false);
  };

  // --- Reverse geocoding: coordinates -> readable address (pickup) ------
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsReverseGeocoding(true);
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(
          (part, index, arr) => !!part && arr.indexOf(part) === index
        );
        setPickupLocation(
          parts.length > 0 ? parts.join(", ") : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );
      } else {
        setPickupLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setPickupLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  // --- Reverse geocoding: coordinates -> readable address (destination) -
  // Used only when the owner taps the Destination map manually.
  const reverseGeocodeDestination = useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsReverseGeocodingDestination(true);
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(
          (part, index, arr) => !!part && arr.indexOf(part) === index
        );
        setDestination(
          parts.length > 0 ? parts.join(", ") : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );
      } else {
        setDestination(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setDestination(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setIsReverseGeocodingDestination(false);
    }
  }, []);

  // --- GPS: request permission + fetch current position (pickup only) ---
  const goToCurrentLocation = useCallback(async () => {
    try {
      setIsLocating(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Location permission denied. You can still type the pickup address manually below."
        );
        setIsLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      setPickupCoordinates({ latitude, longitude });
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);

      await reverseGeocode(latitude, longitude);
    } catch {
      setLocationError(
        "Couldn't get your current location. You can type the pickup address manually below."
      );
    } finally {
      setIsLocating(false);
    }
  }, [reverseGeocode]);

  // Ask for GPS location as soon as the screen loads.
  useEffect(() => {
    goToCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Destination map: place/move the marker ---------------------------
  const moveDestinationMarker = useCallback((lat: number, lng: number, zoom = 16) => {
    if (isDestMapReady.current) {
      destWebViewRef.current?.injectJavaScript(`window.setMarker(${lat}, ${lng}, ${zoom}); true;`);
    } else {
      pendingDestMarker.current = { lat, lng };
    }
  }, []);

  // Tap-to-select on the Destination map — the map already dropped its own
  // marker locally before posting this message, we just reverse-geocode it.
  const handleDestMapMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "select" && typeof data.lat === "number" && typeof data.lng === "number") {
        Keyboard.dismiss();
        setShowDestinationSuggestions(false);
        setDestinationSuggestions([]);
        setDestinationCoordinates({ latitude: data.lat, longitude: data.lng });
        reverseGeocodeDestination(data.lat, data.lng);
      }
    } catch {
      // ignore malformed messages
    }
  };

  // Flush a marker placement that arrived before the Leaflet page finished loading.
  const handleDestMapLoadEnd = () => {
    isDestMapReady.current = true;
    if (pendingDestMarker.current) {
      const { lat, lng } = pendingDestMarker.current;
      destWebViewRef.current?.injectJavaScript(`window.setMarker(${lat}, ${lng}, 16); true;`);
      pendingDestMarker.current = null;
    }
  };

  const fetchLocationSuggestions = useCallback(async (
    query: string,
    controllerRef: React.MutableRefObject<AbortController | null>,
  ) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const bias = pickupCoordinates
      ? `&lat=${pickupCoordinates.latitude}&lon=${pickupCoordinates.longitude}`
      : `&lat=${DEFAULT_CENTER.lat}&lon=${DEFAULT_CENTER.lng}`;
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
        lat: coordinates[1],
        lng: coordinates[0],
      }];
    });
  }, [pickupCoordinates]);

  const searchDestination = useCallback((query: string) => {
    if (destinationSearchTimeout.current) clearTimeout(destinationSearchTimeout.current);
    destinationSearchController.current?.abort();
    setDestinationSearchMessage("");
    if (query.trim().length < 3) {
      setDestinationSuggestions([]);
      setIsSearchingDestination(false);
      return;
    }
    destinationSearchTimeout.current = setTimeout(async () => {
      try {
        setIsSearchingDestination(true);
        const results = await fetchLocationSuggestions(query, destinationSearchController);
        setDestinationSuggestions(results);
        setDestinationSearchMessage(results.length ? "" : "No matching locations found.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setDestinationSuggestions([]);
          setDestinationSearchMessage("Location search is unavailable. Try again or tap the map.");
        }
      } finally {
        setIsSearchingDestination(false);
      }
    }, 650);
  }, [fetchLocationSuggestions]);

  const searchPickup = useCallback((query: string) => {
    if (pickupSearchTimeout.current) clearTimeout(pickupSearchTimeout.current);
    pickupSearchController.current?.abort();
    if (query.trim().length < 3) {
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
      return;
    }
    pickupSearchTimeout.current = setTimeout(async () => {
      try {
        setIsSearchingPickup(true);
        setPickupSuggestions(await fetchLocationSuggestions(query, pickupSearchController));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPickupSuggestions([]);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 650);
  }, [fetchLocationSuggestions]);

  const handleDestinationChange = (text: string) => {
    setDestination(text);
    setDestinationCoordinates(null);
    setShowDestinationSuggestions(true);
    searchDestination(text);
  };

  // Tapping a suggestion: fill the field, drop the marker, recenter the map.
  const handleSelectDestination = (item: DestinationSuggestion) => {
    setDestination(item.label);
    setDestinationSuggestions([]);
    setShowDestinationSuggestions(false);
    setDestinationCoordinates({ latitude: item.lat, longitude: item.lng });
    moveDestinationMarker(item.lat, item.lng, 16);
    Keyboard.dismiss();
  };

  const handlePickupChange = (text: string) => {
    setPickupLocation(text);
    setPickupCoordinates(null);
    setShowPickupSuggestions(true);
    searchPickup(text);
  };

  const handleSelectPickup = (item: DestinationSuggestion) => {
    setPickupLocation(item.label);
    setPickupCoordinates({ latitude: item.lat, longitude: item.lng });
    setPickupSuggestions([]);
    setShowPickupSuggestions(false);
    Keyboard.dismiss();
  };

  useEffect(() => () => {
    if (pickupSearchTimeout.current) clearTimeout(pickupSearchTimeout.current);
    if (destinationSearchTimeout.current) clearTimeout(destinationSearchTimeout.current);
    pickupSearchController.current?.abort();
    destinationSearchController.current?.abort();
  }, []);

  const handleConfirm = async () => {
    if (!canConfirm || submitting || !selectedVehicle || !selectedTowingType || !selectedCondition || !provider || !pickupCoordinates || !destinationCoordinates || !distanceEstimate || (!pricingEstimate && !usesDispatcherPricing) || !pricingConfig) return;
    setSubmitting(true);

    const booking = await createTowingBooking({
      providerId: provider.id,
      providerName: provider.name,
      vehicleId: selectedVehicle.vehicleId,
      vehicle: `${selectedVehicle.make} ${selectedVehicle.model}`,
      vehicleYear: selectedVehicle.year,
      vehiclePlate: selectedVehicle.plateNumber,
      latitude: pickupCoordinates.latitude,
      longitude: pickupCoordinates.longitude,
      providerLatitude: provider.lat,
      providerLongitude: provider.lng,
      destinationLatitude: destinationCoordinates.latitude,
      destinationLongitude: destinationCoordinates.longitude,
      providerToPickupDistanceKm: Number(distanceEstimate.providerToPickupDistanceKm.toFixed(2)),
      pickupToDestinationDistanceKm: Number(distanceEstimate.pickupToDestinationDistanceKm.toFixed(2)),
      totalDistanceKm: usesDispatcherPricing ? Number(distanceEstimate.totalDistanceKm.toFixed(2)) : pricingEstimate!.totalDistanceKm,
      basePrice: usesDispatcherPricing ? 0 : pricingEstimate!.basePrice,
      pricePerKm: usesDispatcherPricing ? 0 : pricingEstimate!.pricePerKm,
      distanceCharge: usesDispatcherPricing ? 0 : pricingEstimate!.distanceCharge,
      estimatedTotalPrice: usesDispatcherPricing ? 0 : pricingEstimate!.estimatedTotalPrice,
      pricingMode: pricingConfig.pricingMode,
      dispatcherPhone: pricingConfig.dispatcherPhone,
      pickupLocation,
      destination,
      towingType: selectedTowingType,
      vehicleCondition: selectedCondition,
      notes,
      startingPrice: pricingEstimate ? `₱${pricingEstimate.estimatedTotalPrice.toLocaleString("en-PH")}` : "Price on assessment",
    });

    router.push({
      pathname: "../towing-booking/booking-confirmation",
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
          <Text style={styles.headerTitle}>Book Towing</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        scrollEnabled={!isMapInteracting}
      >
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
        <Text style={styles.sectionSubtitle}>Which vehicle needs towing?</Text>

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

        {/* Pickup location — GPS-detected, no map */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Pickup Location</Text>
        <Text style={styles.sectionSubtitle}>Where is the vehicle right now?</Text>

        <Pressable
          style={styles.useCurrentLocationButton}
          onPress={goToCurrentLocation}
          disabled={isLocating}
        >
          <Ionicons name="locate" size={16} color={colors.primary} />
          <Text style={styles.useCurrentLocationText}>
            {isLocating ? "Locating..." : "Use Current Location"}
          </Text>
        </Pressable>

        {locationError ? <Text style={styles.locationErrorText}>{locationError}</Text> : null}

        <View style={styles.addressCard}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Detected Address</Text>
            <Text style={styles.addressValue}>
              {isReverseGeocoding
                ? "Detecting address..."
                : pickupLocation || "Tap Use Current Location or type an address below"}
            </Text>
          </View>
        </View>

        {/* Manual fallback — also used when permission is denied */}
        <TextInput
          style={[styles.textInput, { marginTop: 8 }]}
          placeholder="Search for a pickup location"
          placeholderTextColor={colors.textMuted}
          value={pickupLocation}
          onChangeText={handlePickupChange}
          onFocus={() => setShowPickupSuggestions(true)}
        />
        {isSearchingPickup ? <Text style={styles.suggestionHint}>Searching pickup locations...</Text> : null}
        {showPickupSuggestions && pickupSuggestions.length > 0 ? (
          <View style={styles.inlineSuggestionList}>
            {pickupSuggestions.map((item) => (
              <Pressable key={item.id} style={styles.suggestionItem} onPress={() => handleSelectPickup(item)}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.suggestionText} numberOfLines={2}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Destination — address autocomplete + tap-to-select map */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Destination</Text>
        <Text style={styles.sectionSubtitle}>Where should the vehicle be towed to?</Text>
        <View style={styles.autocompleteWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Cebu Auto Care Center"
            placeholderTextColor={colors.textMuted}
            value={destination}
            onChangeText={handleDestinationChange}
            onFocus={() => setShowDestinationSuggestions(true)}
          />
          {isSearchingDestination && (
            <Text style={styles.suggestionHint}>Searching...</Text>
          )}
          {showDestinationSuggestions && destinationSuggestions.length > 0 && (
            <View style={styles.inlineSuggestionList}>
              {destinationSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectDestination(item)}
                >
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {!isSearchingDestination && showDestinationSuggestions && destinationSearchMessage ? (
            <Text style={styles.searchMessage}>{destinationSearchMessage}</Text>
          ) : null}
        </View>

        {destinationCoordinates ? (
          <View style={styles.selectedLocationRow}>
            <Ionicons name="checkmark-circle" size={17} color={colors.success} />
            <Text style={styles.selectedLocationText} numberOfLines={2}>{destination}</Text>
          </View>
        ) : null}

        <View style={styles.destMapWrapper}>
          <WebView
            ref={destWebViewRef}
            originWhitelist={["*"]}
            source={{ html: destMapHtml }}
            style={styles.destMap}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            nestedScrollEnabled
            overScrollMode="never"
            onMessage={handleDestMapMessage}
            onLoadEnd={handleDestMapLoadEnd}
            onTouchStart={() => setIsMapInteracting(true)}
            onTouchEnd={() => setIsMapInteracting(false)}
            onTouchCancel={() => setIsMapInteracting(false)}
          />
        </View>
        <Text style={styles.mapHintText}>
          {isReverseGeocodingDestination
            ? "Detecting address..."
            : "Tip: tap the map to set the destination manually"}
        </Text>

        {/* Towing type — single selection, tap to change */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Towing Type</Text>
        <Text style={styles.sectionSubtitle}>Pick the towing method that fits your vehicle</Text>

        {selectedTowingType ? (
          <Pressable style={styles.selectedCard} onPress={() => setTowingTypeModalVisible(true)}>
            <View style={styles.optionIconWrap}>
              <Ionicons name="car-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedCardTitle}>{selectedTowingType}</Text>
            </View>
            <Text style={styles.changeLabel}>Change</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => setTowingTypeModalVisible(true)}>
            <Ionicons name="car-outline" size={18} color={colors.primary} />
            <Text style={styles.emptyCardText}>Select towing type</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Vehicle condition — single selection, tap to change */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Vehicle Condition</Text>
        <Text style={styles.sectionSubtitle}>Helps the provider bring the right equipment</Text>

        {selectedCondition ? (
          <Pressable style={styles.selectedCard} onPress={() => setConditionModalVisible(true)}>
            <View style={styles.optionIconWrap}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedCardTitle}>{selectedCondition}</Text>
            </View>
            <Text style={styles.changeLabel}>Change</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => setConditionModalVisible(true)}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.emptyCardText}>Select vehicle condition</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Notes */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Additional Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Describe anything the provider should know..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </ScrollView>

      {/* Confirm bar */}
      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        {usesDispatcherPricing ? <View style={styles.priceRow}><Text style={styles.priceLabel}>Pricing</Text><Text style={styles.priceValue}>{pricingConfig?.dispatcherPhone || "Contact dispatcher"}</Text></View> : <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Base towing fee</Text>
          <Text style={styles.priceValue}>{pricingConfig ? `₱${pricingConfig.basePrice.toLocaleString("en-PH")}` : "Not configured"}</Text>
        </View>}
        {!usesDispatcherPricing && pricingEstimate && <>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Estimated distance</Text><Text style={styles.priceValue}>{pricingEstimate.totalDistanceKm.toFixed(2)} km</Text></View>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Rate</Text><Text style={styles.priceValue}>₱{pricingEstimate.pricePerKm.toLocaleString("en-PH")}/km</Text></View>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Distance charge</Text><Text style={styles.priceValue}>₱{pricingEstimate.distanceCharge.toLocaleString("en-PH")}</Text></View>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Estimated total</Text><Text style={styles.priceValue}>₱{pricingEstimate.estimatedTotalPrice.toLocaleString("en-PH")}</Text></View>
        </>}
        {!canConfirm && (
          <Text style={styles.validationText}>{!pricingConfig ? "This provider has not configured towing pricing yet." : "Please fill in all fields and select a mapped destination."}</Text>
        )}
        <Pressable
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm || submitting}
        >
          <Text style={[styles.confirmButtonText, !canConfirm && styles.confirmButtonTextDisabled]}>
            {submitting ? "Sending..." : "Confirm Towing"}
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

      {/* Select Towing Type modal */}
      <Modal
        visible={isTowingTypeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTowingTypeModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTowingTypeModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Select Towing Type</Text>
            <Pressable onPress={() => setTowingTypeModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {TOWING_TYPES.map((towingType) => {
              const isSelected = towingType === selectedTowingType;
              return (
                <Pressable
                  key={towingType}
                  style={[styles.modalOptionCard, isSelected && styles.modalOptionCardSelected]}
                  onPress={() => handleSelectTowingType(towingType)}
                >
                  <View style={styles.optionIconWrap}>
                    <Ionicons name="car-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.selectedCardTitle, { flex: 1 }]}>{towingType}</Text>
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

      {/* Select Vehicle Condition modal */}
      <Modal
        visible={isConditionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setConditionModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConditionModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Vehicle Condition</Text>
            <Pressable onPress={() => setConditionModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            {VEHICLE_CONDITIONS.map((condition) => {
              const isSelected = condition === selectedCondition;
              return (
                <Pressable
                  key={condition}
                  style={[styles.modalOptionCard, isSelected && styles.modalOptionCardSelected]}
                  onPress={() => handleSelectCondition(condition)}
                >
                  <View style={styles.optionIconWrap}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.selectedCardTitle, { flex: 1 }]}>{condition}</Text>
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

  // Generic "current selection" card — reused for Vehicle, Towing Type, Condition
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
  optionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 14, lineHeight: 20, color: colors.textPrimary,
  },
  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 13, color: colors.textPrimary,
    minHeight: 80, textAlignVertical: "top",
  },

  useCurrentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  useCurrentLocationText: { fontSize: 12.5, fontWeight: "600", color: colors.primary },
  locationErrorText: { fontSize: 12.5, lineHeight: 18, color: colors.rating, marginTop: 8 },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  addressLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 2 },
  addressValue: { fontSize: 14.5, fontWeight: "500", color: colors.textPrimary },

  // --- Destination autocomplete ---
  autocompleteWrapper: { position: "relative" },
  suggestionHint: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 6 },
  inlineSuggestionList: {
    marginTop: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 4,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },
  searchMessage: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 7 },
  selectedLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.successLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  selectedLocationText: { flex: 1, fontSize: 12.5, fontWeight: "500", color: colors.textPrimary },

  // --- Destination map ---
  destMapWrapper: {
    height: 280,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  destMap: { ...StyleSheet.absoluteFillObject },
  mapHintText: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 6 },

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

  // Shared bottom-sheet modal (Vehicle + Towing Type + Condition)
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
