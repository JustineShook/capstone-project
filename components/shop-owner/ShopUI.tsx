import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";
import { SHOP_STATUS_LABELS, type ShopBookingStatus } from "../../types/shopBooking";

export const C = { ...colors, border: "#E5E7EB", muted: "#6B7280", section: "#F7F7F8" };

export function ShopScreen({ title, children, back = false }: { title: string; children: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <SafeAreaView style={s.safe} edges={["left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={[s.header, { paddingTop: insets.top + 14 }]}>
      {back && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to requests"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)/requests")} style={s.iconButton}>
        <Feather name="arrow-left" size={22} color={C.white} />
      </TouchableOpacity>}
      <View style={s.flex}><Text style={s.headerTitle}>{title}</Text><Text style={s.headerSubtitle}>VeResc · Shop Owner</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shop profile" style={s.iconButton}
        onPress={() => router.navigate("/(shop-owner)/profile")}><Feather name="user" size={22} color={C.white} /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </SafeAreaView>;
}

export function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[s.button, secondary && s.secondaryButton, disabled && s.disabled]}>
    <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
  </TouchableOpacity>;
}

export function LoadState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (!loading && !error) return null;
  return <View style={s.card}>{loading ? <ActivityIndicator accessibilityLabel="Loading" color={C.primary} /> : <>
    <Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Try Again" onPress={retry} />
  </>}</View>;
}

export function StatusBadge({ status }: { status: ShopBookingStatus }) {
  const complete = status === "completed";
  const terminal = status === "rejected" || status === "cancelled";
  return <View style={[s.badge, complete && { backgroundColor: C.successLight }, terminal && { backgroundColor: C.section }]}>
    <Text style={[s.badgeText, complete && { color: C.success }, terminal && { color: C.muted }]}>
      {SHOP_STATUS_LABELS[status] ?? "Unknown status"}
    </Text>
  </View>;
}

export function Info({ label, value }: { label: string; value: string }) {
  return <View style={s.info}><Text style={s.label}>{label}</Text><Text selectable style={s.text}>{value || "Not provided"}</Text></View>;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Time not available";
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.primary, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { color: C.white, fontWeight: "700", fontSize: 18 },
  headerSubtitle: { color: "rgba(255,255,255,.85)", fontSize: 12, marginTop: 2 },
  iconButton: { padding: 10 }, flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, gap: 12 },
  heading: { fontSize: 12, fontWeight: "700", color: C.muted, letterSpacing: .6, marginTop: 8 },
  title: { color: C.textPrimary, fontSize: 17, fontWeight: "700", flexShrink: 1 },
  text: { color: C.textPrimary, fontSize: 14, lineHeight: 21 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  button: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", minHeight: 46 },
  buttonText: { fontSize: 13, fontWeight: "700", color: C.white, textAlign: "center" },
  secondaryButton: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border },
  secondaryText: { color: C.primary }, disabled: { opacity: .5 },
  badge: { backgroundColor: C.busyLight, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9, alignSelf: "flex-start" },
  badgeText: { color: C.primary, fontSize: 11, fontWeight: "700" },
  info: { gap: 4 }, label: { color: C.muted, fontSize: 12, fontWeight: "600" },
  error: { color: C.primary, fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, color: C.textPrimary, fontSize: 14, minHeight: 46 },
  identity: { backgroundColor: C.primary, borderRadius: 12, padding: 20, gap: 8, alignItems: "center" },
  identityName: { color: C.white, fontSize: 20, fontWeight: "700", textAlign: "center" },
  identityText: { color: C.white, fontSize: 13, textAlign: "center" },
  stat: { flexGrow: 1, flexBasis: "30%", borderRadius: 12, backgroundColor: C.primary, padding: 14, gap: 6 },
  statValue: { color: C.white, fontSize: 24, fontWeight: "700" },
  statLabel: { color: C.white, fontSize: 12 },
});
