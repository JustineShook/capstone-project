import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createContext, useContext, type ReactNode } from "react";
import { homeColors } from "../../constants/owner/homeTheme";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";
import { SHOP_STATUS_LABELS, type ShopBookingStatus } from "../../types/shopBooking";

export const C = { ...colors, primary: "#F52239", background: "#090A0C", surface: "#191A1D", surfaceAlt: "#202124", textPrimary: "#ECE8E6", textSecondary: "#B7B2B0", textMuted: "#9A9694", border: "#303135", muted: "#B7B2B0", section: "#202124", white: "#F7EFED", busyLight: "#342B1E", successLight: "#163B2B", success: "#49B982" };

const ShopAppearanceContext = createContext(false);
export function ShopUIAppearanceProvider({ children }: { children: ReactNode }) { return <ShopAppearanceContext.Provider value={true}>{children}</ShopAppearanceContext.Provider>; }
export function useShopUI() { const light = useContext(ShopAppearanceContext); return { light, C: light ? lightShopColors : C, s: light ? lightShopStyles : s }; }

export function ShopScreen({ title, children, back = false, scrollable = true }: { title: string; children: ReactNode; back?: boolean; scrollable?: boolean }) {
  const { C, s, light } = useShopUI();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={light ? C.primary : C.background} />
    <View style={[s.header, { paddingTop: light ? 14 : insets.top + 14 }]}>
      {back && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to requests"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)/requests")} style={s.iconButton}>
        <Feather name="arrow-left" size={22} color={C.white} />
      </TouchableOpacity>}
      <View style={s.flex}><Text style={s.headerTitle}>{title}</Text><Text style={s.headerSubtitle}>VeResc · Shop Owner</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shop profile" style={s.iconButton}
        onPress={() => router.navigate("/(shop-owner)/profile")}><Feather name="user" size={22} color={C.white} /></TouchableOpacity>
    </View>
    {scrollable ? <ScrollView style={light ? lightShopStyles.scroll : undefined} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={s.fixedContent}>{children}</View>}
  </SafeAreaView>;
}

export function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const { C, s, light } = useShopUI();
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[s.button, secondary && s.secondaryButton, disabled && s.disabled]}>
    <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
  </TouchableOpacity>;
}

export function LoadState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  const { C, s, light } = useShopUI();
  if (!loading && !error) return null;
  return <View style={s.card}>{loading ? <ActivityIndicator accessibilityLabel="Loading" color={C.primary} /> : <>
    <Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Try Again" onPress={retry} />
  </>}</View>;
}

export function StatusBadge({ status }: { status: ShopBookingStatus }) {
  const { C, s, light } = useShopUI();
  const complete = status === "completed";
  const terminal = status === "rejected" || status === "cancelled";
  return <View style={[s.badge, complete && { backgroundColor: C.successLight }, terminal && { backgroundColor: C.section }]}>
    <Text style={[s.badgeText, complete && { color: C.success }, terminal && { color: C.muted }]}>
      {SHOP_STATUS_LABELS[status] ?? "Unknown status"}
    </Text>
  </View>;
}

export function Info({ label, value }: { label: string; value: string }) {
  const { C, s, light } = useShopUI();
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

export const lightShopColors: typeof C = { ...C, ...homeColors, muted: homeColors.textSecondary, section: homeColors.surfaceAlt };
const lightShopStyles = StyleSheet.create({
  ...s,
  safe: { ...s.safe, backgroundColor: homeColors.primary },
  header: { ...s.header, backgroundColor: homeColors.primary, minHeight: 66, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0 },
  headerTitle: { ...s.headerTitle, color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "700" },
  headerSubtitle: { ...s.headerSubtitle, color: "#EAF2FF", fontSize: 13, lineHeight: 18 },
  iconButton: { ...s.iconButton, borderRadius: 14, minWidth: 44, minHeight: 48, backgroundColor: "rgba(255,255,255,.14)" },
  scroll: { flex: 1, backgroundColor: homeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  content: { ...s.content, padding: 16, gap: 13, backgroundColor: homeColors.background },
  fixedContent: { ...s.fixedContent, backgroundColor: homeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  card: { ...s.card, backgroundColor: homeColors.surface, borderColor: homeColors.border, borderRadius: 20, padding: 16, gap: 12, shadowColor: "#000000", shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  heading: { ...s.heading, color: homeColors.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  title: { ...s.title, color: homeColors.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: "700" },
  text: { ...s.text, color: homeColors.textPrimary, fontSize: 13, lineHeight: 19, flex: 1, textAlign: "right" },
  muted: { ...s.muted, color: homeColors.textSecondary, fontSize: 13, lineHeight: 19 },
  button: { ...s.button, minHeight: 54, borderRadius: 14, backgroundColor: homeColors.primary, justifyContent: "center" },
  buttonText: { ...s.buttonText, color: "#FFFFFF", fontSize: 14, lineHeight: 18 },
  secondaryButton: { ...s.secondaryButton, backgroundColor: homeColors.surfaceAlt, borderColor: homeColors.border },
  secondaryText: { color: homeColors.textPrimary },
  badge: { ...s.badge, backgroundColor: "#FFF4E5", borderRadius: 999 },
  badgeText: { ...s.badgeText, color: "#9A5B00", lineHeight: 16 },
  info: { ...s.info, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 8, borderTopColor: homeColors.border },
  label: { ...s.label, width: 90, color: homeColors.textSecondary, fontSize: 12, lineHeight: 19 },
  error: { ...s.error, color: homeColors.busy, fontSize: 13, lineHeight: 19 },
  input: { ...s.input, color: homeColors.textPrimary, backgroundColor: homeColors.surfaceAlt, borderColor: homeColors.border, borderRadius: 12 },
});
