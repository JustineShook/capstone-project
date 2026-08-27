// app/(owner)/towing-booking/booking-confirmation.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../constants/owner/theme";
import { MOCK_PROVIDERS } from "../../../data/owner/mockProviders";
import { MOCK_VEHICLES } from "../../../data/owner/mockVehicles";
import { getTowingBookingById } from "../../../services/owner/towingService";
import { getTowingStatusLabel, TowingBookingRequest } from "../../../types/owner/towing";

export default function TowingBookingConfirmationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<TowingBookingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const result = bookingId ? await getTowingBookingById(bookingId) : undefined;
      if (isMounted) {
        setBooking(result ?? null);
        setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (isLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.notFoundText}>This request could not be found.</Text>
        <Pressable style={styles.homeButton} onPress={() => router.push("/")}>
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const provider = MOCK_PROVIDERS.find((p) => p.id === booking.providerId);
  const vehicle = MOCK_VEHICLES.find((v) => v.id === booking.vehicleId);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark" size={36} color={colors.white} />
        </View>
        <Text style={styles.title}>Request Sent!</Text>
        <Text style={styles.subtitle}>
          Your towing request has been sent to {provider?.name ?? "the provider"}.
        </Text>

        {vehicle && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Vehicle</Text>
            <Text style={styles.cardValue}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.cardSubvalue}>{vehicle.vehicleType}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pickup Location</Text>
          <Text style={styles.cardValue}>{booking.pickupLocation}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Destination</Text>
          <Text style={styles.cardValue}>{booking.destination}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Towing Type</Text>
          <Text style={styles.cardValue}>{booking.towingType}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vehicle Condition</Text>
          <Text style={styles.cardValue}>{booking.vehicleCondition}</Text>
        </View>

        {booking.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Notes</Text>
            <Text style={styles.cardValue}>{booking.notes}</Text>
          </View>
        ) : null}

        {provider && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Provider</Text>
            <Text style={styles.cardValue}>{provider.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={12} color={colors.rating} />
              <Text style={styles.metaText}>{provider.rating.toFixed(1)}</Text>
              <Text style={styles.metaDot}>{"\u2022"}</Text>
              <Text style={styles.metaText}>{provider.distanceKm} km away</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Starting Price</Text>
          <Text style={styles.cardValue}>{booking.startingPrice}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{getTowingStatusLabel(booking.status)}</Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Pressable
          style={styles.viewRequestButton}
          onPress={() =>
            router.push({ pathname: "./booking-detail", params: { bookingId: booking.id } })
          }
        >
          <Text style={styles.viewRequestButtonText}>View Request</Text>
        </Pressable>
        <Pressable style={styles.homeButton} onPress={() => router.push("/")}>
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  loadingRoot: { flex: 1, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  notFoundText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },

  content: { padding: 24, paddingTop: 48, alignItems: "center" },

  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  card: {
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" },
  cardValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  cardSubvalue: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  metaDot: { fontSize: 12, color: colors.textMuted },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rating },
  statusText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },

  footer: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  viewRequestButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  viewRequestButtonText: { fontSize: 14, fontWeight: "800", color: colors.white },
  homeButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  homeButtonText: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
});