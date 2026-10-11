import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../constants/owner/theme";
import {
  markCustomerNotificationRead,
  subscribeToCustomerNotifications,
  type CustomerNotification,
} from "../../services/customerNotificationService";

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToCustomerNotifications(
    (items) => {
      setNotifications(items);
      setIsLoading(false);
      setError("");
    },
    (listenerError) => {
      setError(listenerError.message || "Could not load notifications.");
      setIsLoading(false);
    },
  ), []);

  const openNotification = async (item: CustomerNotification) => {
    if (!item.isRead) {
      try {
        await markCustomerNotificationRead(item.id);
      } catch {
        // The request details are still useful if marking the item read fails.
      }
    }
    if (item.bookingType === "onsite-mechanic") {
      router.push({ pathname: "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: item.bookingId } });
    } else if (item.bookingType === "towing-company") {
      router.push({ pathname: "/(v_owner)/towing-booking/booking-detail", params: { bookingId: item.bookingId } });
    } else {
      router.push({ pathname: "/(v_owner)/shop-booking/booking-detail", params: { bookingId: item.bookingId } });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>
          {notifications.filter((item) => !item.isRead).length
            ? `${notifications.filter((item) => !item.isRead).length} unread update${notifications.filter((item) => !item.isRead).length === 1 ? "" : "s"}`
            : "Updates about your service requests"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Notifications unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={notifications.length ? styles.list : styles.emptyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="notifications-outline" size={28} color={colors.primary} /></View>
              <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
              <Text style={styles.emptyText}>Booking updates from your mechanic, towing provider, or shop will appear here.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
              onPress={() => void openNotification(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.message}`}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={item.bookingType === "towing-company" ? "car-sport-outline" : item.bookingType === "shop-owner" ? "build-outline" : "construct-outline"}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.date}>{formatNotificationDate(item.updatedAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  list: { padding: 16, gap: 11 },
  emptyList: { flexGrow: 1, padding: 24 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  notificationCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unreadCard: { borderColor: colors.primary, backgroundColor: "#181E24" },
  iconWrap: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTitle: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
