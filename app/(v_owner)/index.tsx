// app/(owner)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { ProviderDetailCard } from "../../components/owner/ProviderDetailCard";
import { StatusPill } from "../../components/owner/StatusPill";
import { nearestSnapPoint, SHEET_COLLAPSED, SHEET_EXPANDED, SHEET_MID } from "../../constants/owner/bottomSheet";
import { colors } from "../../constants/owner/theme";
import {
  CATEGORIES,
  getCategoryBadge,
  getCategoryIcon,
  getServiceLabel,
  MOCK_CENTER,
  MOCK_LOCATION_LABEL,
  type MockProvider,
  ProviderCategory,
} from "../../data/owner/mockProviders";
import { useMyLocation } from "../../hooks/useMyLocation";
import { loadCustomerMapProviders } from "../../services/owner/providerMapService";
import { haversineDistanceKm } from "../../utils/geo";
import { buildMapHtml } from "../../utils/owner/buildMapHtml";
import { styles } from "./index.styles";

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------
export default function OwnerDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>("All");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providers, setProviders] = useState<MockProvider[]>([]);

  // Real GPS position + permission/error state. `watch` keeps the user dot
  // and distance values live as the user moves.
  const { location: userLocation, error, refresh } = useMyLocation();

  useEffect(() => {
    let active = true;

    loadCustomerMapProviders()
      .then((nextProviders) => {
        if (active) {
          setProviders(nextProviders);
        }
      })
      .catch((error) => {
        console.error("Failed to load customer map providers", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProviders =
    selectedCategory === "All"
      ? providers
      : providers.filter((p) => p.category === selectedCategory);

  useEffect(() => {
    if (selectedProviderId && !filteredProviders.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(null);
    }
  }, [filteredProviders, selectedProviderId]);

  const selectedProvider = filteredProviders.find((p) => p.id === selectedProviderId) ?? null;

  // Real GPS wins as the map center when available; otherwise fall back to the
  // provider average (existing behavior) or the mock center.
  const mapCenter = useMemo(() => {
    if (userLocation) {
      return userLocation;
    }
    if (!filteredProviders.length) {
      return MOCK_CENTER;
    }

    const averageLat =
      filteredProviders.reduce((sum, provider) => sum + provider.lat, 0) / filteredProviders.length;
    const averageLng =
      filteredProviders.reduce((sum, provider) => sum + provider.lng, 0) / filteredProviders.length;

    return { lat: averageLat, lng: averageLng };
  }, [filteredProviders, userLocation]);

  // Distance from the user's actual GPS position (Haversine). Falls back to
  // the provider's static mock distance when GPS isn't available.
  const distanceTo = (provider: MockProvider) =>
    userLocation ? haversineDistanceKm(userLocation, provider) : provider.distanceKm;

  const mapHtml = useMemo(
    () => buildMapHtml(mapCenter, filteredProviders, colors.primary, userLocation),
    [filteredProviders, mapCenter, userLocation]
  );

  // ---- Live GPS dot bridge ----
  const webViewRef = useRef<WebView>(null);

  // Push GPS updates into the Leaflet page without a full WebView reload;
  // `recenter = false` so we never yank the map away while the user pans.
  useEffect(() => {
    if (webViewRef.current && userLocation) {
      webViewRef.current.injectJavaScript(
        `window.updateUserLocation(${userLocation.lat}, ${userLocation.lng}, false); true;`
      );
    }
  }, [userLocation]);

  const handleRecenter = () => {
    webViewRef.current?.injectJavaScript("window.recenterToUser(); true;");
  };

  // ---- Draggable bottom sheet ----
  const sheetHeight = useRef(new Animated.Value(SHEET_MID)).current;
  const sheetHeightValueRef = useRef(SHEET_MID);
  const dragStartHeightRef = useRef(SHEET_MID);

  // Keep a plain-number mirror of the animated value for clamping math
  useMemo(() => {
    sheetHeight.addListener(({ value }) => {
      sheetHeightValueRef.current = value;
    });
    // no cleanup needed for the lifetime of this screen instance
  }, [sheetHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        dragStartHeightRef.current = sheetHeightValueRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        // Dragging up (negative dy) should increase sheet height
        const raw = dragStartHeightRef.current - gestureState.dy;
        const clamped = Math.min(SHEET_EXPANDED, Math.max(SHEET_COLLAPSED, raw));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const raw = dragStartHeightRef.current - gestureState.dy;
        const target = nearestSnapPoint(raw);
        Animated.spring(sheetHeight, {
          toValue: target,
          useNativeDriver: false,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  // Selecting a provider expands the sheet into the detail card; clearing the
  // selection (closing the card or switching category) returns it to its
  // default resting height.
  const selectProvider = (id: string | null) => {
    setSelectedProviderId(id);
    Animated.spring(sheetHeight, {
      toValue: id ? SHEET_EXPANDED : SHEET_MID,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  };

  // Recenter button sits just above the sheet's current height
  const floatingBottom = Animated.add(sheetHeight, 14);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Fullscreen map — fills the entire screen behind everything, stays visible
          and interactive even while a provider's details are expanded below */}
      <WebView
        key={selectedCategory}
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.fullscreenMap}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.id) {
              selectProvider(selectedProviderId === data.id ? null : data.id);
            }
          } catch {
            // ignore malformed messages
          }
        }}
      />

      {/* Top overlay: header, search, location — floats over the map */}
      <SafeAreaView style={styles.topOverlay} edges={["top"]}>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder}>Find a towing provider, auto shop, mechanic...</Text>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.locationText}>{MOCK_LOCATION_LABEL}</Text>
        </View>
      </SafeAreaView>

      {/* Permission / GPS error banner — floats under the top overlay; tap to retry */}
      {error && (
        <View style={styles.locationBannerWrap}>
          <Pressable style={styles.locationBanner} onPress={refresh}>
            <Ionicons name="alert-circle" size={18} color={colors.busy} />
            <Text style={styles.locationBannerText}>{error}</Text>
            <Text style={styles.locationBannerRetry}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Recenter button — moves the map onto the user's actual GPS position */}
      <Animated.View style={[styles.recenterButtonWrap, { bottom: floatingBottom }]}>
        <Pressable style={styles.recenterButton} onPress={handleRecenter}>
          <Ionicons name="navigate-outline" size={18} color={colors.primary} />
        </Pressable>
      </Animated.View>

      {/* Draggable bottom sheet: shows either the normal listing (towing CTA,
          categories, nearby providers) or — when a provider is selected — the
          expanded provider detail card, which takes visual priority over the
          listing while the map stays visible and interactive behind it. */}
      <Animated.View style={[styles.bottomPanel, { height: sheetHeight }]}>
        {/* Drag handle — swipe up/down here to resize the sheet */}
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.bottomPanelHandle} />
        </View>

        {selectedProvider ? (
          <ProviderDetailCard
            provider={selectedProvider}
            distanceKm={userLocation ? distanceTo(selectedProvider) : undefined}
            onClose={() => selectProvider(null)}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bottomPanelContent}
          >
            {/* Request Towing button */}
            <Pressable style={styles.towingButton}>
              <View style={styles.towingIconWrap}>
                <Ionicons name="car-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.towingTextWrap}>
                <Text style={styles.towingTitle}>Request Towing</Text>
                <Text style={styles.towingSubtitle}>24/7 emergency roadside assistance</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </Pressable>

            {/* Provider categories */}
            <Text style={styles.sectionTitle}>Provider Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((cat) => {
                const isActive = cat.label === selectedCategory;
                return (
                  <Pressable
                    key={cat.label}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => {
                      setSelectedCategory(cat.label);
                      selectProvider(null);
                    }}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={16}
                      color={isActive ? colors.white : colors.primary}
                    />
                    <Text
                      style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Nearby providers listing */}
            <View style={styles.listingHeaderRow}>
              <Text style={styles.sectionTitle}>Nearby Providers</Text>
              <Text style={styles.listingCount}>{filteredProviders.length} found</Text>
            </View>

            <View style={styles.listingList}>
              {filteredProviders.map((provider) => {
                const isSelected = provider.id === selectedProviderId;
                const badge = getCategoryBadge(provider.category);
                const distanceKm = distanceTo(provider);
                return (
                  <Pressable
                    key={provider.id}
                    style={[styles.listingCard, isSelected && styles.listingCardSelected]}
                    onPress={() => {
                      selectProvider(provider.id);
                    }}
                  >
                    {/* Small rounded-square thumbnail on the left */}
                    <View style={[styles.listingThumb, { backgroundColor: provider.color }]}>
                      <Text style={styles.listingThumbText}>{provider.initials}</Text>
                    </View>

                    <View style={styles.listingBody}>
                      <View style={styles.listingTopRow}>
                        <Text style={styles.listingName} numberOfLines={1}>
                          {provider.name}
                        </Text>
                        <StatusPill category={provider.category} isPositive={provider.isPositiveStatus} compact />
                      </View>

                      <View style={styles.listingServiceRow}>
                        <Ionicons name={getCategoryIcon(provider.category)} size={12} color={colors.primary} />
                        <Text style={styles.listingServiceText} numberOfLines={1}>
                          {getServiceLabel(provider.category)}
                        </Text>
                      </View>

                      <View style={styles.listingMetaRow}>
                        <Ionicons name="star" size={12} color={colors.rating} />
                        <Text style={styles.listingMetaText}>{provider.rating.toFixed(1)}</Text>
                        <Text style={styles.listingMetaTextMuted}>({provider.reviewCount})</Text>
                        <Text style={styles.listingMetaDot}>{"\u2022"}</Text>
                        <Ionicons name="navigate-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.listingMetaText}>{distanceKm.toFixed(1)} km</Text>
                      </View>

                      <View style={styles.listingBottomRow}>
                        <Text style={styles.listingPrice}>Starts at {provider.startingPrice}</Text>
                        <View style={styles.onsiteBadge}>
                          <Ionicons name={badge.icon} size={10} color={colors.primary} />
                          <Text style={styles.onsiteBadgeText}>{badge.text}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}