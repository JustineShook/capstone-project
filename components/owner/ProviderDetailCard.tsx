// components/ProviderDetailCard.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";
import { colors } from "../../constants/owner/theme";
import {
  getCategoryBadge,
  getCategoryIcon,
  getServiceLabel,
  getServicesSectionLabel,
  getVehicleTypeIcon,
  MockProvider,
  supportsBooking,
} from "../../data/owner/mockProviders";
import { getTowingPricing } from "../../services/towingPricingService";
import { getActiveMechanicBooking, subscribeToActiveMechanicBooking } from "../../services/owner/bookingService";
import { getActiveTowingBooking, subscribeToActiveTowingBooking } from "../../services/owner/towingService";
import { getActiveParkingBookingForCustomer, subscribeToParkingListing } from "../../services/parkingBookingService";
import { StatusPill } from "./StatusPill";

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

export function ProviderDetailCard({
  provider,
  distanceKm,
  onClose,
}: {
  provider: MockProvider;
  distanceKm?: number;
  onClose: () => void;
}) {
  const badge = getCategoryBadge(provider.category);
  const [hasActiveMechanicBooking, setHasActiveMechanicBooking] = useState(false);
  const [hasActiveTowingBooking, setHasActiveTowingBooking] = useState(false);
  const hasActiveRequest = hasActiveMechanicBooking || hasActiveTowingBooking;
  const showBookButton = supportsBooking(provider.category)
    && (provider.category === "Onsite Mechanics"
      ? (provider.isPositiveStatus || hasActiveMechanicBooking)
      : provider.category === "Towing"
        ? (provider.isPositiveStatus || hasActiveTowingBooking)
        : provider.isPositiveStatus)
    && (provider.category !== "Auto Shops" || provider.emergencyServiceAvailable === true);
  const [towingBasePrice, setTowingBasePrice] = useState<number | null>(null);
  const [isLoadingTowingPrice, setIsLoadingTowingPrice] = useState(false);
  const [parkingCapacity, setParkingCapacity] = useState<{ totalSlots: number; availableSlots: number } | null>(null);

  useEffect(() => {
    if (provider.category !== "Onsite Mechanics") {
      setHasActiveMechanicBooking(false);
      return;
    }
    return subscribeToActiveMechanicBooking(provider.id, (booking) => setHasActiveMechanicBooking(booking !== null));
  }, [provider.category, provider.id]);

  useEffect(() => {
    if (provider.category !== "Towing") {
      setHasActiveTowingBooking(false);
      return;
    }
    return subscribeToActiveTowingBooking(provider.id, (booking) => setHasActiveTowingBooking(booking !== null));
  }, [provider.category, provider.id]);

  const contactProvider = async (kind: "call" | "message") => {
    if (!provider.isPositiveStatus) {
      Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
      return;
    }
    if (!provider.phone) {
      Alert.alert("Contact unavailable", "This provider has not published a contact number.");
      return;
    }
    const url = `${kind === "call" ? "tel" : "sms"}:${provider.phone.replace(/[^+\d]/g, "")}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("No compatible app is available.");
      await Linking.openURL(url);
    } catch { Alert.alert("Contact unavailable", `Unable to open your ${kind === "call" ? "phone" : "messages"} app.`); }
  };
  const openDirections = async () => {
    if (!Number.isFinite(provider.lat) || !Number.isFinite(provider.lng)) {
      Alert.alert("Location unavailable", "This provider has not shared a map location.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${provider.lat},${provider.lng}&travelmode=driving`;
    try { await Linking.openURL(url); }
    catch { Alert.alert("Navigation unavailable", "Unable to open a maps app on this device."); }
  };
  const openBooking = async () => {
    if (provider.category === "Onsite Mechanics") {
      const existing = await getActiveMechanicBooking(provider.id);
      if (existing) {
        router.push({ pathname: "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: existing.id } });
        return;
      }
      if (!provider.isPositiveStatus) {
        Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
        return;
      }
      router.push({ pathname: "/(v_owner)/mechanic-booking/book-mechanic", params: { providerId: provider.id } });
      return;
    }
    if (provider.category === "Towing") {
      const existing = await getActiveTowingBooking(provider.id);
      if (existing) {
        router.push({ pathname: "/(v_owner)/towing-booking/booking-detail", params: { bookingId: existing.id } });
        return;
      }
      if (!provider.isPositiveStatus) {
        Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
        return;
      }
      router.push({ pathname: "/(v_owner)/towing-booking/book-towing", params: { providerId: provider.id } });
      return;
    }
    if (!provider.isPositiveStatus) {
      Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
      return;
    }
    if (provider.category === "Parking Lots") {
      const existing = await getActiveParkingBookingForCustomer(provider.id);
      router.push({ pathname: existing ? "/(v_owner)/parking-booking/parking-detail" : "/(v_owner)/parking-booking/book-parking", params: existing ? { bookingId: existing.id } : { providerId: provider.id } });
      return;
    }
    router.push({ pathname: provider.category === "Auto Shops" ? "/(v_owner)/shop-booking/book-shop" : provider.category === "Towing" ? "../towing-booking/book-towing" : "../mechanic-booking/book-mechanic", params: { providerId: provider.id } });
  };

  useEffect(() => {
    let active = true;
    if (provider.category !== "Towing") {
      setTowingBasePrice(null);
      setIsLoadingTowingPrice(false);
      return () => { active = false; };
    }

    setIsLoadingTowingPrice(true);
    getTowingPricing(provider.id)
      .then((pricing) => {
        if (active) {
          setTowingBasePrice(pricing && Number.isFinite(pricing.basePrice) ? pricing.basePrice : null);
        }
      })
      .catch(() => {
        if (active) setTowingBasePrice(null);
      })
      .finally(() => {
        if (active) setIsLoadingTowingPrice(false);
      });

    return () => { active = false; };
  }, [provider.category, provider.id]);

  useEffect(() => {
    if (provider.category !== "Parking Lots") { setParkingCapacity(null); return; }
    return subscribeToParkingListing(provider.id, setParkingCapacity);
  }, [provider.category, provider.id]);

  return (
      <View style={styles.card}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header: avatar, name, rating/distance, close button */}
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: provider.color }]}>
            <Text style={styles.avatarText}>{provider.initials}</Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={2}>
              {provider.name}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={13} color={colors.rating} />
              <Text style={styles.metaText}>
                {provider.rating.toFixed(1)} ({provider.reviewCount})
              </Text>
              <Text style={styles.metaDot}>{"\u2022"}</Text>
              <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{distanceKm?.toFixed(1) ?? provider.distanceKm} km</Text>
            </View>
            <StatusPill category={provider.category} isPositive={provider.isPositiveStatus} />
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Category / service delivery type */}
        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Ionicons name={getCategoryIcon(provider.category)} size={13} color={colors.primary} />
            <Text style={styles.tagText}>{getServiceLabel(provider.category)}</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name={badge.icon} size={13} color={colors.primary} />
            <Text style={styles.tagText}>{badge.text}</Text>
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.description}>{provider.description}</Text>

        {(provider.category === "Auto Shops" || provider.category === "Parking Lots") && provider.photoUrls && provider.photoUrls.length > 0 && <>
          <Text style={styles.sectionLabel}>{provider.category === "Parking Lots" ? "Parking Lot Photos" : "Shop Photos"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {provider.photoUrls.map((url) => <Image key={url} source={{ uri: url }} style={styles.shopPhoto} />)}
          </ScrollView>
        </>}

        {/* Services (label adapts for Towing) */}
        <Text style={styles.sectionLabel}>{getServicesSectionLabel(provider.category)}</Text>
        <View style={styles.servicesList}>
          {provider.services.map((service) => (
            <View key={service} style={styles.serviceRow}>
              <View style={styles.serviceBullet} />
              <Text style={styles.serviceText}>{service}</Text>
            </View>
          ))}
        </View>

        {/* Vehicle Types */}
        {provider.vehicleTypes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Vehicle Types</Text>
            <View style={styles.vehicleTypesRow}>
              {provider.vehicleTypes.map((type) => (
                <View key={type} style={styles.vehicleTypePill}>
                  <MaterialCommunityIcons
                    name={getVehicleTypeIcon(type)}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.vehicleTypeText}>{type}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Hours */}
        <Text style={styles.sectionLabel}>Hours</Text>
        {provider.category !== "Parking Lots" && <View style={styles.hoursRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>{provider.hours}</Text>
        </View>}

        <View style={styles.hoursRow}>
          <Ionicons name="flash-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>
            {provider.emergencyServiceAvailable
              ? "Emergency service available"
              : "Emergency service not available"}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            {provider.category === "Towing" ? "Base Price" : "Starting price"}
          </Text>
          <Text style={styles.priceValue}>
            {provider.category === "Towing"
              ? isLoadingTowingPrice
                ? "Loading..."
                : towingBasePrice == null
                  ? "Not configured"
                  : `₱${towingBasePrice.toLocaleString("en-PH")}`
              : `Starts at ${provider.startingPrice}`}
          </Text>
        </View>

        {provider.category === "Parking Lots" && (
          <View style={styles.parkingCapacity}>
            <Ionicons name="car-outline" size={18} color={colors.primary} />
            <Text style={styles.parkingCapacityText}>
              {parkingCapacity
                ? `${parkingCapacity.availableSlots} / ${parkingCapacity.totalSlots} slots available`
                : "Parking capacity not configured"}
            </Text>
          </View>
        )}

        {/* Reviews */}
        <Text style={styles.sectionLabel}>Reviews</Text>
        <View style={styles.reviewsSummaryRow}>
          <Ionicons name="star" size={16} color={colors.rating} />
          <Text style={styles.reviewsSummaryRating}>{provider.rating.toFixed(1)}</Text>
          <Text style={styles.reviewsSummaryCount}>{provider.reviewCount} reviews</Text>
        </View>
        <View style={styles.reviewsList}>
          {provider.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
              <Text style={styles.reviewComment}>&ldquo;{review.comment}&rdquo;</Text>
              <View style={styles.reviewFooterRow}>
                <Text style={styles.reviewAuthor}>{review.customerName}</Text>
                <Text style={styles.metaDot}>{"\u2022"}</Text>
                <Text style={styles.reviewDate}>{review.date}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        {(provider.category === "Auto Shops" || provider.category === "Parking Lots") && (
          <Pressable style={styles.directionsButton} onPress={() => void openDirections()} accessibilityRole="button" accessibilityLabel={`Get directions to ${provider.name}`}>
            <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </Pressable>
        )}
        {provider.isPositiveStatus && provider.phone ? (
          <View style={styles.actionsRow}>
            <Pressable style={styles.callButton} onPress={() => void contactProvider("call")} accessibilityRole="button" accessibilityLabel={`Call ${provider.name}`}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable style={[styles.messageButton, !showBookButton && styles.messageButtonWide]} onPress={() => void contactProvider("message")} accessibilityRole="button">
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </Pressable>
            {showBookButton && (
              <Pressable style={styles.bookButton} onPress={() => void openBooking()} accessibilityRole="button">
              <Text style={styles.bookButtonText}>{hasActiveRequest ? "View Request Status" : provider.category === "Parking Lots" ? "Reserve Parking" : provider.category === "Auto Shops" ? "Request Service" : "Book Service"}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Text style={styles.unavailable}>
            {!provider.isPositiveStatus
              ? hasActiveRequest
                ? "This provider is offline. Your existing request is still active."
                : "Contact and booking are unavailable while this provider is offline."
              : hasActiveRequest
                ? "Contact details are unavailable, but you can still view your request status."
                : "Contact details are not available yet. You can still book a service request."}
          </Text>
        )}
        {showBookButton && (!provider.isPositiveStatus || !provider.phone) && (
          <Pressable style={styles.bookButton} onPress={() => void openBooking()} accessibilityRole="button">
            <Text style={styles.bookButtonText}>{hasActiveRequest ? "View Request Status" : "Book Service"}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 15,
    marginBottom: 20,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 19, letterSpacing: 0.3 },
  headerInfo: { flex: 1, gap: 5 },
  name: { fontSize: 24, lineHeight: 29, fontWeight: "800", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { fontSize: 14, lineHeight: 19, fontWeight: "600", color: colors.textSecondary },
  metaDot: { fontSize: 14, color: colors.textMuted, marginHorizontal: 1 },
  closeButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },

  tagsRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 22,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#1C252E",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tagText: { fontSize: 13, fontWeight: "700", color: colors.primary },

  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    marginBottom: 22,
  },
  photoRow: { gap: 12, marginBottom: 22 },
  shopPhoto: { width: 240, height: 156, borderRadius: 16, backgroundColor: colors.surfaceAlt },

  servicesList: { marginBottom: 22, gap: 10, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 15 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 24 },
  serviceBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  serviceText: { fontSize: 15, lineHeight: 21, fontWeight: "500", color: colors.textPrimary, flex: 1 },

  vehicleTypesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 22,
  },
  vehicleTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1C252E",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  vehicleTypeText: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },

  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  hoursText: { fontSize: 15, lineHeight: 21, color: colors.textPrimary, fontWeight: "500" },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 16,
    marginBottom: 19,
  },
  priceLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  priceValue: { fontSize: 19, lineHeight: 25, fontWeight: "800", color: colors.textPrimary, marginTop: 3 },
  parkingCapacity: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: -7, marginBottom: 20 },
  parkingCapacityText: { fontSize: 15, lineHeight: 21, fontWeight: "700", color: colors.textPrimary },

  reviewsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  reviewsSummaryRating: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  reviewsSummaryCount: { fontSize: 14, color: colors.textSecondary },

  reviewsList: { gap: 12, marginBottom: 22 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 15,
    gap: 7,
  },
  reviewStars: { fontSize: 15, color: colors.rating, letterSpacing: 1 },
  reviewComment: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  reviewFooterRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  reviewAuthor: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  reviewDate: { fontSize: 13, color: colors.textSecondary },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  unavailable: { color: colors.textSecondary, textAlign: "center", fontSize: 14, lineHeight: 21, paddingVertical: 17, paddingHorizontal: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15 },
  directionsButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  directionsButtonText: { fontSize: 16, fontWeight: "800", color: colors.primary },
  callButton: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  messageButtonWide: {
    flex: 2.4,
  },
  messageButtonText: { fontSize: 15, fontWeight: "800", color: colors.primary },
  bookButton: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  bookButtonText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
