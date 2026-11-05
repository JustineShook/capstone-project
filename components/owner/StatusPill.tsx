// components/StatusPill.tsx
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/owner/theme";
import { homeColors } from "../../constants/owner/homeTheme";
import { getStatusLabel, ProviderCategory } from "../../data/owner/mockProviders";

export function StatusPill({
  category,
  isPositive,
  compact,
  homeAppearance = false,
}: {
  category: Exclude<ProviderCategory, "All">;
  isPositive: boolean;
  compact?: boolean;
  homeAppearance?: boolean;
}) {
  const palette = homeAppearance ? homeColors : colors;
  const label = getStatusLabel(category, isPositive);
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: isPositive ? palette.successLight : palette.busyLight },
        compact && styles.statusPillCompact,
      ]}
    >
      <View
        style={[styles.statusDot, { backgroundColor: isPositive ? palette.success : palette.busy }]}
      />
      <Text style={[styles.statusPillText, { color: isPositive ? palette.success : palette.busy }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  statusPillCompact: { marginTop: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 13, lineHeight: 17, fontWeight: "700" },
});
