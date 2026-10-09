import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = { background: "#FFFFFF", card: "#FFFFFF", text: "#1A1A1A", muted: "#6B6B6B", border: "#EEE0E0", red: "#D32F2F" };

export function ShopBookingScreen({ title, children, scrollable = true }: { title: string; children: ReactNode; scrollable?: boolean }) {
  const router = useRouter();
  return <SafeAreaView style={styles.root} edges={["top"]}>
    <StatusBar barStyle="dark-content" backgroundColor={C.background} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)")}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </Pressable><Text style={styles.headerTitle}>{title}</Text><View style={{ width: 24 }} />
    </View>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {scrollable ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>{children}</ScrollView> : <View style={styles.fixedContent}>{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 17, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.background },
  headerTitle: { fontSize: 19, fontWeight: "700", color: C.text },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  fixedContent: { flex: 1, minHeight: 0, padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 11 },
  providerCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 16 },
  providerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "#6B6B6B", fontSize: 13, fontWeight: "600" },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  priceLabel: { color: "#6B6B6B", fontSize: 13 },
  priceValue: { color: "#1A1A1A", fontSize: 17, fontWeight: "700", marginTop: 4 },
  noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 2 },
  sectionSubtitle: { color: "#6B6B6B", fontSize: 14, lineHeight: 20, marginTop: -10 },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },
  emptyVehicleCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  emptyVehicleText: { flex: 1, color: C.text, fontSize: 15, fontWeight: "600" },
  changeLabel: { color: "#D32F2F", fontSize: 14, fontWeight: "700" },
  addressCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  addressLabel: { color: "#6B6B6B", fontSize: 13, fontWeight: "600" },
  addressValue: { color: "#1A1A1A", fontSize: 15, lineHeight: 21 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: { fontSize: 18, color: C.text, fontWeight: "700", flexShrink: 1 },
  text: { fontSize: 15, lineHeight: 22, color: C.text },
  muted: { fontSize: 14, lineHeight: 21, color: C.muted },
  label: { fontSize: 14, fontWeight: "700", color: C.muted },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, minHeight: 112, padding: 14, textAlignVertical: "top", fontSize: 16, color: C.text },
  error: { fontSize: 14, lineHeight: 21, color: "#FF9AA8" },
  selected: { borderColor: C.red, backgroundColor: "#FFF5F5" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "85%", backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
});
