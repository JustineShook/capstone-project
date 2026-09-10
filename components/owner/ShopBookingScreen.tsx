import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";

/** Customer booking shell follows the existing mechanic/towing white header and cards. */
export function ShopBookingScreen({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return <SafeAreaView style={styles.root} edges={["top"]}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)")}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable><Text style={styles.headerTitle}>{title}</Text><View style={{ width: 24 }} />
    </View>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: { fontSize: 17, color: colors.textPrimary, fontWeight: "700" },
  text: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  muted: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 100, padding: 14, textAlignVertical: "top", fontSize: 14, color: colors.textPrimary },
  error: { fontSize: 13, lineHeight: 20, color: colors.primary },
  selected: { borderColor: colors.primary, backgroundColor: "#FFF5F5" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" },
  modalSheet: { maxHeight: "85%", backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
});
