// components/ProviderDetailCard.tsx

import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";
import { colors } from "../constants/theme";
import { getCategoryBadge, getCategoryIcon, getServiceLabel, MockProvider } from "../data/mockProviders";
import { StatusPill } from "./StatusPill";
export function ProviderDetailCard({
  provider,
  onClose,
}: {
  provider: MockProvider;
  onClose: () => void;
}) {
  const badge = getCategoryBadge(provider.category);

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
              <Text style={styles.metaText}>{provider.distanceKm} km</Text>
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

        {/* Services */}
        <Text style={styles.sectionLabel}>Services</Text>
        <View style={styles.servicesList}>
          {provider.services.map((service) => (
            <View key={service} style={styles.serviceRow}>
              <View style={styles.serviceBullet} />
              <Text style={styles.serviceText}>{service}</Text>
            </View>
          ))}
        </View>

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

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.callButton}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.messageButton}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
            <Text style={styles.messageButtonText}>Message</Text>
          </Pressable>
          <Pressable
            style={styles.bookButton}
            onPress={() =>
              router.push({
                pathname: provider.category === "Towing" ? "/book-towing" : "/book-mechanic",
                params: { providerId: provider.id },
              })
            }
          >
            <Text style={styles.bookButtonText}>Book Service</Text>
          </Pressable>
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