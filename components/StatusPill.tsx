// components/StatusPill.tsx
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../constants/theme";
import { getStatusLabel, ProviderCategory } from "../data/mockProviders";

export function StatusPill({
  category,
  isPositive,
  compact,
}: {
  category: Exclude<ProviderCategory, "All">;
  isPositive: boolean;
  compact?: boolean;
}) {
  const label = getStatusLabel(category, isPositive);
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: isPositive ? colors.successLight : colors.busyLight },
        compact && styles.statusPillCompact,
      ]}
    >
      <View
        style={[styles.statusDot, { backgroundColor: isPositive ? colors.success : colors.busy }]}
      />
      <Text style={[styles.statusPillText, { color: isPositive ? colors.success : colors.busy }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  statusPillCompact: { marginTop: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" },
});