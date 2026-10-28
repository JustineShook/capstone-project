import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../constants/owner/theme";

export function CancelRequestModal({
  visible,
  serviceName,
  explanation,
  isCancelling,
  onKeep,
  onConfirm,
  reason,
  onReasonChange,
}: {
  visible: boolean;
  serviceName: string;
  explanation: string;
  isCancelling: boolean;
  onKeep: () => void;
  onConfirm: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="close-circle-outline" size={34} color={colors.primary} />
          </View>
          <View style={styles.eyebrowWrap}>
            <Ionicons name="alert-circle-outline" size={13} color="#FF9AA8" />
            <Text style={styles.eyebrow}>CANCEL SERVICE REQUEST</Text>
          </View>
          <Text style={styles.title}>Cancel this request?</Text>
          <Text style={styles.description}>{explanation}</Text>
          <Text style={styles.reasonLabel}>Reason (required)</Text>
          <Text style={styles.sharedHint}>Your reason will be shared with the provider.</Text>
          <TextInput value={reason} onChangeText={onReasonChange} editable={!isCancelling} multiline maxLength={500} placeholder="Tell the provider why you are cancelling" placeholderTextColor={colors.textSecondary} style={styles.reasonInput} accessibilityLabel="Required cancellation reason" />
          <View style={styles.serviceBadge}>
            <Ionicons name="construct-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.serviceText}>{serviceName} request</Text>
          </View>
          <Pressable
            style={[styles.cancelButton, isCancelling && styles.disabled]}
            onPress={onConfirm}
            disabled={isCancelling || !reason.trim()}
            accessibilityRole="button"
          >
            {isCancelling ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Ionicons name="close-outline" size={18} color="#FFFFFF" />
              <Text style={styles.cancelButtonText}>Cancel request</Text>
            </>}
          </Pressable>
          <Pressable style={styles.keepButton} onPress={onKeep} disabled={isCancelling} accessibilityRole="button">
            <Text style={styles.keepButtonText}>Keep request</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(4,8,12,0.78)" },
  card: { width: "100%", maxWidth: 410, padding: 23, borderRadius: 25, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#351D24", borderWidth: 1, borderColor: "#63313C", marginBottom: 17 },
  eyebrowWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  eyebrow: { color: "#FF9AA8", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: 23, lineHeight: 29, fontWeight: "800" },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 17 },
  serviceBadge: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
  serviceText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  cancelButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 14, backgroundColor: colors.primary },
  cancelButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  reasonLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "800", marginBottom: 4 },
  sharedHint: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  reasonInput: { minHeight: 86, maxHeight: 150, textAlignVertical: "top", color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 15 },
  keepButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 5 },
  keepButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
});
