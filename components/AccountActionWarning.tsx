import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export function AccountActionWarning({ count, error }: { count: number; error?: string | null }) {
  if (count < 3 && !error) return null;
  const review = count >= 4;
  return <View accessibilityLiveRegion="polite" style={s.card}>
    <Feather name={error ? "alert-circle" : review ? "flag" : "alert-triangle"} size={19} color="#FFB45C" />
    <View style={s.copy}>
      <Text style={s.title}>{error ? "Activity count unavailable" : review ? "Account review notice" : "Account activity warning"}</Text>
      <Text style={s.message}>{error || (review
        ? `${count} eligible actions were recorded in the last 30 days. Your account has been flagged for admin review.`
        : `${count} eligible actions were recorded in the last 30 days. Repeated cancellations or declines may be reviewed.`)}</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginHorizontal: 16, marginTop: 12, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#725326", backgroundColor: "#292317" },
  copy: { flex: 1, gap: 4 },
  title: { color: "#FFE0A8", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  message: { color: "#E3D2B1", fontSize: 12, lineHeight: 18 },
});
