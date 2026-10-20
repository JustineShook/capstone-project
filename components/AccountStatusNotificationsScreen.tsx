import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markAccountStatusNotificationRead, subscribeToAccountStatusNotifications, type AccountStatusNotification } from "../services/accountStatusNotificationService";

type Props = { home: string; color?: string };
const C = { bg: "#090A0C", card: "#151D24", text: "#F5F7F8", muted: "#9AA6AE", red: "#F51F3B", border: "#2C3944" };

export default function AccountStatusNotificationsScreen({ home, color = C.red }: Props) {
  const [items, setItems] = useState<AccountStatusNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToAccountStatusNotifications((next) => { setItems(next); setLoading(false); setError(""); }, (cause) => { setError(cause.message || "Could not load notifications."); setLoading(false); }), []);

  const open = async (item: AccountStatusNotification) => {
    if (!item.isRead) {
      try { await markAccountStatusNotificationRead(item.id); } catch { /* Keep the status message visible if marking read fails. */ }
    }
  };

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <View style={s.header}><Pressable style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace(home as never)} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={C.text} /></Pressable><View style={s.headerCopy}><Text style={s.title}>Account updates</Text><Text style={s.subtitle}>{items.filter((item) => !item.isRead).length} unread updates</Text></View><View style={s.back} /></View>
    {loading ? <View style={s.state}><ActivityIndicator color={color} /></View> : error ? <View style={s.state}><Feather name="wifi-off" size={30} color={C.muted} /><Text style={s.emptyTitle}>Notifications unavailable</Text><Text style={s.emptyText}>{error}</Text></View> : <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={s.state}><View style={[s.emptyIcon, { borderColor: color }]}><Feather name="bell" size={25} color={color} /></View><Text style={s.emptyTitle}>No account updates yet</Text><Text style={s.emptyText}>Verification and account status changes will appear here.</Text></View>}
      renderItem={({ item }) => <Pressable style={[s.card, !item.isRead && { borderColor: color }]} onPress={() => void open(item)} accessibilityRole="button"><View style={[s.icon, { backgroundColor: `${color}22` }]}><Feather name={item.status === "VERIFIED" || item.status === "ACTIVE" ? "check-circle" : item.status === "SUSPENDED" || item.status === "REJECTED" ? "alert-circle" : "bell"} size={19} color={color} /></View><View style={s.copy}><View style={s.titleRow}><Text style={s.cardTitle}>{item.title}</Text>{!item.isRead && <View style={[s.dot, { backgroundColor: color }]} />}</View><Text style={s.message}>{item.message}</Text>{item.reason && <Text style={s.message}>Admin reason: {item.reason}</Text>}<View style={s.footer}><Text style={s.date}>{new Date(item.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text><Text style={[s.status, { color }]}>{item.status.replace(/_/g, " ").toUpperCase()}</Text></View></View></Pressable>} />}
  </SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }, back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, paddingLeft: 4 }, title: { color: C.text, fontSize: 22, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 13, marginTop: 2 }, list: { padding: 14, gap: 10 }, emptyList: { flexGrow: 1, padding: 24 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.card, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 4 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 7 }, cardTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: "800" }, dot: { width: 8, height: 8, borderRadius: 4 }, message: { color: "#C2CBD1", fontSize: 13, lineHeight: 19 }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, date: { color: C.muted, fontSize: 11 }, status: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 } });
