import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/owner/theme";

type ServiceProgressStep = { key: string; label: string };

export function ServiceProgress({
  steps,
  currentStep,
  terminalLabel,
}: {
  steps: ServiceProgressStep[];
  currentStep: number;
  terminalLabel?: string;
}) {
  const isComplete = currentStep >= steps.length - 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service progress</Text>
      {terminalLabel ? (
        <View style={styles.terminalStatus}>
          <Ionicons name="close-circle" size={19} color={colors.primary} />
          <Text style={styles.terminalText}>{terminalLabel}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          {steps.map((step, index) => {
            const done = index < currentStep || isComplete;
            const current = index === currentStep && !isComplete;
            return (
              <View key={step.key} style={styles.step}>
                <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                  {done && <Ionicons name="checkmark" size={11} color="#F4F6F8" />}
                </View>
                {index < steps.length - 1 && (
                  <View style={[styles.connector, index < currentStep && styles.connectorDone]} />
                )}
                <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]} numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, gap: 13 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  step: { flex: 1, alignItems: "center", position: "relative", gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#7E8B97", backgroundColor: "#151C23", alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { backgroundColor: "#1C252E", borderColor: colors.primary },
  connector: { position: "absolute", height: 2, backgroundColor: colors.border, left: "50%", right: "-50%", top: 10 },
  connectorDone: { backgroundColor: colors.primary },
  stepLabel: { color: colors.textMuted, fontSize: 9, lineHeight: 12, textAlign: "center" },
  stepLabelCurrent: { color: colors.primary, fontWeight: "800" },
  terminalStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#1C252E" },
  terminalText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
});
