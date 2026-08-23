// app/(owner)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
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

import { ProviderDetailCard } from "../../components/ProviderDetailCard";
import { StatusPill } from "../../components/StatusPill";
import { nearestSnapPoint, SHEET_COLLAPSED, SHEET_EXPANDED, SHEET_MID } from "../../constants/bottomSheet";
import { colors } from "../../constants/theme";
import {
  CATEGORIES,
  getCategoryBadge,
  getCategoryIcon,
  getServiceLabel,
  MOCK_CENTER,
  MOCK_LOCATION_LABEL,
  MOCK_PROVIDERS,
  ProviderCategory,
} from "../../data/mockProviders";
import { buildMapHtml } from "../../utils/buildMapHtml";
import { styles } from "./index.styles";

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------
export default function OwnerDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>("All");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const filteredProviders =
    selectedCategory === "All"
      ? MOCK_PROVIDERS
      : MOCK_PROVIDERS.filter((p) => p.category === selectedCategory);

  const selectedProvider = MOCK_PROVIDERS.find((p) => p.id === selectedProviderId) ?? null;

  const mapHtml = useMemo(
    () => buildMapHtml(MOCK_CENTER, filteredProviders, colors.primary),
    [filteredProviders]
  );

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

      {/* Recenter button — floats over the map, tracks the sheet as it's dragged */}
      <Animated.View style={[styles.recenterButtonWrap, { bottom: floatingBottom }]}>
        <Pressable style={styles.recenterButton}>
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
                return (
                  <Pressable
                    key={provider.id}
                    style={[styles.listingCard, isSelected && styles.listingCardSelected]}
                    onPress={() => selectProvider(provider.id)}
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
                        <Text style={styles.listingMetaText}>{provider.distanceKm} km</Text>
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