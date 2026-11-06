// app/(owner)/towing-booking/booking-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { homeColors as colors } from "../../../constants/owner/homeTheme";
import { CancelRequestModal } from "../../../components/owner/CancelRequestModal";
import { ReportProblemAction } from "../../../components/owner/ReportProblemModal";
import { ServiceProgress } from "../../../components/owner/ServiceProgress";
import { BookingDetailsModal } from "../../../components/owner/BookingDetailsModal";
import { LiveProviderMap } from "../../../components/owner/LiveProviderMap";
import { BookingTimingBanner } from "../../../components/owner/BookingTimingBanner";
import { formatPesoAmount } from "../../../utils/finalPrice";
import { getServiceLabel } from "../../../data/owner/mockProviders";
import { getPublicProviderListing } from "../../../services/publicProviderListingService";
import { getProviderContactPhone } from "../../../services/providerContactService";
import { getProviderReviewSummary, getRating, mergeRating, submitRating } from "../../../services/owner/ratingService";
import { cancelTowingBookingAsCustomer, subscribeToTowingBooking } from "../../../services/owner/towingService";
import {
  getTowingStatusLabel,
  getTowingStatusShortLabel,
  TOWING_STATUS_FLOW,
  TowingBookingRequest,
} from "../../../types/owner/towing";

// How long the "Thank you!" confirmation stays on screen before we
// navigate back to the owner dashboard.
const THANK_YOU_DELAY_MS = 1750;

function formatRequestDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

