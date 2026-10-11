// components/StatusPill.tsx
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/owner/theme";
import { getStatusLabel, ProviderCategory } from "../../data/owner/mockProviders";

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
