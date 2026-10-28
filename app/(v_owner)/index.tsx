// app/(owner)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  ScrollView as ScrollViewType,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import MapHtmlSurface from "../../components/maps/MapHtmlSurface";

import { ProviderDetailCard } from "../../components/owner/ProviderDetailCard";
import { AccountActionWarning } from "../../components/AccountActionWarning";
import { StatusPill } from "../../components/owner/StatusPill";
import { nearestSnapPoint, SHEET_COLLAPSED, SHEET_EXPANDED, SHEET_MID } from "../../constants/owner/bottomSheet";
import { colors } from "../../constants/owner/theme";
import { useActionRisk } from "../../hooks/useActionRisk";
import {
  CATEGORIES,
  getCategoryIcon,
  getServiceLabel,
  MOCK_CENTER,
  MOCK_LOCATION_LABEL,
  type MockProvider,
  ProviderCategory,
} from "../../data/owner/mockProviders";
import { useMyLocation } from "../../hooks/useMyLocation";
import { subscribeToCustomerMapProviders, subscribeToCustomerMapShops } from "../../services/owner/providerMapService";
import { estimateEtaMinutes, haversineDistanceKm } from "../../utils/geo";
import { buildMapHtml } from "../../utils/owner/buildMapHtml";
import { styles } from "../../components/owner/ownerMapStyles";

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------
export default function OwnerDashboard() {
  const actionRisk = useActionRisk("owner");
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>("All");
  const [discoveryMode, setDiscoveryMode] = useState<"now" | "scheduled">("now");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [providers, setProviders] = useState<MockProvider[]>([]);
  const [shops, setShops] = useState<MockProvider[]>([]);
  const [failedProviderPhotoUrls, setFailedProviderPhotoUrls] = useState<Set<string>>(() => new Set());
  const [shopError, setShopError] = useState<string | null>(null);

  // Real GPS position + permission/error state. `watch` keeps the user dot
  // and distance values live as the user moves.
  const { location: userLocation, error, refresh } = useMyLocation();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setShopError(null);
      const stopShops = subscribeToCustomerMapShops((items) => {
        if (active) { setShops(items); setShopError(null); }
      }, () => {
        if (active) { setShops([]); setShopError("Unable to load Auto Shops. Return to Home to try again."); }
      }, discoveryMode === "scheduled");
      const stopProviders = subscribeToCustomerMapProviders((nextProviders) => {
        if (active) setProviders(nextProviders.filter((provider) => provider.category !== "Auto Shops"));
      }, (error) => {
        console.error("Failed to load available customer map providers", error);
        if (active) setProviders([]);
      }, discoveryMode === "scheduled");

      return () => {
        active = false;
        stopShops();
        stopProviders();
      };
    }, [discoveryMode])
  );

  const allProviders = [...providers, ...shops];
  const categoryProviders =
    selectedCategory === "All"
      ? allProviders
      : allProviders.filter((p) => p.category === selectedCategory);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredProviders = categoryProviders.filter((provider) => {
    if (!normalizedSearch) return true;
    const searchableText = [provider.name, provider.category, getServiceLabel(provider.category),
      provider.description, provider.hours, ...provider.services]
      .join(" ")
      .toLocaleLowerCase();
    return searchableText.includes(normalizedSearch);
  });

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

  // Route from the user's real GPS to the selected provider. Only exists when
  // both a provider is selected AND GPS is available; otherwise the map shows
  // no route (graceful fallback).
  const route = useMemo(() => {
    if (!selectedProvider || !userLocation) return null;
    const distanceKm = haversineDistanceKm(userLocation, selectedProvider);
    return {
      from: userLocation,
      to: { lat: selectedProvider.lat, lng: selectedProvider.lng },
      distanceKm,
      etaMinutes: estimateEtaMinutes(distanceKm),
    };
  }, [selectedProvider, userLocation]);

  const mapHtml = useMemo(
    () => buildMapHtml(mapCenter, filteredProviders, colors.primary, userLocation, route),
    [filteredProviders, mapCenter, userLocation, route]
  );

  // ---- Live GPS dot bridge ----
  const webViewRef = useRef<{ injectJavaScript: (script: string) => void }>(null);

  // Push GPS updates into the Leaflet page without a full WebView reload;
  // `recenter = false` so we never yank the map away while the user pans.
  useEffect(() => {
    if (webViewRef.current && userLocation) {
      webViewRef.current.injectJavaScript(
        `window.updateUserLocation(${userLocation.lat}, ${userLocation.lng}, false); true;`
      );
    }
  }, [userLocation]);

  // Push route updates (or clear the route) whenever the selected provider or
  // the user's GPS changes. Uses the same WebView JS bridge as the GPS dot.
  useEffect(() => {
    if (!webViewRef.current) return;

    if (route) {
      webViewRef.current.injectJavaScript(
        `window.updateRoute(${route.from.lat}, ${route.from.lng}, ${route.to.lat}, ${route.to.lng}, ${route.distanceKm}, ${route.etaMinutes}); true;`
      );
    } else {
      webViewRef.current.injectJavaScript("window.clearRoute(); true;");
    }
  }, [route]);

  const handleRecenter = () => {
    webViewRef.current?.injectJavaScript("window.recenterToUser(); true;");
  };

  // ---- Draggable bottom sheet ----
  const sheetHeight = useRef(new Animated.Value(SHEET_MID)).current;
  const sheetHeightValueRef = useRef(SHEET_MID);
  const dragStartHeightRef = useRef(SHEET_MID);
  const listingScrollRef = useRef<ScrollViewType>(null);

  const scrollToNearbyProviders = () => {
    Animated.spring(sheetHeight, {
      toValue: SHEET_EXPANDED,
      useNativeDriver: false,
      bounciness: 3,
    }).start();
    listingScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Fullscreen map — fills the entire screen behind everything, stays visible
          and interactive even while a provider's details are expanded below */}
      <MapHtmlSurface
        ref={webViewRef}
        sourceHtml={mapHtml}
        style={styles.fullscreenMap}
        onMessage={(event: { nativeEvent: { data: string } }) => {
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

        <View style={styles.searchControls}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search providers or services"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              accessibilityLabel="Search providers and services"
            />
            {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={19} color={colors.textMuted} />
            </Pressable>}
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.locationText}>{userLocation ? "Your current location" : MOCK_LOCATION_LABEL}</Text>
          </View>
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
            timingMode={discoveryMode}
            distanceKm={userLocation ? distanceTo(selectedProvider) : undefined}
            onClose={() => selectProvider(null)}
          />
        ) : (
          <ScrollView
            ref={listingScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bottomPanelContent}
          >
            <AccountActionWarning count={actionRisk.count} error={actionRisk.error} />
            <Pressable
              style={styles.welcomePressable}
              onPress={scrollToNearbyProviders}
              accessibilityRole="button"
              accessibilityLabel="Scroll to nearby providers"
            >
              <ImageBackground
                source={require("../../assets/images/towing-dashboard-bg.png")}
                style={styles.welcomeCard}
                imageStyle={styles.welcomeImage}
                resizeMode="cover"
              >
                <View style={styles.welcomeScrim} />
                <View style={styles.welcomeContent}>
                  <View style={styles.welcomeTextWrap}>
                    <Text style={styles.welcomeEyebrow}>WELCOME TO VERESC</Text>
                    <Text style={styles.welcomeTitle}>We’re here when the road gets tough.</Text>
                    <Text style={styles.welcomeSubtitle}>
                      Find nearby mechanics, towing, shops, and parking in one place.
                    </Text>
                    <Text style={styles.welcomeAction}>EXPLORE NEARBY PROVIDERS  ↓</Text>
                  </View>
                  <View style={styles.welcomeIconWrap}>
                    <Ionicons name="shield-checkmark" size={29} color="#FFFFFF" />
                  </View>
                </View>
              </ImageBackground>
            </Pressable>

            {/* Provider categories */}
            <Text style={styles.sectionTitle}>Provider Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((cat) => {
                const isActive = cat.value === selectedCategory;
                return (
                  <Pressable
                    key={cat.value}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => {
                      setSelectedCategory(cat.value);
                      setSelectedProviderId(null);
                    }}
                  >
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

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              {(["now", "scheduled"] as const).map((mode) => <Pressable key={mode} onPress={() => setDiscoveryMode(mode)} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: discoveryMode === mode ? colors.primary : "#202832" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>{mode === "now" ? "Now" : "Schedule"}</Text>
              </Pressable>)}
            </View>

            {(selectedCategory === "Auto Shops" || selectedCategory === "All") && shopError && <Text style={styles.listingMetaTextMuted}>{shopError}</Text>}
              {!shopError && filteredProviders.length === 0 && (
                <Text style={styles.listingMetaTextMuted}>
                  {normalizedSearch
                    ? "No providers match your search."
                    : selectedCategory === "Auto Shops"
                      ? "No approved shops are currently open for emergency requests."
                      : "No providers are available right now."}
                </Text>
              )}

            <View style={styles.listingList}>
              {filteredProviders.map((provider) => {
                const isSelected = provider.id === selectedProviderId;
                const distanceKm = distanceTo(provider);
                const photoUrl = provider.photoUrls?.[0]?.trim();
                return (
                  <Pressable
                    key={provider.id}
                    style={[styles.listingCard, isSelected && styles.listingCardSelected]}
                    onPress={() => {
                      selectProvider(provider.id);
                    }}
                  >
                    <View style={styles.listingImageWrap}>
                      {photoUrl && !failedProviderPhotoUrls.has(photoUrl) ? (
                        <Image
                          source={{ uri: photoUrl }}
                          style={styles.listingImage}
                          resizeMode="cover"
                          onError={() => setFailedProviderPhotoUrls((current) => {
                            if (current.has(photoUrl)) return current;
                            const next = new Set(current);
                            next.add(photoUrl);
                            return next;
                          })}
                        />
                      ) : (
                        <View style={styles.listingImageFallback}>
                          <Ionicons name={getCategoryIcon(provider.category)} size={30} color={provider.color} />
                        </View>
                      )}
                    </View>
                    <View style={styles.listingBody}>
                      <View style={styles.listingTopRow}>
                        <Text style={styles.listingName} numberOfLines={1}>
                          {provider.name}
                        </Text>
                        <StatusPill category={provider.category} isPositive={provider.isPositiveStatus} compact />
                      </View>

                      <View style={styles.listingServiceRow}>
                        <Text style={styles.listingServiceText} numberOfLines={1}>
                          {getServiceLabel(provider.category)}
                        </Text>
                      </View>

                      <View style={styles.listingMetaRow}>
                        <Ionicons name="star" size={14} color={colors.rating} />
                        <Text style={styles.listingMetaText}>{provider.rating.toFixed(1)}</Text>
                        <Text style={styles.listingMetaTextMuted}>{provider.reviewCount} reviews</Text>
                        <Text style={styles.listingMetaDot}>{"\u2022"}</Text>
                        <Text style={styles.listingMetaText}>{distanceKm.toFixed(1)} km away</Text>
                      </View>

                      <View style={styles.listingBottomRow}>
                        <View style={styles.onsiteBadge}>
                          <Text style={styles.onsiteBadgeText}>{provider.category}</Text>
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
