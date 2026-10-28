import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../constants/owner/theme";

export function DeclineRequestModal({ visible, reason, saving, onReasonChange, onCancel, onConfirm }: {
  visible: boolean; reason: string; saving: boolean; onReasonChange: (value: string) => void; onCancel: () => void; onConfirm: () => void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.backdrop}><View style={s.card}>
      <View style={s.icon}><Feather name="slash" size={27} color={colors.primary} /></View>
      <Text style={s.eyebrow}>DECLINE SERVICE REQUEST</Text><Text style={s.title}>Decline this request?</Text>
      <Text style={s.copy}>Please provide a reason. Your reason will be shared with the vehicle owner.</Text>
      <Text style={s.label}>Reason (required)</Text>
      <TextInput value={reason} onChangeText={onReasonChange} editable={!saving} multiline maxLength={500} placeholder="Explain why you cannot accept this request" placeholderTextColor={colors.textSecondary} style={s.input} accessibilityLabel="Required decline reason" />
      <Pressable style={[s.primary, (saving || !reason.trim()) && s.disabled]} disabled={saving || !reason.trim()} onPress={onConfirm} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Decline Request</Text>}
      </Pressable>
      <Pressable style={s.secondary} disabled={saving} onPress={onCancel} accessibilityRole="button"><Text style={s.secondaryText}>Keep Request</Text></Pressable>
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(4,8,12,0.78)" },
  card: { width: "100%", maxWidth: 410, padding: 23, borderRadius: 25, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#351D24", borderWidth: 1, borderColor: "#63313C", marginBottom: 15 },
  eyebrow: { color: "#FF9AA8", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  title: { color: colors.textPrimary, fontSize: 23, lineHeight: 29, fontWeight: "800" },
  copy: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 16 },
  label: { color: colors.textPrimary, fontSize: 13, fontWeight: "800", marginBottom: 7 },
  input: { minHeight: 86, maxHeight: 150, textAlignVertical: "top", color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 15 },
  primary: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primary },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, disabled: { opacity: 0.55 },
  secondary: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 5 }, secondaryText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
});
