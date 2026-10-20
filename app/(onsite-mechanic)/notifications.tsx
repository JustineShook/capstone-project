import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";

import {
  markMechanicNotificationRead,
  subscribeToMechanicNotifications,
  type MechanicNotification,
} from "../../services/mechanicNotificationService";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Recently";
}

export default function MechanicNotificationsScreen() {
  const [items, setItems] = useState<MechanicNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    let stopNotifications: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopNotifications?.();
      if (!user) {
        setItems([]);
        setError("You are signed out. Sign in again to load mechanic notifications.");
        setLoading(false);
        return;
      }
      stopNotifications = subscribeToMechanicNotifications(
        (notifications) => {
          setItems(notifications);
          setLoading(false);
          setError("");
        },
        (listenerError) => {
          const code = (listenerError as Error & { code?: string }).code;
          setError(code === "permission-denied"
            ? "Firebase denied access to this notification list. Publish the current firestore.rules to the Firebase project used by this app, then retry."
            : `${code ? `${code}: ` : ""}${listenerError.message || "Could not load notifications. Check your connection and retry."}`);
          setLoading(false);
        },
      );
    });
    return () => {
      stopAuth();
      stopNotifications?.();
    };
  }, [retry]);

  const openNotification = async (item: MechanicNotification) => {
    if (!item.isRead) {
      try { await markMechanicNotificationRead(item.id); } catch { /* Keep opening the request if marking read fails. */ }
    }
    router.push({ pathname: "/(onsite-mechanic)/request-details", params: { bookingId: item.bookingId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(onsite-mechanic)")} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{items.filter((item) => !item.isRead).length} unread updates</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.state}><ActivityIndicator color={COLORS.red} /></View>
      ) : error ? (
        <View style={styles.state}>
          <Feather name="wifi-off" size={30} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Notifications unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => setRetry((value) => value + 1)} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.state}>
              <View style={styles.emptyIcon}><Feather name="bell" size={25} color={COLORS.red} /></View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>New service requests and customer cancellations will appear here.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, !item.isRead && styles.unreadCard]} onPress={() => void openNotification(item)} accessibilityRole="button">
              <View style={styles.iconWrap}><Feather name={item.status === "cancelled" ? "slash" : "tool"} size={19} color={COLORS.red} /></View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.message}>{item.message}</Text>
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

const COLORS = { background: "#090A0C", card: "#151D24", text: "#F5F7F8", muted: "#9AA6AE", red: "#F51F3B", border: "#2C3944" };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, paddingLeft: 4 },
  headerSpacer: { width: 42 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  list: { padding: 14, gap: 10 },
  emptyList: { flexGrow: 1, padding: 24 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 },
  emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  retryButton: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.red },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  unreadCard: { borderColor: COLORS.red },
  iconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#281B20", alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "800" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.red },
  message: { color: "#C2CBD1", fontSize: 13, lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  date: { color: COLORS.muted, fontSize: 11 },
  status: { color: "#FFAAB5", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
});
