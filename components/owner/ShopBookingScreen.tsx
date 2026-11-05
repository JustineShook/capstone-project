import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = { background: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", border: "#28313A", red: "#F52239" };

export function ShopBookingScreen({ formAppearance = false, sapphireHeader = false, title, children, footer, scrollable = true, onBack }: { formAppearance?: boolean; sapphireHeader?: boolean; title: string; children: ReactNode; footer?: ReactNode; scrollable?: boolean; onBack?: () => void }) {
  const styles = formAppearance ? bookingFormStyles : defaultFrameStyles;
  const router = useRouter();
  const scrollContent = <ScrollView style={sapphireHeader ? { flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 } : undefined} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>{children}</ScrollView>;
  return <SafeAreaView style={styles.root} edges={sapphireHeader ? [] : ["top"]}>
    <StatusBar barStyle={sapphireHeader ? "light-content" : "light-content"} backgroundColor={sapphireHeader ? "#0F52BA" : C.background} />
    <SafeAreaView style={[styles.header, sapphireHeader && { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 }]} edges={sapphireHeader ? ["top"] : []}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace("/(v_owner)"))}>
        <Ionicons name="chevron-back" size={24} color={sapphireHeader ? "#FFFFFF" : C.text} />
      </Pressable><Text style={[styles.headerTitle, sapphireHeader && { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>{title}</Text><View style={{ width: 24 }} />
    </SafeAreaView>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : formAppearance ? "height" : undefined}>
      {scrollable ? sapphireHeader ? <View style={{ flex: 1, backgroundColor: "#0F52BA" }}>{scrollContent}</View> : scrollContent : <View style={styles.fixedContent}>{children}</View>}
      {footer ? <SafeAreaView edges={["bottom"]} style={styles.footer}>{footer}</SafeAreaView> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 17, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.background },
  headerTitle: { fontSize: 19, fontWeight: "700", color: C.text },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  footer: { backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border },
  fixedContent: { flex: 1, minHeight: 0, padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 11 },
  providerCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 16 },
  providerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#3A2025", alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "#AAB5C0", fontSize: 13, fontWeight: "600" },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  priceLabel: { color: "#AAB5C0", fontSize: 13 },
  priceValue: { color: "#F4F6F8", fontSize: 17, fontWeight: "700", marginTop: 4 },
  noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 2 },
  sectionSubtitle: { color: "#AAB5C0", fontSize: 14, lineHeight: 20, marginTop: -10 },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#3A2025", alignItems: "center", justifyContent: "center" },
  emptyVehicleCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  emptyVehicleText: { flex: 1, color: C.text, fontSize: 15, fontWeight: "600" },
  changeLabel: { color: "#F52239", fontSize: 14, fontWeight: "700" },
  addressCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  addressLabel: { color: "#AAB5C0", fontSize: 13, fontWeight: "600" },
  addressValue: { color: "#F4F6F8", fontSize: 15, lineHeight: 21 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: { fontSize: 18, color: C.text, fontWeight: "700", flexShrink: 1 },
  text: { fontSize: 15, lineHeight: 22, color: C.text },
  muted: { fontSize: 14, lineHeight: 21, color: C.muted },
  label: { fontSize: 14, fontWeight: "700", color: C.muted },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, minHeight: 112, padding: 14, textAlignVertical: "top", fontSize: 16, color: C.text },
  error: { fontSize: 14, lineHeight: 21, color: "#FF9AA8" },
  selected: { borderColor: C.red, backgroundColor: "#1C252E" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "85%", backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
});

const defaultFrameStyles = styles;
export const bookingFormStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homeColors.background },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: homeColors.border, backgroundColor: homeColors.background },
  headerTitle: { fontSize: 19, fontWeight: "700", color: homeColors.textPrimary },
  content: { padding: 16, paddingBottom: 24, gap: 8 },
  footer: { backgroundColor: homeColors.background, borderTopWidth: 1, borderTopColor: homeColors.border },
  fixedContent: { flex: 1, minHeight: 0, padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: homeColors.border, backgroundColor: homeColors.surface, borderRadius: 20, padding: 16, gap: 11 },
  providerCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: homeColors.border, backgroundColor: homeColors.surface, borderRadius: 20, padding: 16 , flexWrap: "wrap" },
  providerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: homeColors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: homeColors.textSecondary, fontSize: 13, fontWeight: "400" , lineHeight: 19 },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 16 , flexWrap: "wrap", gap: 8 },
  priceLabel: { color: homeColors.textSecondary, fontSize: 13 , lineHeight: 19, fontWeight: "500" },
  priceValue: { color: homeColors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 4 , lineHeight: 25 },
  noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 2 },
  sectionSubtitle: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 0 , fontWeight: "400", marginBottom: 0 },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 11 , flexWrap: "wrap" },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: homeColors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  emptyVehicleCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: homeColors.border, backgroundColor: homeColors.surface, borderRadius: 20, padding: 16 },
  emptyVehicleText: { flex: 1, color: homeColors.textPrimary, fontSize: 15, fontWeight: "600" },
  changeLabel: { color: homeColors.primary, fontSize: 15, fontWeight: "700" , lineHeight: 20 },
  addressCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 12, padding: 16 },
  addressLabel: { color: homeColors.textSecondary, fontSize: 13, fontWeight: "500" , lineHeight: 19 },
  addressValue: { color: homeColors.textPrimary, fontSize: 15, lineHeight: 22 , fontWeight: "400" },
  row: { flexDirection: "row", gap: 12, alignItems: "center" , flexWrap: "wrap" },
  title: { fontSize: 18, color: homeColors.textPrimary, fontWeight: "700", flexShrink: 1 , lineHeight: 25 },
  text: { fontSize: 15, lineHeight: 22, color: homeColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: homeColors.textSecondary , fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 19, fontWeight: "500", color: homeColors.textSecondary },
  input: { maxHeight: 160, borderWidth: 1, borderColor: homeColors.border, backgroundColor: homeColors.surface, borderRadius: 12, minHeight: 112, padding: 16, textAlignVertical: "top", fontSize: 15, lineHeight: 22, color: homeColors.textPrimary },
  error: { fontSize: 13, lineHeight: 19, color: homeColors.busy , fontWeight: "400", marginTop: 8, marginBottom: 8 },
  selected: { borderColor: homeColors.primary, backgroundColor: homeColors.surfaceAlt },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "85%", backgroundColor: homeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
});
