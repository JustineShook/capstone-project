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
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={s.header}><Pressable style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)")} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color="#FFFFFF" /></Pressable><View style={s.headerCopy}><Text style={s.title}>Notifications</Text><Text style={s.subtitle}>{items.filter((item) => !item.isRead).length} unread updates</Text></View><View style={s.spacer} /></View>
    {loading ? <View style={s.state}><ActivityIndicator color={C.primary} /></View> : error ? <View style={s.state}><Feather name="wifi-off" size={30} color={C.muted} /><Text style={s.emptyTitle}>Notifications unavailable</Text><Text style={s.emptyText}>{error}</Text></View> : <FlatList style={s.listSurface} data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={s.state}><View style={s.emptyIcon}><Feather name="bell" size={25} color={C.primary} /></View><Text style={s.emptyTitle}>No notifications yet</Text><Text style={s.emptyText}>New customer requests and shop service updates will appear here.</Text></View>}
      renderItem={({ item }) => <Pressable style={[s.card, !item.isRead && s.unread]} onPress={() => void open(item)} accessibilityRole="button"><View style={s.icon}><Feather name={item.status === "completed" ? "check-circle" : item.status === "rejected" ? "slash" : "tool"} size={19} color={C.primary} /></View><View style={s.copy}><View style={s.titleRow}><Text style={s.cardTitle}>{item.title}</Text>{!item.isRead && <View style={s.unreadDot} />}</View><Text style={s.message}>{item.message}</Text><Text style={s.problem} numberOfLines={2}>{item.problem}</Text><View style={s.footer}><Text style={s.date}>{formatDate(item.updatedAt)}</Text><Text style={s.status}>{item.status.replace(/_/g, " ").toUpperCase()}</Text></View></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>} />}
  </SafeAreaView>;
}

const C = { background: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#B4233A", border: "#D5DEE9", primary: "#0F52BA", primaryDark: "#0B3D8A", unread: "#EAF2FF", unreadBorder: "#B9CCE8", subtle: "#F1F5F9" };
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary }, header: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, backgroundColor: C.primary }, back: { width: 44, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 }, headerCopy: { flex: 1, paddingLeft: 4 }, spacer: { width: 44 }, title: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "700" }, subtitle: { color: "#EAF2FF", fontSize: 13, lineHeight: 18, marginTop: 2 }, list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 12 }, emptyList: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28, backgroundColor: C.background }, emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.unread, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 340 }, card: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, unread: { backgroundColor: C.unread, borderColor: C.unreadBorder }, icon: { width: 42, height: 42, flexShrink: 0, borderRadius: 14, backgroundColor: C.subtle, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0, gap: 5 }, titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, cardTitle: { flex: 1, flexShrink: 1, color: C.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }, unreadDot: { width: 8, height: 8, flexShrink: 0, borderRadius: 4, backgroundColor: C.primary, marginTop: 6 }, message: { color: C.muted, fontSize: 14, lineHeight: 20, flexShrink: 1 }, problem: { color: C.muted, fontSize: 14, lineHeight: 20, flexShrink: 1 }, footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 10, rowGap: 4, marginTop: 3 }, date: { color: C.muted, fontSize: 12, lineHeight: 17, flexShrink: 1 }, status: { color: C.primaryDark, fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 0.4, flexShrink: 1, textAlign: "right" },

listSurface: { flex: 1, backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
});
