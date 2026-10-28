import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/owner/theme";

export function OpenGoogleMapsModal({
  visible,
  url,
  onCancel,
}: {
  visible: boolean;
  url: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) setError("");
  }, [visible, url]);

  const openMaps = async () => {
    try {
      await Linking.openURL(url);
      onCancel();
    } catch {
      setError("Unable to open Google Maps. Please check your connection or try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="navigate-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Open Google Maps?</Text>
          <Text style={styles.description}>
            You’re about to leave VeResc and open this location in Google Maps. Would you like to continue?
          </Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.openButton} onPress={() => void openMaps()} accessibilityRole="button">
            <Text style={styles.openButtonText}>Open Google Maps</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
  title: { color: colors.textPrimary, fontSize: 23, lineHeight: 29, fontWeight: "800" },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 17 },
  error: { color: "#FF9AA8", fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 13 },
  openButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primary },
  openButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  cancelButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 5 },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
});
