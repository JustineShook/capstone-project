import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markHomeGarageNotificationRead, subscribeToHomeGarageNotifications, type HomeGarageNotification } from "../../services/homeGarageNotificationService";

const C = { bg: "#090A0C", card: "#151D24", text: "#F5F7F8", muted: "#9AA6AE", red: "#F51F3B", border: "#2C3944" };
const formatDate = (value: string) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Recently"; };

export default function HomeGarageNotifications() {
  const [items, setItems] = useState<HomeGarageNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToHomeGarageNotifications((next) => { setItems(next); setLoading(false); setError(""); }, (cause) => { setError(cause.message); setLoading(false); }), []);
  const open = async (item: HomeGarageNotification) => {
    if (!item.isRead) { try { await markHomeGarageNotificationRead(item.id); } catch { /* Continue to the request details. */ } }
    router.push({ pathname: "/(homegarage)/repair-request-detail", params: { bookingId: item.bookingId } });
  };
  const unread = items.filter((item) => !item.isRead).length;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <View style={s.header}><Pressable style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(homegarage)")}><Feather name="arrow-left" size={22} color={C.text} /></Pressable><View style={s.headerCopy}><Text style={s.title}>Notifications</Text><Text style={s.subtitle}>{unread} unread update{unread === 1 ? "" : "s"}</Text></View></View>
    {loading ? <View style={s.state}><ActivityIndicator color={C.red} /></View> : error ? <View style={s.state}><Feather name="wifi-off" size={30} color={C.muted} /><Text style={s.emptyTitle}>Notifications unavailable</Text><Text style={s.emptyText}>{error}</Text></View> : <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={s.state}><View style={s.emptyIcon}><Feather name="bell" size={25} color={C.red} /></View><Text style={s.emptyTitle}>No notifications yet</Text><Text style={s.emptyText}>New repair requests, customer cancellations, and service updates will appear here.</Text></View>}
      renderItem={({ item }) => <Pressable style={[s.card, !item.isRead && s.unread]} onPress={() => void open(item)}><View style={s.icon}><Feather name={item.status === "cancelled" ? "slash" : "tool"} size={19} color={C.red} /></View><View style={s.copy}><View style={s.titleRow}><Text style={s.cardTitle}>{item.title}</Text>{!item.isRead && <View style={s.dot} />}</View><Text style={s.message}>{item.message}</Text><Text style={s.vehicle} numberOfLines={1}>{item.vehicle} · {item.customerName}</Text><View style={s.footer}><Text style={s.date}>{formatDate(item.updatedAt)}</Text><Text style={s.status}>{item.status.replace(/_/g, " ").toUpperCase()}</Text></View></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>} />}
  </SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }, back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, paddingLeft: 4 }, title: { color: C.text, fontSize: 22, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 13, marginTop: 2 }, list: { padding: 14, gap: 10 }, emptyList: { flexGrow: 1, padding: 24 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, unread: { borderColor: C.red }, icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#281B20", alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 4 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 7 }, cardTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: "800" }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }, message: { color: "#C2CBD1", fontSize: 13, lineHeight: 19 }, vehicle: { color: C.muted, fontSize: 12 }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, date: { color: C.muted, fontSize: 11 }, status: { color: "#FFAAB5", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 } });
