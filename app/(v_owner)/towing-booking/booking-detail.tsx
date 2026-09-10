// app/(owner)/towing-booking/booking-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../constants/owner/theme";
import { getServiceLabel } from "../../../data/owner/mockProviders";
import { getProviderReviewSummary, getRating, mergeRating, submitRating } from "../../../services/owner/ratingService";
import { subscribeToTowingBooking } from "../../../services/owner/towingService";
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
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<TowingBookingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providerRating, setProviderRating] = useState({ average: 0, count: 0 });

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
    if (!booking?.providerId) return;
    void getProviderReviewSummary(booking.providerId).then(({ average, count }) => setProviderRating({ average, count }));
  }, [booking?.providerId]);

  const provider = booking ? { name: booking.providerName, initials: booking.providerName.slice(0, 2).toUpperCase(), color: colors.primary, phone: "", rating: providerRating.average, reviewCount: providerRating.count, distanceKm: 0, category: "Towing" as const } : undefined;
  const vehicle = booking ? { year: booking.vehicleYear, make: booking.vehicle, model: "", vehicleType: "" } : undefined;
  const currentStepIndex = booking ? TOWING_STATUS_FLOW.indexOf(booking.status) : -1;
  const isTerminalStatus = booking?.status === "cancelled" || booking?.status === "rejected";

  // --- Call / Message the provider -----------------------------------------
  // Assumes `provider.phone` exists on the Provider type — swap the field
  // name below if mockProviders uses something different.
  const handleCallProvider = () => {
    if (!provider?.phone) return;
    Linking.openURL(`tel:${provider.phone}`);
  };

  const handleMessageProvider = () => {
    if (!provider?.phone) return;
    Linking.openURL(`sms:${provider.phone}`);
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)/history")}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Request Status</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loadingRoot}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !booking ? (
        <View style={styles.loadingRoot}>
          <Text style={styles.notFoundText}>This request could not be found.</Text>
        </View>
      ) : (
        <>
          {/* Fixed section — does not scroll: provider card (with Call /
              Message) and the status progress bar. */}
          <View style={styles.fixedTop}>
            {provider && (
              <View style={styles.providerCard}>
                <View style={[styles.avatar, { backgroundColor: provider.color }]}>
                  <Text style={styles.avatarText}>{provider.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.problemText}>
                    {booking.pickupLocation} → {booking.destination}
                  </Text>
                </View>
                <View style={styles.providerActionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={handleCallProvider}
                    hitSlop={6}
                  >
                    <Ionicons name="call" size={16} color={colors.white} />
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={handleMessageProvider}
                    hitSlop={6}
                  >
                    <Ionicons name="chatbubble" size={16} color={colors.white} />
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.statusBlock}>
              {!isTerminalStatus && (
                <Text style={styles.currentStatusText}>{getTowingStatusLabel(booking.status)}</Text>
              )}
              {isTerminalStatus ? (
                <View style={styles.cancelledBadge}>
                  <Ionicons name="close-circle" size={16} color={colors.white} />
                  <Text style={styles.cancelledBadgeText}>{getTowingStatusLabel(booking.status)}</Text>
                </View>
              ) : (
                <View style={styles.progressRow}>
                  {TOWING_STATUS_FLOW.map((status, index) => {
                    const isDone = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isLast = index === TOWING_STATUS_FLOW.length - 1;
                    return (
                      <View key={status} style={styles.progressStep}>
                        <View style={styles.progressStepCol}>
                          <View
                            style={[
                              styles.progressDot,
                              (isDone || isCurrent) && styles.progressDotActive,
                              isCurrent && styles.progressDotCurrent,
                            ]}
                          >
                            {isDone && <Ionicons name="checkmark" size={10} color={colors.white} />}
                          </View>
                          {!isLast && (
                            <View style={[styles.progressLine, isDone && styles.progressLineActive]} />
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {!isTerminalStatus && (
                <View style={styles.progressLabelsRow}>
                  {TOWING_STATUS_FLOW.map((status, index) => (
                    <View key={status} style={styles.progressLabelCol}>
                      <Text
                        style={[
                          styles.progressStepLabel,
                          index === currentStepIndex && styles.progressStepLabelCurrent,
                          index < currentStepIndex && styles.progressStepLabelDone,
                        ]}
                        numberOfLines={2}
                      >
                        {getTowingStatusShortLabel(status)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Scrollable section — rating card + Provider/Vehicle/Towing/
              Booking detail cards. */}
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Rating — only once the booking is completed. Three states:
                1. Already rated -> "Thank you for your feedback!" + read-only stars/comment
                2. Just submitted -> transient "Thank you!" confirmation (then auto-navigates away)
                3. Not yet rated -> the rating + comment form */}
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

            {provider && (
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Provider Details</Text>

                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Provider</Text>
                  <Text style={styles.detailValue}>{provider.name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Rating</Text>
                  <Text style={styles.detailValue}>
                    {provider.rating.toFixed(1)} ({provider.reviewCount})
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="navigate-outline" size={16} color={colors.textSecondary} />
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
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Year</Text>
                  <Text style={styles.detailValue}>{vehicle.year}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Make</Text>
                  <Text style={styles.detailValue}>{vehicle.make}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
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
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.detailValue}>{booking.pickupLocation}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Destination</Text>
                <Text style={styles.detailValue}>{booking.destination}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Towing Type</Text>
                <Text style={styles.detailValue}>{booking.towingType}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Condition</Text>
                <Text style={styles.detailValue}>{booking.vehicleCondition}</Text>
              </View>

              {booking.notes ? (
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{booking.notes}</Text>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Estimated Price</Text>
                <Text style={styles.detailValue}>₱{(booking.estimatedTotalPrice ?? booking.estimatedPrice ?? 0).toLocaleString("en-PH")}</Text>
              </View>
              {typeof booking.basePrice === "number" && <>
                <View style={styles.detailRow}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Base Fee</Text>
                  <Text style={styles.detailValue}>₱{booking.basePrice.toLocaleString("en-PH")}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Rate</Text>
                  <Text style={styles.detailValue}>₱{booking.pricePerKm.toLocaleString("en-PH")}/km</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calculator-outline" size={16} color={colors.textSecondary} />
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
                <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>{booking.id}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Requested</Text>
                <Text style={styles.detailValue}>{formatRequestDateTime(booking.createdAt)}</Text>
              </View>

              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Ionicons name="ellipse-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{getTowingStatusLabel(booking.status)}</Text>
              </View>
            </View>
          </ScrollView>
        </>
      )}
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
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  notFoundText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: "center" },

  // Fixed (non-scrolling) section: provider card + status.
  fixedTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },

  content: { padding: 16, paddingBottom: 24 },

  providerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12, marginBottom: 20,
  },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  providerName: { fontSize: 14.5, fontWeight: "500", color: colors.textPrimary },
  problemText: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  providerActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 12, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 },

  statusBlock: { marginBottom: 4 },
  currentStatusText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressStep: {
    flex: 1,
    flexDirection: "row",
  },
  progressStepCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  progressDotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  progressLineActive: { backgroundColor: colors.primary },
  progressLabelsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  progressLabelCol: {
    flex: 1,
    alignItems: "center",
  },
  progressStepLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center",
  },
  progressStepLabelCurrent: { color: colors.primary, fontWeight: "700" },
  progressStepLabelDone: { color: colors.textSecondary, fontWeight: "600" },

  cancelledBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.textMuted,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelledBadgeText: { color: colors.white, fontSize: 12, fontWeight: "600" },

  // --- Rating ---
  ratingCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  ratingCardTitle: { fontSize: 14.5, fontWeight: "500", color: colors.textPrimary },
  ratingCardSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
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
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  submitButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  submittedCommentText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },

  detailCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  detailCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailLabel: {
    fontSize: 12.5,
    color: colors.textSecondary,
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.textPrimary,
    textAlign: "right",
  },
});
