import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar, ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  markTowingNotificationRead,
  subscribeToTowingNotifications,
  type TowingNotification,
} from "../../services/towingNotificationService";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Recently";
}

export default function TowingNotificationsScreen() {
  const [items, setItems] = useState<TowingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToTowingNotifications(
    (notifications) => {
      setItems(notifications);
      setLoading(false);
      setError("");
    },
    (listenerError) => {
      setError(listenerError.message || "Could not load notifications.");
      setLoading(false);
    },
  ), []);

  const openNotification = async (item: TowingNotification) => {
    if (!item.isRead) {
      try { await markTowingNotificationRead(item.id); } catch { /* Still open the request if marking it read fails. */ }
    }
    router.push({
      pathname: "/(towing-company)/request-details",
      params: {
        id: item.bookingId,
        cancellationSource: item.title === "Customer cancelled request" ? "customer" : "provider",
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(towing-company)")} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{items.filter((item) => !item.isRead).length} unread updates</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.state}><ActivityIndicator color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.state}>
          <Feather name="wifi-off" size={30} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Notifications unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listSurface}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.state}>
              <View style={styles.emptyIcon}><Feather name="bell" size={25} color={COLORS.primary} /></View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>New towing requests and customer cancellations will appear here.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, !item.isRead && styles.unreadCard]} onPress={() => void openNotification(item)} accessibilityRole="button">
              <View style={[styles.iconWrap, item.status === "cancelled" && styles.cancelledIcon]}><Feather name={item.status === "cancelled" ? "slash" : "truck"} size={19} color={item.status === "cancelled" ? COLORS.red : COLORS.primary} /></View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.route} numberOfLines={1}>{item.pickupLocation} → {item.destination}</Text>
                <View style={styles.footer}>
                  <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
                  <Text style={styles.status}>{item.status.replace(/_/g, " ").toUpperCase()}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.muted} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const COLORS = { background: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", border: "#D5DEE9", primary: "#0F52BA", primaryDark: "#0B3D8A", unread: "#EAF2FF", unreadBorder: "#B9CCE8", subtle: "#F1F5F9" };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, backgroundColor: COLORS.primary },
  back: { width: 44, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  headerCopy: { flex: 1, paddingLeft: 4 },
  headerSpacer: { width: 44 },
  listSurface: { flex: 1, backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  title: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "700" },
  subtitle: { color: "#EAF2FF", fontSize: 13, lineHeight: 18, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 12 },
  emptyList: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28, backgroundColor: COLORS.background },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.unread, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: COLORS.text, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 340 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  unreadCard: { backgroundColor: COLORS.unread, borderColor: COLORS.unreadBorder },
  iconWrap: { width: 42, height: 42, flexShrink: 0, borderRadius: 14, backgroundColor: COLORS.subtle, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: { flex: 1, flexShrink: 1, color: COLORS.text, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  unreadDot: { width: 8, height: 8, flexShrink: 0, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  message: { color: COLORS.muted, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  route: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 10, rowGap: 4, marginTop: 3 },
  date: { color: COLORS.muted, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  status: { color: COLORS.primaryDark, fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 0.4, flexShrink: 1, textAlign: "right" },
cancelledIcon: { backgroundColor: "#FDECEF" },
});
