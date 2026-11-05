import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markAccountStatusNotificationRead, subscribeToAccountStatusNotifications, type AccountStatusNotification } from "../services/accountStatusNotificationService";

type Props = { home: string; color?: string; appearance?: "default" | "mechanic" | "homegarage" };
const C = { bg: "#090A0C", card: "#151D24", text: "#F5F7F8", muted: "#9AA6AE", red: "#F51F3B", border: "#2C3944" };
const M = { bg: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#475569", red: "#0F52BA", border: "#D5DEE9", shadow: "#172B4D" };

export default function AccountStatusNotificationsScreen({ home, color, appearance = "default" }: Props) {
  const homeGarage = appearance === "homegarage";
  const mechanic = appearance === "mechanic" || homeGarage;
  const s = homeGarage ? { ...baseStyles, ...homeGarageStyles } : baseStyles;
  const palette = homeGarage ? { ...M, muted: "#526277" } : mechanic ? M : C;
  const accent = color ?? palette.red;
  const [items, setItems] = useState<AccountStatusNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToAccountStatusNotifications((next) => { setItems(next); setLoading(false); setError(""); }, (cause) => { setError(cause.message || "Could not load notifications."); setLoading(false); }), []);

  const open = async (item: AccountStatusNotification) => {
    if (!item.isRead) {
      try { await markAccountStatusNotificationRead(item.id); } catch { /* Keep the status message visible if marking read fails. */ }
    }
  };

  return <SafeAreaView style={[s.safe, mechanic && s.mechanicSafe]} edges={["top", "left", "right"]}>
    {mechanic && <StatusBar barStyle="light-content" backgroundColor={M.red} />}
    <View style={[s.header, mechanic && s.mechanicHeader]}><Pressable style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace(home as never)} accessibilityRole="button" accessibilityLabel="Go back"><Feather name="arrow-left" size={22} color={mechanic ? "#FFFFFF" : C.text} /></Pressable><View style={s.headerCopy}><Text style={[s.title, mechanic && s.mechanicTitle]}>Account updates</Text><Text style={[s.subtitle, mechanic && s.mechanicSubtitle]}>{items.filter((item) => !item.isRead).length} unread updates</Text></View><View style={s.back} /></View>
    {loading ? <View style={[s.state, mechanic && s.mechanicSurface]}><ActivityIndicator color={accent} /></View> : error ? <View style={[s.state, mechanic && s.mechanicSurface]}><Feather name="wifi-off" size={30} color={palette.muted} /><Text style={[s.emptyTitle, mechanic && s.mechanicText]}>Notifications unavailable</Text><Text style={[s.emptyText, mechanic && s.mechanicMuted]}>{error}</Text></View> : <FlatList style={mechanic ? s.mechanicSurface : undefined} data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? [s.list, mechanic && s.mechanicList] : [s.emptyList, mechanic && s.mechanicEmptyList]} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={s.state}><View style={[s.emptyIcon, mechanic && s.mechanicEmptyIcon, { borderColor: accent }]}><Feather name="bell" size={25} color={accent} /></View><Text style={[s.emptyTitle, mechanic && s.mechanicText]}>No account updates yet</Text><Text style={[s.emptyText, mechanic && s.mechanicMuted]}>Verification and account status changes will appear here.</Text></View>}
      renderItem={({ item }) => <Pressable style={[s.card, mechanic && s.mechanicCard, mechanic && { shadowColor: M.shadow }, !item.isRead && { borderColor: accent }]} onPress={() => void open(item)} accessibilityRole="button"><View style={[s.icon, { backgroundColor: `${accent}22` }]}><Feather name={item.status === "VERIFIED" || item.status === "ACTIVE" ? "check-circle" : item.status === "SUSPENDED" || item.status === "REJECTED" ? "alert-circle" : "bell"} size={19} color={accent} /></View><View style={s.copy}><View style={s.titleRow}><Text style={[s.cardTitle, mechanic && s.mechanicText]}>{item.title}</Text>{!item.isRead && <View style={[s.dot, { backgroundColor: accent }]} />}</View><Text style={[s.message, mechanic && s.mechanicMuted]}>{item.message}</Text>{item.reason && <Text style={[s.message, mechanic && s.mechanicMuted]}>Admin reason: {item.reason}</Text>}<View style={s.footer}><Text style={[s.date, mechanic && s.mechanicMuted]}>{new Date(item.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text><Text style={[s.status, { color: accent }]}>{item.status.replace(/_/g, " ").toUpperCase()}</Text></View></View></Pressable>} />}
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, mechanicSafe: { backgroundColor: M.red }, header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }, mechanicHeader: { minHeight: 72, paddingHorizontal: 16, backgroundColor: M.red, borderBottomWidth: 0 }, back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, paddingLeft: 4 }, title: { color: C.text, fontSize: 22, fontWeight: "800" }, mechanicTitle: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 13, marginTop: 2 }, mechanicSubtitle: { color: "#EAF2FF", fontSize: 13, lineHeight: 18 }, list: { padding: 14, gap: 10 }, mechanicList: { paddingHorizontal: 16, paddingTop: 16 }, emptyList: { flexGrow: 1, padding: 24 }, mechanicEmptyList: { paddingHorizontal: 24, paddingTop: 16 }, mechanicSurface: { flex: 1, backgroundColor: M.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28 }, mechanicText: { color: M.text }, mechanicMuted: { color: M.muted }, mechanicEmptyIcon: { backgroundColor: M.card }, emptyIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.card, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyTitle: { color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center" }, emptyText: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }, card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, mechanicCard: { alignItems: "flex-start", padding: 16, borderRadius: 20, backgroundColor: M.card, borderColor: M.border, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0, gap: 4 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 7 }, cardTitle: { flex: 1, color: C.text, fontSize: 14, fontWeight: "800" }, dot: { width: 8, height: 8, borderRadius: 4 }, message: { color: "#C2CBD1", fontSize: 13, lineHeight: 19, flexWrap: "wrap" }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 2 }, date: { color: C.muted, fontSize: 11 }, status: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 } });

const homeGarageStyles = StyleSheet.create({
  mechanicHeader: { minHeight: 70, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, backgroundColor: "#0F52BA", borderBottomWidth: 0 },
  mechanicTitle: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800" },
  mechanicMuted: { color: "#526277" },
  mechanicList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  mechanicCard: { alignItems: "flex-start", padding: 16, borderRadius: 20, backgroundColor: "#FFFFFF", borderColor: "#D5DEE9", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { flex: 1, color: "#172B4D", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  message: { color: "#526277", fontSize: 14, lineHeight: 20, flexWrap: "wrap" },
  date: { color: "#526277", fontSize: 12, lineHeight: 18 },
  emptyTitle: { color: "#172B4D", fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
});
