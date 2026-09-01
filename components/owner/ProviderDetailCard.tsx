// components/ProviderDetailCard.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  const showBookButton = supportsBooking(provider.category);

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
        <View style={styles.hoursRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.hoursText}>{provider.hours}</Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Starting price</Text>
          <Text style={styles.priceValue}>Starts at {provider.startingPrice}</Text>
        </View>

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
        <View style={styles.actionsRow}>
          <Pressable style={styles.callButton}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={[styles.messageButton, !showBookButton && styles.messageButtonWide]}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
            <Text style={styles.messageButtonText}>Message</Text>
          </Pressable>
          {showBookButton && (
            <Pressable
              style={styles.bookButton}
              onPress={() =>
                router.push({
                  pathname:
                    provider.category === "Towing"
                      ? "../towing-booking/book-towing"
                      : "../mechanic-booking/book-mechanic",
                  params: {
                    providerId: provider.id,
                  },
                })
              }
            >
              <Text style={styles.bookButtonText}>Book Service</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  headerInfo: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  metaDot: { fontSize: 12, color: colors.textMuted },
  closeButton: { padding: 4 },

  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  servicesList: { marginBottom: 16, gap: 6 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  serviceBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  serviceText: { fontSize: 13, color: colors.textSecondary },

  vehicleTypesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  vehicleTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  vehicleTypeText: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },

  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  hoursText: { fontSize: 13, color: colors.textSecondary },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  priceLabel: { fontSize: 12, color: colors.textMuted },
  priceValue: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },

  reviewsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  reviewsSummaryRating: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  reviewsSummaryCount: { fontSize: 12, color: colors.textMuted },

  reviewsList: { gap: 10, marginBottom: 16 },
  reviewCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  reviewStars: { fontSize: 13, color: colors.rating, letterSpacing: 1 },
  reviewComment: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reviewFooterRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  reviewAuthor: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  reviewDate: { fontSize: 12, color: colors.textMuted },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  callButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
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
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  messageButtonWide: {
    flex: 2.4,
  },
  messageButtonText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  bookButton: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  bookButtonText: { fontSize: 13, fontWeight: "800", color: colors.white },
});