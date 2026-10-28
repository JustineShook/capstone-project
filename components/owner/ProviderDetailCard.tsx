// components/ProviderDetailCard.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
import { auth } from "../../services/firebase";
import { getActiveMechanicBooking, subscribeToActiveMechanicBooking } from "../../services/owner/bookingService";
import { getActiveTowingBooking, subscribeToActiveTowingBooking } from "../../services/owner/towingService";
import { requireVerifiedOwner } from "../../services/ownerVerificationProfileService";
import { getActiveHomeGarageBooking, subscribeToActiveHomeGarageBooking } from "../../services/homeGarageBookingService";
import { getActiveShopBooking } from "../../services/shopOwnerService";
import { getTowingPricing } from "../../services/towingPricingService";
import { StatusPill } from "./StatusPill";
import { OpenGoogleMapsModal } from "./OpenGoogleMapsModal";

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

async function canBookAsOwner(onVerificationRequired: () => void): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    Alert.alert("Sign in required", "Please sign in before booking a service.");
    return false;
  }
  try {
    await requireVerifiedOwner(uid);
    return true;
  } catch (error) {
    const verificationRequired = error instanceof Error
      && error.message === "Complete owner verification and wait for approval before booking a service.";
    if (verificationRequired) {
      onVerificationRequired();
      return false;
    }
    Alert.alert(
      "Unable to check verification",
      error instanceof Error ? error.message : "Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

export function ProviderDetailCard({
  provider,
  distanceKm,
  timingMode = "now",
  onClose,
}: {
  provider: MockProvider;
  distanceKm?: number;
  timingMode?: "now" | "scheduled";
  onClose: () => void;
}) {
  const badge = getCategoryBadge(provider.category);
  const [hasActiveMechanicBooking, setHasActiveMechanicBooking] = useState(false);
  const [hasActiveTowingBooking, setHasActiveTowingBooking] = useState(false);
  const [hasActiveHomeGarageBooking, setHasActiveHomeGarageBooking] = useState(false);
  const hasActiveRequest = hasActiveMechanicBooking || hasActiveTowingBooking || hasActiveHomeGarageBooking;
  const eligibleForTiming = timingMode === "scheduled"
    ? provider.acceptsScheduledBookings === true
    : provider.isPositiveStatus
      && (provider.category !== "Onsite Mechanics" || provider.emergencyServiceAvailable === true);
  const mechanicHasBookingOption = provider.category === "Onsite Mechanics"
    && (provider.emergencyServiceAvailable === true || provider.acceptsScheduledBookings === true);
  const canOpenMechanicBooking = timingMode === "scheduled"
    ? provider.acceptsScheduledBookings === true
    : provider.isPositiveStatus && mechanicHasBookingOption;
  const showBookButton = supportsBooking(provider.category)
    && (provider.category === "Onsite Mechanics"
      ? (canOpenMechanicBooking || hasActiveMechanicBooking)
      : provider.category === "Towing"
        ? (eligibleForTiming || hasActiveTowingBooking)
        : provider.category === "Parking Lots"
          ? (eligibleForTiming || hasActiveHomeGarageBooking)
        : eligibleForTiming);
  const [towingBasePrice, setTowingBasePrice] = useState<number | null>(null);
  const [isLoadingTowingPrice, setIsLoadingTowingPrice] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false);

  const checkBookingAccess = () => canBookAsOwner(() => setShowVerificationPrompt(true));

  useEffect(() => {
    if (provider.category !== "Onsite Mechanics") {
      setHasActiveMechanicBooking(false);
      return;
    }
    return subscribeToActiveMechanicBooking(provider.id, (booking) => setHasActiveMechanicBooking(booking !== null));
  }, [provider.category, provider.id]);

  useEffect(() => {
    if (provider.category !== "Parking Lots") {
      setHasActiveHomeGarageBooking(false);
      return;
    }
    return subscribeToActiveHomeGarageBooking(provider.id, (booking) => setHasActiveHomeGarageBooking(booking !== null));
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
    const phoneNumber = provider.phone.trim().replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    if (phoneNumber.replace(/\D/g, "").length < 7) {
      Alert.alert("Contact unavailable", "This provider has not published a contact number.");
      return;
    }
    const url = `${kind === "call" ? "tel" : "sms"}:${phoneNumber}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn(`Unable to open ${kind === "call" ? "dialer" : "messages"} for provider`, error);
      Alert.alert("Contact unavailable", `Unable to open the ${kind === "call" ? "phone dialer" : "messages app"}. You can call ${provider.phone} directly.`);
    }
  };
  const openDirections = async () => {
    if (!Number.isFinite(provider.lat) || !Number.isFinite(provider.lng)) {
      Alert.alert("Location unavailable", "This provider has not shared a map location.");
      return;
    }
    setShowMapsConfirmation(true);
  };
  const openBooking = async () => {
    if (provider.category === "Onsite Mechanics") {
      const existing = await getActiveMechanicBooking(provider.id);
      if (existing) {
        router.push({ pathname: "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: existing.id } });
        return;
      }
      if (!canOpenMechanicBooking) {
        Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
        return;
      }
      if (!(await checkBookingAccess())) return;
      router.push({ pathname: "/(v_owner)/mechanic-booking/book-mechanic", params: { providerId: provider.id, initialTimingMode: timingMode } });
      return;
    }
    if (provider.category === "Towing") {
      const existing = await getActiveTowingBooking(provider.id);
      if (existing) {
        router.push({ pathname: "/(v_owner)/towing-booking/booking-detail", params: { bookingId: existing.id } });
        return;
      }
      if (!eligibleForTiming) {
        Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
        return;
      }
      if (!(await checkBookingAccess())) return;
      router.push({ pathname: "/(v_owner)/towing-booking/book-towing", params: { providerId: provider.id, initialTimingMode: timingMode } });
      return;
    }
    if (provider.category === "Auto Shops") {
      const existing = await getActiveShopBooking(provider.id);
      if (existing) {
        router.push({ pathname: "/(v_owner)/shop-booking/booking-detail", params: { bookingId: existing.id } });
        return;
      }
      if (!eligibleForTiming) {
        Alert.alert("Shop unavailable", "This shop is closed or unavailable right now.");
        return;
      }
      if (!(await checkBookingAccess())) return;
      router.push({ pathname: "/(v_owner)/shop-booking/book-shop", params: { providerId: provider.id, initialTimingMode: timingMode } });
      return;
    }
    if (provider.category === "Parking Lots") {
      const existing = await getActiveHomeGarageBooking(provider.id);
      if (!existing && !eligibleForTiming) {
        Alert.alert("Home Garage unavailable", "This Home Garage is offline or unavailable right now.");
        return;
      }
      if (!existing && !(await checkBookingAccess())) return;
      router.push({ pathname: existing ? "/(v_owner)/homegarage-booking/booking-detail" : "/(v_owner)/homegarage-booking/book-homegarage", params: existing ? { bookingId: existing.id } : { providerId: provider.id, initialTimingMode: timingMode } });
      return;
    }
    if (!eligibleForTiming) {
      Alert.alert("Provider unavailable", "This provider is offline or unavailable right now.");
      return;
    }
    if (!(await checkBookingAccess())) return;
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

  return (
      <View style={styles.card}>
      {/* Keep provider identity visible while the details below scroll. */}
      <View style={styles.fixedHeader}>
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

          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close provider details">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
          <Text style={styles.sectionLabel}>{provider.category === "Parking Lots" ? "Home Garage Photos" : "Shop Photos"}</Text>
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
            <Text style={styles.sectionLabel}>Vehicles Served</Text>
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
        <View style={styles.hoursRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>{provider.hours}</Text>
        </View>

        <View style={styles.hoursRow}>
          <Ionicons name="flash-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>
            {provider.category === "Parking Lots"
              ? provider.emergencyServiceAvailable ? "Emergency repair service available at this garage" : "Emergency repair service not available"
              : provider.emergencyServiceAvailable ? "Emergency service available" : "Emergency service not available"}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            {provider.category === "Towing" ? "Base Price" : "Starting price"}
          </Text>
          <Text style={[
            styles.priceValue,
            provider.startingPrice === "Contact for price" && styles.priceValueContact,
          ]}>
            {provider.category === "Towing"
              ? isLoadingTowingPrice
                ? "Loading..."
                : towingBasePrice == null
                  ? "Not configured"
                  : `₱${towingBasePrice.toLocaleString("en-PH")}`
              : `Starts at ${provider.startingPrice}`}
          </Text>
        </View>

        {/* Reviews */}
        <Text style={styles.sectionLabel}>Reviews</Text>
        <View style={styles.reviewsSummaryRow}>
          <Ionicons name="star" size={16} color={colors.rating} />
          <Text style={styles.reviewsSummaryRating}>{provider.rating.toFixed(1)}</Text>
          <Text style={styles.reviewsSummaryCount}>{provider.reviewCount} reviews</Text>
        </View>
        <View style={styles.reviewsList}>
          {provider.reviews.slice(0, 2).map((review) => (
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
        {provider.reviews.length > 2 && (
          <Pressable
            style={styles.seeMoreReviews}
            accessibilityRole="button"
            onPress={() => router.push({
              pathname: "/(v_owner)/provider-reviews",
              params: { providerId: provider.id, providerName: provider.name, rating: String(provider.rating), reviewCount: String(provider.reviewCount) },
            })}
          >
            <Text style={styles.seeMoreReviewsText}>See more reviews</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
        )}

      </ScrollView>

      {/* Keep directions and contact/booking actions reachable while details scroll. */}
      <View style={styles.fixedActions}>
        {provider.category === "Onsite Mechanics" && !mechanicHasBookingOption && !hasActiveMechanicBooking && (
          <Text style={styles.unavailable}>Unavailable for new bookings: Emergency is off and Schedule is disabled.</Text>
        )}
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
                <Text style={styles.bookButtonText}>{hasActiveRequest ? "View Request Status" : provider.category === "Parking Lots" ? "Book Service" : provider.category === "Auto Shops" ? "Request Service" : provider.category === "Onsite Mechanics" && timingMode === "now" ? "Booking" : "Book Service"}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.unavailable}>
              {!provider.isPositiveStatus
                ? hasActiveRequest
                  ? "This provider is offline. Your existing request is still active."
                  : "Contact and booking are unavailable while this provider is offline."
                : hasActiveRequest
                  ? "Contact details are unavailable, but you can still view your request status."
                  : "Contact details are not available yet. You can still book a service request."}
            </Text>
            {showBookButton && (
              <Pressable style={styles.bookButton} onPress={() => void openBooking()} accessibilityRole="button">
                <Text style={styles.bookButtonText}>{hasActiveRequest ? "View Request Status" : provider.category === "Parking Lots" ? "Book Service" : provider.category === "Auto Shops" ? "Request Service" : provider.category === "Onsite Mechanics" && timingMode === "now" ? "Booking" : "Book Service"}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
      <OpenGoogleMapsModal
        visible={showMapsConfirmation}
        url={`https://www.google.com/maps/dir/?api=1&destination=${provider.lat},${provider.lng}&travelmode=driving`}
        onCancel={() => setShowMapsConfirmation(false)}
      />
      <Modal
        visible={showVerificationPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerificationPrompt(false)}
      >
        <View style={styles.verificationBackdrop}>
          <View style={styles.verificationModal}>
            <View style={styles.verificationHero}>
              <View style={styles.verificationIconWrap}>
                <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
              </View>
              <View style={styles.verificationBadge}>
                <Ionicons name="lock-closed" size={11} color={colors.primary} />
                <Text style={styles.verificationBadgeText}>ACCOUNT SECURITY</Text>
              </View>
            </View>
            <Text style={styles.verificationTitle}>Owner verification required</Text>
            <Text style={styles.verificationDescription}>
              {provider.category === "Auto Shops"
                ? "Complete vehicle owner verification before opening this shop or sending a service request."
                : "Verify your identity to book services and help keep every request trusted and secure."}
            </Text>
            <Pressable
              style={styles.verificationSteps}
              onPress={() => {
                setShowVerificationPrompt(false);
                router.push("/(v_owner)/verification");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open vehicle owner verification"
            >
              <View style={styles.verificationStepIcon}>
                <Ionicons name="id-card-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.verificationStepCopy}>
                <Text style={styles.verificationStepTitle}>Complete your owner profile</Text>
                <Text style={styles.verificationStepText}>Submit your details and ID for review.</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={styles.verificationPrimaryButton}
              onPress={() => {
                setShowVerificationPrompt(false);
                router.push("/(v_owner)/verification");
              }}
              accessibilityRole="button"
            >
              <Text style={styles.verificationPrimaryText}>Go to verification</Text>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.verificationDismissButton}
              onPress={() => setShowVerificationPrompt(false)}
              accessibilityRole="button"
            >
              <Text style={styles.verificationDismissText}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fixedHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
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
  priceValueContact: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: colors.textSecondary },

  reviewsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  reviewsSummaryRating: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  reviewsSummaryCount: { fontSize: 14, color: colors.textSecondary },

  reviewsList: { gap: 12, marginBottom: 22 },
  seeMoreReviews: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, marginTop: -14, marginBottom: 14 },
  seeMoreReviewsText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
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
    marginTop: 0,
  },
  fixedActions: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  unavailable: { color: colors.textSecondary, textAlign: "center", fontSize: 14, lineHeight: 21, paddingVertical: 17, paddingHorizontal: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15 },
  verificationBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
    backgroundColor: "rgba(4,8,12,0.78)",
  },
  verificationModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 26,
    padding: 24,
    overflow: "hidden",
  },
  verificationHero: {
    minHeight: 118,
    marginBottom: 20,
    borderRadius: 19,
    backgroundColor: "#25191E",
    borderWidth: 1,
    borderColor: "#48232B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  verificationIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B2027",
    borderWidth: 1,
    borderColor: "#63313C",
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#351D24",
    borderWidth: 1,
    borderColor: "#63313C",
  },
  verificationBadgeText: { color: "#F7A4AE", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  verificationTitle: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  verificationDescription: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 9, marginBottom: 20 },
  verificationSteps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 20,
  },
  verificationStepIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#352127" },
  verificationStepCopy: { flex: 1, gap: 3 },
  verificationStepTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  verificationStepText: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  verificationPrimaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: colors.primary,
    borderRadius: 15,
  },
  verificationPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  verificationDismissButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 5 },
  verificationDismissText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
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
    flex: 1.7,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  bookButtonText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF", textAlign: "center", lineHeight: 18, flexShrink: 1 },
});
