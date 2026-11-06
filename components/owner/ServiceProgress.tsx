import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/owner/theme";

type ServiceProgressStep = { key: string; label: string };

export function ServiceProgress({ homeAppearance = false,
  steps,
  currentStep,
  terminalLabel,
}: { homeAppearance?: boolean;
  steps: ServiceProgressStep[];
  currentStep: number;
  terminalLabel?: string;
}) {
  const colors = homeAppearance ? homeColors : defaultColors;
  const styles = homeAppearance ? lightStyles : defaultStyles;
  const isComplete = currentStep >= steps.length - 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service progress</Text>
      {terminalLabel ? (
        <View style={styles.terminalStatus}>
          <Ionicons name="close-circle" size={19} color={homeAppearance ? homeColors.busy : colors.primary} />
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

const defaultColors = colors;
const makeStyles = (colors: typeof defaultColors) => StyleSheet.create({
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
const defaultStyles = makeStyles(defaultColors);
const lightStyles = { ...makeStyles(homeColors), ...StyleSheet.create({
  card: { shadowColor: "#172B4D", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2, backgroundColor: homeColors.surface, borderWidth: 1, borderColor: homeColors.border, borderRadius: 20, padding: 14, gap: 13 },
  title: { color: homeColors.textPrimary, fontSize: 16, fontWeight: "700", lineHeight: 22},
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: homeColors.textSecondary, backgroundColor: homeColors.surfaceAlt, alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotDone: { backgroundColor: homeColors.primary, borderColor: homeColors.primary },
  dotCurrent: { backgroundColor: homeColors.surfaceAlt, borderColor: homeColors.primary },
  connector: { position: "absolute", height: 2, backgroundColor: homeColors.border, left: "50%", right: "-50%", top: 10 },
  connectorDone: { backgroundColor: homeColors.primary },
  stepLabel: { color: homeColors.textMuted, fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "500" },
  stepLabelCurrent: { color: homeColors.primary, fontWeight: "800" },
  terminalStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: homeColors.surfaceAlt },
  terminalText: { color: homeColors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 19},
}) };
