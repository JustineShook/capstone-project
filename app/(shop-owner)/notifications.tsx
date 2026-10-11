import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markShopNotificationRead, subscribeToShopNotifications, type ShopNotification } from "../../services/shopNotificationService";
import { isActiveShopService, type ShopBookingStatus } from "../../types/shopBooking";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Recently";
}

export default function ShopNotificationsScreen() {
  const [items, setItems] = useState<ShopNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToShopNotifications((next) => { setItems(next); setLoading(false); setError(""); }, (cause) => { setError(cause.message || "Could not load notifications."); setLoading(false); }), []);

  const open = async (item: ShopNotification) => {
    if (!item.isRead) {
      try { await markShopNotificationRead(item.id); } catch { /* Open the request even if marking read fails. */ }
    }
    router.push({ pathname: isActiveShopService(item.status as ShopBookingStatus) ? "/(shop-owner)/active-service" : "/(shop-owner)/request-details", params: { id: item.bookingId } });
  };

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.background} />
    <View style={s.header}><Pressable style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)")} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={C.text} /></Pressable><View style={s.headerCopy}><Text style={s.title}>Notifications</Text><Text style={s.subtitle}>{items.filter((item) => !item.isRead).length} unread updates</Text></View><View style={s.spacer} /></View>
    {loading ? <View style={s.state}><ActivityIndicator color={C.red} /></View> : error ? <View style={s.state}><Feather name="wifi-off" size={30} color={C.muted} /><Text style={s.emptyTitle}>Notifications unavailable</Text><Text style={s.emptyText}>{error}</Text></View> : <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={s.state}><View style={s.emptyIcon}><Feather name="bell" size={25} color={C.red} /></View><Text style={s.emptyTitle}>No notifications yet</Text><Text style={s.emptyText}>New customer requests and shop service updates will appear here.</Text></View>}
      renderItem={({ item }) => <Pressable style={[s.card, !item.isRead && s.unread]} onPress={() => void open(item)} accessibilityRole="button"><View style={s.icon}><Feather name={item.status === "completed" ? "check-circle" : item.status === "rejected" ? "slash" : "tool"} size={19} color={C.red} /></View><View style={s.copy}><View style={s.titleRow}><Text style={s.cardTitle}>{item.title}</Text>{!item.isRead && <View style={s.unreadDot} />}</View><Text style={s.message}>{item.message}</Text><Text style={s.problem} numberOfLines={2}>{item.problem}</Text><View style={s.footer}><Text style={s.date}>{formatDate(item.updatedAt)}</Text><Text style={s.status}>{item.status.replace(/_/g, " ").toUpperCase()}</Text></View></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>} />}
  </SafeAreaView>;
}

const C = { background: "#08090B", card: "#17191C", text: "#F5F2F0", muted: "#B7B2B0", red: "#F52239", border: "#303135" };
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background }, header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }, back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, paddingLeft: 4 }, spacer: { width: 42 }, title: { color: C.text, fontSize: 22, fontWeight: "900" }, subtitle: { color: C.muted, fontSize: 13, marginTop: 2 }, list: { padding: 14, gap: 10 }, emptyList: { flexGrow: 1, padding: 24 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 18, fontWeight: "900", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, unread: { borderColor: C.red }, icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#281B20", alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 4 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 7 }, cardTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: "900" }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }, message: { color: "#D0CBC9", fontSize: 14, lineHeight: 20 }, problem: { color: C.muted, fontSize: 13, lineHeight: 18 }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, date: { color: C.muted, fontSize: 11 }, status: { color: "#FF9CA7", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
});
