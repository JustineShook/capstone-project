import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeColors as colors } from "../../constants/owner/homeTheme";

export function BookingDetailsModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const closeRef = useRef<View>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => { document.removeEventListener("keydown", handleKey, true); previousFocus?.focus(); };
  }, [visible]);

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => {
    if (Platform.OS === "web") (closeRef.current as unknown as HTMLElement | null)?.focus();
  }}>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss booking details" />
      <View accessibilityViewIsModal style={[styles.card, { maxHeight: Math.max(160, height - insets.top - insets.bottom - 40) }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Booking Details</Text>
          <Pressable ref={closeRef} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close booking details" style={styles.close}>
            <Ionicons name="close" size={24} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, backgroundColor: "rgba(4,8,12,0.78)" },
  card: { width: "100%", maxWidth: 420, flexShrink: 1, backgroundColor: colors.surface, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  header: { minHeight: 68, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: "800", flexShrink: 1 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: 24, gap: 8 },
});
