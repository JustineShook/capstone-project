import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";
import { SHOP_STATUS_LABELS, type ShopBookingStatus } from "../../types/shopBooking";

export const C = { ...colors, primary: "#F52239", background: "#090A0C", surface: "#191A1D", surfaceAlt: "#202124", textPrimary: "#ECE8E6", textSecondary: "#B7B2B0", textMuted: "#9A9694", border: "#303135", muted: "#B7B2B0", section: "#202124", white: "#F7EFED", busyLight: "#342B1E", successLight: "#163B2B", success: "#49B982" };

export function ShopScreen({ title, children, back = false, scrollable = true }: { title: string; children: ReactNode; back?: boolean; scrollable?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.background} />
    <View style={[s.header, { paddingTop: insets.top + 14 }]}>
      {back && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to requests"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)/requests")} style={s.iconButton}>
        <Feather name="arrow-left" size={22} color={C.white} />
      </TouchableOpacity>}
      <View style={s.flex}><Text style={s.headerTitle}>{title}</Text><Text style={s.headerSubtitle}>VeResc · Shop Owner</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shop profile" style={s.iconButton}
        onPress={() => router.navigate("/(shop-owner)/profile")}><Feather name="user" size={22} color={C.white} /></TouchableOpacity>
    </View>
    {scrollable ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={s.fixedContent}>{children}</View>}
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
  header: { backgroundColor: C.background, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.textPrimary, fontWeight: "800", fontSize: 20 },
  headerSubtitle: { color: C.muted, fontSize: 12, marginTop: 2 },
  iconButton: { padding: 10, borderRadius: 24, backgroundColor: C.surfaceAlt }, flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  fixedContent: { flex: 1, minHeight: 0, padding: 16, gap: 12 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 17, gap: 13 },
  heading: { fontSize: 13, fontWeight: "800", color: C.muted, letterSpacing: .7, marginTop: 3 },
  title: { color: C.textPrimary, fontSize: 20, fontWeight: "800", flexShrink: 1 },
  text: { color: C.textPrimary, fontSize: 15, lineHeight: 22 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  button: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", minHeight: 50 },
  buttonText: { fontSize: 15, fontWeight: "800", color: C.white, textAlign: "center" },
  secondaryButton: { backgroundColor: C.surface, borderWidth: 1, borderColor: "#45464A" },
  secondaryText: { color: C.textPrimary }, disabled: { opacity: .5 },
  badge: { backgroundColor: "#342B1E", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" },
  badgeText: { color: "#F4D28A", fontSize: 12, fontWeight: "800" },
  info: { gap: 5, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }, label: { color: C.muted, fontSize: 13, fontWeight: "600" },
  error: { color: "#FF9AA8", fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, color: C.textPrimary, fontSize: 15, minHeight: 48, backgroundColor: C.surface },
  identity: { backgroundColor: C.primary, borderRadius: 15, padding: 20, gap: 8, alignItems: "center" },
  identityName: { color: C.white, fontSize: 20, fontWeight: "700", textAlign: "center" },
  identityText: { color: C.white, fontSize: 13, textAlign: "center" },
  stat: { flexGrow: 1, flexBasis: "30%", borderRadius: 12, backgroundColor: C.primary, padding: 14, gap: 6 },
  statValue: { color: C.white, fontSize: 24, fontWeight: "700" },
  statLabel: { color: C.white, fontSize: 12 },
});