export default function TowingBookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const headerHeight = insets.top + 52;
  const [sheetHeight, setSheetHeight] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [statusCardHeight, setStatusCardHeight] = useState(180);
  const sheetScrollRef = useRef<ScrollView>(null);
  useEffect(() => { if (isSheetCollapsed) sheetScrollRef.current?.scrollTo({ y: 0, animated: false }); }, [isSheetCollapsed]);
  const animatedSheetHeight = useRef(new Animated.Value(screenHeight * 0.56)).current;
  const currentSheetHeight = useRef(screenHeight * 0.56);
  const dragStartHeight = useRef(screenHeight * 0.56);
  const collapsedTarget = useRef(false);
  useEffect(() => {
    const listener = animatedSheetHeight.addListener(({ value }) => { currentSheetHeight.current = value; });
    return () => { animatedSheetHeight.removeListener(listener); animatedSheetHeight.stopAnimation(); };
  }, [animatedSheetHeight]);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const returnToHistory = useCallback(() => router.replace("/(v_owner)/history"), []);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      returnToHistory();
      return true;
    });
    return () => subscription.remove();
  }, [returnToHistory]));
  const [booking, setBooking] = useState<TowingBookingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providerPhone, setProviderPhone] = useState("");
  const [providerRating, setProviderRating] = useState({ average: 0, count: 0 });
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // --- Rating state --------------------------------------------------------
  const [selectedStars, setSelectedStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  useEffect(() => {
    if (!bookingId) { setBooking(null); setIsLoading(false); return; }
    return subscribeToTowingBooking(bookingId, (result) => {
      void getRating(bookingId).then((rating) => {
        setBooking(result ? mergeRating(result, rating) : null);
        setIsLoading(false);
      });
    });
  }, [bookingId]);

  useEffect(() => {
    if (!booking?.providerId) {
      setProviderPhone("");
      return;
    }
    let isCurrent = true;
    void getPublicProviderListing(booking.providerId)
      .then(async (listing) => {
        let phone = listing?.contactPhone?.trim() ?? "";
        try { phone = await getProviderContactPhone(booking.providerId) || phone; } catch { /* Legacy fallback during migration. */ }
        if (isCurrent) setProviderPhone(phone);
      })
      .catch(() => {
        if (isCurrent) setProviderPhone("");
      });
    return () => { isCurrent = false; };
  }, [booking?.providerId]);

  useEffect(() => {
    if (!booking?.providerId) return;
    void getProviderReviewSummary(booking.providerId).then(({ average, count }) => setProviderRating({ average, count }));
  }, [booking?.providerId]);

  const provider = booking ? { name: booking.providerName, initials: booking.providerName.slice(0, 2).toUpperCase(), color: colors.primary, phone: booking.dispatcherPhone?.trim() || providerPhone, rating: providerRating.average, reviewCount: providerRating.count, distanceKm: 0, category: "Towing" as const } : undefined;
  const vehicle = booking ? { year: booking.vehicleYear, make: booking.vehicle, model: "", vehicleType: "" } : undefined;
  const currentStepIndex = booking ? TOWING_STATUS_FLOW.indexOf(booking.status) : -1;
  const isTerminalStatus = booking?.status === "cancelled" || booking?.status === "rejected";
  const canCustomerCancel = booking?.status === "pending" || booking?.status === "accepted";
  const collapsedHeight = Math.min(statusCardHeight + 65 + insets.bottom, screenHeight - headerHeight - 16);
  const expandedHeight = Math.max(collapsedHeight, Math.max(120, Math.min(!isTerminalStatus && booking?.status !== "completed" ? Math.min(screenHeight * 0.56, screenHeight - headerHeight - 112) : screenHeight, screenHeight - headerHeight - 16)));
  const snapSheet = useCallback((collapse: boolean) => {
    collapsedTarget.current = collapse;
    if (!collapse) setIsSheetCollapsed(false);
    const target = collapse ? collapsedHeight : expandedHeight;
    animatedSheetHeight.stopAnimation();
    Animated.spring(animatedSheetHeight, { toValue: target, useNativeDriver: false, bounciness: 4 }).start(({ finished }) => {
      if (finished) { setIsSheetCollapsed(collapse); setSheetHeight(target); }
    });
  }, [animatedSheetHeight, collapsedHeight, expandedHeight]);
  useEffect(() => { snapSheet(collapsedTarget.current); }, [snapSheet]);
  const sheetGesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      animatedSheetHeight.stopAnimation();
      dragStartHeight.current = currentSheetHeight.current;
      setIsSheetCollapsed(false);
      sheetScrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    onPanResponderMove: (_, gesture) => {
      animatedSheetHeight.setValue(Math.min(expandedHeight, Math.max(collapsedHeight, dragStartHeight.current - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const height = dragStartHeight.current - gesture.dy;
      snapSheet(gesture.vy > 0.4 || (gesture.vy >= -0.4 && height < (collapsedHeight + expandedHeight) / 2));
    },
    onPanResponderTerminate: () => snapSheet(collapsedTarget.current),
  }), [animatedSheetHeight, collapsedHeight, expandedHeight, snapSheet]);


  const confirmCancelBooking = () => {
    if (!booking || !canCustomerCancel || isCancelling) return;
    setShowCancelConfirmation(true);
  };

  const cancelBooking = async () => {
    if (!booking || !canCustomerCancel || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelTowingBookingAsCustomer(booking.id, cancelReason);
      setCancelReason("");
      setShowCancelConfirmation(false);
    } catch (error) {
      setShowCancelConfirmation(false);
      Alert.alert("Could not cancel", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  // --- Call / Message the provider -----------------------------------------
  // Assumes `provider.phone` exists on the Provider type — swap the field
  // name below if mockProviders uses something different.
  const handleCallProvider = async () => {
    if (!provider?.phone) {
      Alert.alert("Phone number unavailable", "This towing provider has not added a contact number.");
      return;
    }
    try {
      await Linking.openURL(`tel:${provider.phone}`);
    } catch {
      Alert.alert("Unable to call", "This device could not open the phone app.");
    }
  };

  const handleMessageProvider = async () => {
    if (!provider?.phone) {
      Alert.alert("Phone number unavailable", "This towing provider has not added a contact number.");
      return;
    }
    try {
      await Linking.openURL(`sms:${provider.phone}`);
    } catch {
      Alert.alert("Unable to message", "This device could not open the messaging app.");
    }
  };

  // Tapping a star just selects it — submission is a separate, explicit
  // step via the Submit Rating button, so the owner has a chance to add a
  // comment first.
  const handleSelectStar = (star: number) => {
    if (booking?.rating || isSubmittingRating) return;
    setSelectedStars(star);
  };

  const handleSubmitRating = async () => {
    if (!booking || selectedStars === 0 || isSubmittingRating) return;
    setIsSubmittingRating(true);
    try {
      const rating = await submitRating(booking.id, "towing", selectedStars, comment);
      setBooking(mergeRating(booking, rating));
      const summary = await getProviderReviewSummary(booking.providerId);
      setProviderRating({ average: summary.average, count: summary.count });
      setShowThankYou(true);
      setTimeout(() => {
        router.replace("/(v_owner)");
      }, THANK_YOU_DELAY_MS);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <View style={styles.root}>
            {booking && !isTerminalStatus && booking.status !== "completed" && <LiveProviderMap fullScreen overlayInsets={{ top: headerHeight, bottom: sheetHeight }} customerLatitude={booking.status === "in_progress" ? booking.destinationLatitude : booking.latitude} customerLongitude={booking.status === "in_progress" ? booking.destinationLongitude : booking.longitude} providerLatitude={booking.liveProviderLatitude} providerLongitude={booking.liveProviderLongitude} providerName="tow truck" updatedAt={booking.providerLocationUpdatedAt} />}
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />
      <Pressable onPress={returnToHistory} accessibilityRole="button" accessibilityLabel="Back to history" hitSlop={8} style={[styles.floatingBack, { top: insets.top + 8 }]}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>

      {isLoading ? (
        <View style={styles.loadingRoot}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !booking ? (
        <View style={styles.loadingRoot}>
          <Text style={styles.notFoundText}>This request could not be found.</Text>
        </View>
      ) : (
        <Animated.View style={[styles.contentSurfaceHost, { height: animatedSheetHeight, paddingBottom: insets.bottom }]}>
          <View {...sheetGesture.panHandlers}>
            <Pressable accessibilityRole="button" accessibilityLabel={isSheetCollapsed ? "Expand request card" : "Collapse request card"} accessibilityState={{ expanded: !isSheetCollapsed }} onPress={() => snapSheet(!collapsedTarget.current)} style={styles.sheetHandleTouch}>
              <View style={styles.sheetHandle} />
            </Pressable>
          </View>
          <ScrollView ref={sheetScrollRef} scrollEnabled={!isSheetCollapsed} style={styles.contentSurface} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!isSheetCollapsed && provider && !["completed", "cancelled"].includes(booking.status) && (
              <View style={styles.providerCard}>
                <View style={[styles.avatar, { backgroundColor: provider.color }]}>
                  <Text style={styles.avatarText}>{provider.initials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
                  <Text style={styles.problemText} numberOfLines={1} ellipsizeMode="tail">
                    {booking.pickupLocation} → {booking.destination}
                  </Text>
                </View>
                {!["completed", "cancelled"].includes(booking.status) && <View style={styles.providerActionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    accessibilityRole="button" accessibilityLabel="Call provider" onPress={handleCallProvider}
                    hitSlop={6}
                  >
                    <Ionicons name="call-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    accessibilityRole="button" accessibilityLabel="SMS provider" onPress={handleMessageProvider}
                    hitSlop={6}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                  </Pressable>
                </View>}
              </View>
            )}
            <View onLayout={event => setStatusCardHeight(event.nativeEvent.layout.height)} style={styles.statusCard}>
              <Text style={styles.statusEyebrow}>REQUEST STATUS</Text>
              <Text style={styles.statusTitle}>{getTowingStatusLabel(booking.status)}</Text>
              {!["completed", "cancelled"].includes(booking.status) && <ServiceProgress homeAppearance
                steps={TOWING_STATUS_FLOW.map((status) => ({ key: status, label: getTowingStatusShortLabel(status) }))}
                currentStep={currentStepIndex}
                terminalLabel={isTerminalStatus ? getTowingStatusLabel(booking.status) : undefined}
              />}
            </View>
            <View style={isSheetCollapsed ? styles.hiddenContent : undefined}>



            {!canCustomerCancel && ["en_route", "arrived", "in_progress"].includes(booking.status) && <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>The tow truck is on the way or service has started. Contact the provider to request cancellation.</Text>}


            <ReportProblemAction homeAppearance booking={booking} />
            {booking.status === "completed" && <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>Service completed</Text>
              <Text style={styles.completionPrice}>{typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded"}</Text>
              {booking.completionNote?.trim() ? <Text style={styles.problemText}>Service Completion Notes: {booking.completionNote}</Text> : null}
            </View>}
            {booking.status === "completed" && provider && (
              <View style={styles.ratingCard}>
                {booking.rating ? (
                  <>
                    <Text style={styles.ratingCardTitle}>Thank you for your feedback!</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= booking.rating! ? "star" : "star-outline"}
                          size={32}
                          color={star <= booking.rating! ? colors.rating : colors.textMuted}
                          style={styles.starIcon}
                        />
                      ))}
                    </View>
                    {booking.comment ? (
                      <Text style={styles.submittedCommentText}>“{booking.comment}”</Text>
                    ) : null}
                  </>
                ) : showThankYou ? (
                  <>
                    <Text style={styles.ratingCardTitle}>Thank you!</Text>
                    <Text style={styles.ratingCardSubtitle}>
                      Thanks for rating {provider.name}. Your feedback helps improve VeResc.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.ratingCardTitle}>Rate this Provider</Text>
                    <Text style={styles.ratingCardSubtitle}>
                      How was your experience with {provider.name}?
                    </Text>

                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = star <= selectedStars;
                        return (
                          <Pressable
                            key={star}
                            onPress={() => handleSelectStar(star)}
                            disabled={isSubmittingRating}
                            hitSlop={6}
                          >
                            <Ionicons
                              name={filled ? "star" : "star-outline"}
                              size={32}
                              color={filled ? colors.rating : colors.textMuted}
                              style={styles.starIcon}
                            />
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.commentInput}
                      placeholder="Write a comment about your experience..."
                      placeholderTextColor={colors.textMuted}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      numberOfLines={4}
                      editable={!isSubmittingRating}
                    />

                    <Pressable
                      style={[
                        styles.submitButton,
                        (selectedStars === 0 || isSubmittingRating) && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmitRating}
                      disabled={selectedStars === 0 || isSubmittingRating}
                    >
                      {isSubmittingRating ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.submitButtonText}>Submit Rating</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}


            </View>
          </ScrollView>
          <View style={[styles.quickActions, isSheetCollapsed && styles.hiddenContent]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open booking details" onPress={() => setShowBookingDetails(true)} style={styles.detailsButton}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.detailsButtonText}>Booking Details</Text>
            </Pressable>

            {canCustomerCancel && (
              <Pressable
                style={[styles.cancelRequestButton, isCancelling && styles.cancelRequestButtonDisabled]}
                onPress={confirmCancelBooking}
                disabled={isCancelling}
                accessibilityRole="button"
                accessibilityLabel="Cancel towing request"
              >
                {isCancelling ? <ActivityIndicator color={colors.white} /> : <Text style={styles.cancelRequestButtonText}>Cancel Request</Text>}
              </Pressable>
            )}
          </View>
          <BookingDetailsModal visible={showBookingDetails} onClose={() => setShowBookingDetails(false)}>
            <BookingTimingBanner homeAppearance booking={booking} />
            {booking.declineReason ? <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Reason from towing company: {booking.declineReason}</Text> : null}
            {booking.cancellationReason ? <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Your cancellation reason: {booking.cancellationReason}</Text> : null}
            {provider && (
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Provider Details</Text>

                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Provider</Text>
                  <Text style={styles.detailValue}>{provider.name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="star-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Rating</Text>
                  <Text style={styles.detailValue}>
                    {provider.rating.toFixed(1)} ({provider.reviewCount})
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Distance</Text>
                  <Text style={styles.detailValue}>{provider.distanceKm.toFixed(1)} km</Text>
                </View>

                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Ionicons name="construct-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>{getServiceLabel(provider.category)}</Text>
                </View>
              </View>
            )}

            {vehicle && (
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Vehicle Details</Text>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Year</Text>
                  <Text style={styles.detailValue}>{vehicle.year}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Make</Text>
                  <Text style={styles.detailValue}>{vehicle.make}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Model</Text>
                  <Text style={styles.detailValue}>{vehicle.model}</Text>
                </View>

                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Ionicons name="apps-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{vehicle.vehicleType}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>Towing Request</Text>

              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.detailValue}>{booking.pickupLocation}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="flag-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Destination</Text>
                <Text style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">{booking.destination}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="car-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Towing Type</Text>
                <Text style={styles.detailValue}>{booking.towingType}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Condition</Text>
                <Text style={styles.detailValue}>{booking.vehicleCondition}</Text>
              </View>

              {booking.notes ? (
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{booking.notes}</Text>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Estimated Price</Text>
                <Text style={styles.detailValue}>₱{(booking.estimatedTotalPrice ?? booking.estimatedPrice ?? 0).toLocaleString("en-PH")}</Text>
              </View>
              {booking.status === "completed" && <View style={[styles.detailRow, styles.detailRowLast]}>
                <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Final Price</Text>
                <Text style={styles.detailValue}>{typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded"}</Text>
                {booking.completionNote?.trim() ? <Text style={styles.detailValue}>Service Completion Notes: {booking.completionNote}</Text> : null}
              </View>}
              {typeof booking.basePrice === "number" && <>
                <View style={styles.detailRow}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Base Fee</Text>
                  <Text style={styles.detailValue}>₱{booking.basePrice.toLocaleString("en-PH")}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Rate</Text>
                  <Text style={styles.detailValue}>₱{booking.pricePerKm.toLocaleString("en-PH")}/km</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calculator-outline" size={16} color={colors.primary} />
                  <Text style={styles.detailLabel}>Distance Charge</Text>
                  <Text style={styles.detailValue}>₱{booking.distanceCharge.toLocaleString("en-PH")}</Text>
                </View>
              </>}
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Ionicons name="map-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Estimated Trip</Text>
                <Text style={styles.detailValue}>{booking.totalDistanceKm.toFixed(1)} km</Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>Booking Information</Text>

              <View style={styles.detailRow}>
                <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>{booking.id}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Requested</Text>
                <Text style={styles.detailValue}>{formatRequestDateTime(booking.createdAt)}</Text>
              </View>

              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Ionicons name="ellipse-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{getTowingStatusLabel(booking.status)}</Text>
              </View>
            </View>

          </BookingDetailsModal>
        </Animated.View>
      )}
      <CancelRequestModal homeAppearance
        visible={showCancelConfirmation}
        serviceName="Towing"
        explanation="You can cancel while the tow truck has not started traveling to your pickup location."
        isCancelling={isCancelling}
        onKeep={() => setShowCancelConfirmation(false)}
        onConfirm={() => void cancelBooking()}
        reason={cancelReason}
        onReasonChange={setCancelReason}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  floatingBack: { position: "absolute", left: 16, zIndex: 3, width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", elevation: 3 },
  statusCard: { backgroundColor: colors.surface, paddingVertical: 7, marginBottom: 0, gap: 8 },
  statusEyebrow: { color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.4 },
  statusTitle: { color: colors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: "700" },
  quickActions: { padding: 12, gap: 10, flexDirection: "row", alignItems: "stretch", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  detailsButton: { flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  detailsButtonText: { color: colors.primary, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  contactLabel: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  completionPrice: { color: colors.textPrimary, fontSize: 22, lineHeight: 29, fontWeight: "700" },
  root: { flex: 1, backgroundColor: colors.background },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: colors.textPrimary, lineHeight: 30, minWidth: 0, flexShrink: 1},
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  notFoundText: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: "center", fontWeight: "400"},

  // Fixed (non-scrolling) section: provider card + status.
  contentSurfaceHost: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
  contentSurface: { flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  fixedTop: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 16,
  },

  hiddenContent: { display: "none" },
  sheetHandleTouch: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },

  providerCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  avatarText: { color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
  providerName: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: colors.textPrimary , minWidth: 0, flexShrink: 1},
  problemText: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 3, fontWeight: "400"},
  providerActionsRow: {
    flexDirection: "row",
    gap: 8, flexWrap: "nowrap", maxWidth: 112},
  actionButton: { width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  cancelRequestButton: { flex: 1, minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.busy,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginTop: 0,
  },
  cancelRequestButtonDisabled: { opacity: 0.65 },
  cancelRequestButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", lineHeight: 18},

  // --- Rating ---
  ratingCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 16, marginBottom: 13, alignItems: "center",
    shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  ratingCardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, lineHeight: 22},
  ratingCardSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    marginBottom: 10,
  },
  starIcon: { marginHorizontal: 2 },
  commentInput: {
    width: "100%",
    minHeight: 80,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlignVertical: "top",
    marginBottom: 14, fontWeight: "400"},
  submitButton: {
    width: "100%", minHeight: 54, backgroundColor: colors.primary,
    borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: { color: colors.white, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  submittedCommentText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4, fontWeight: "400"},

  detailCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 16, marginBottom: 13,
    shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
    lineHeight: 22},
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    width: "32%", flexShrink: 1, lineHeight: 19, fontWeight: "500"},
  detailValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "right", lineHeight: 22, minWidth: 0, flexShrink: 1},
});
