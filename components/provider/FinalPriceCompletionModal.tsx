import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { formatPesoAmount, parseFinalPriceInput } from "../../utils/finalPrice";

type Props = {
  appearance?: "default" | "mechanic";
  visible: boolean;
  estimatedPrice?: number;
  referencePriceLabel?: string;
  saving?: boolean;
  onCancel: () => void;
  onReview: (amount: number, completionNote: string) => void;
};

const C = { canvas: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", line: "#354249", red: "#F51F3B", green: "#173B2A" };
const MECHANIC = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", line: "#D5DEE9", red: "#B4233A", primary: "#0F52BA", green: "#EAF6EE", greenText: "#166534", subtle: "#F1F5F9" };

export function FinalPriceCompletionModal({ appearance = "default", visible, estimatedPrice, referencePriceLabel = "Estimated Price", saving = false, onCancel, onReview }: Props) {
  const [value, setValue] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setValue(typeof estimatedPrice === "number" && Number.isFinite(estimatedPrice) ? String(estimatedPrice) : "");
      setCompletionNote("");
      setError("");
    }
  }, [visible, estimatedPrice]);

  const review = () => {
    const amount = parseFinalPriceInput(value);
    if (amount == null) {
      setError("Enter a valid amount from ₱0 to ₱100,000,000 with up to two decimal places.");
      return;
    }
    setError("");
    onReview(amount, completionNote.trim());
  };

  const mechanicAppearance = appearance === "mechanic";
  const s = mechanicAppearance ? mechanicStyles : defaultStyles;
  const colors = mechanicAppearance ? MECHANIC : C;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableOpacity style={s.scrim} activeOpacity={1} onPress={onCancel} accessibilityLabel="Close final price form" />
      <View style={s.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.headingRow}><View style={s.headingIcon}><Feather name="check-circle" size={20} color={mechanicAppearance ? MECHANIC.greenText : C.green} /></View><View style={s.headingCopy}><Text style={s.title}>Complete Job</Text><Text style={s.subtitle}>Enter the final service charge in Philippine pesos.</Text></View><TouchableOpacity onPress={onCancel} style={s.close} accessibilityRole="button" accessibilityLabel="Close"><Feather name="x" size={21} color={colors.muted} /></TouchableOpacity></View>
          {typeof estimatedPrice === "number" && Number.isFinite(estimatedPrice) ? <View style={s.estimate}><Text style={s.estimateLabel}>{referencePriceLabel}</Text><Text style={s.estimateValue}>{formatPesoAmount(estimatedPrice)}</Text></View> : null}
          <Text style={s.fieldLabel}>Final Price <Text style={s.required}>*</Text></Text>
          <View style={[s.inputWrap, error ? s.inputError : null]}><Text style={s.currency}>₱</Text><TextInput accessibilityLabel="Final price in Philippine pesos" value={value} onChangeText={(next) => { setValue(next); if (error) setError(""); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={mechanicAppearance ? "#7A8797" : "#69757D"} style={s.input} maxLength={12} returnKeyType="done" onSubmitEditing={review} /></View>
          {error ? <Text style={s.error}>{error}</Text> : <Text style={s.hint}>Up to two decimal places · Maximum ₱100,000,000</Text>}
          <Text style={s.fieldLabel}>Service Completion Notes <Text style={s.optional}>(optional)</Text></Text>
          <TextInput accessibilityLabel="Service Completion Notes" value={completionNote} onChangeText={setCompletionNote} maxLength={160} multiline placeholder="Summarize the work performed, findings, or towing outcome" placeholderTextColor={mechanicAppearance ? "#7A8797" : "#69757D"} style={s.noteInput} textAlignVertical="top" />
          <Text style={s.hint}>{completionNote.length}/160 characters</Text>
          <View style={[s.notice, mechanicAppearance && { backgroundColor: MECHANIC.subtle }]}><Feather name="info" size={16} color={mechanicAppearance ? MECHANIC.primary : "#8EBBEA"} /><Text style={s.noticeText}>This records the service charge only. It does not mark the booking paid or process a payment.</Text></View>
          <TouchableOpacity style={[s.primary, saving && s.disabled]} onPress={review} disabled={saving} accessibilityRole="button"><Text style={s.primaryText}>{saving ? "Saving..." : "Complete Service"}</Text></TouchableOpacity>
          <TouchableOpacity style={s.secondary} onPress={onCancel} disabled={saving} accessibilityRole="button"><Text style={s.secondaryText}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const makeStyles = (colors: typeof C, mechanic = false) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.58)" },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: { width: "100%", maxWidth: 520, maxHeight: "90%", backgroundColor: colors.canvas, borderRadius: mechanic ? 20 : 22, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  content: { padding: 20, paddingTop: 17, gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 3 },
  headingIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: mechanic ? MECHANIC.green : C.green, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  close: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  estimate: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  estimateLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  estimateValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 3 },
  required: { color: colors.red },
  inputWrap: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  inputError: { borderColor: colors.red },
  currency: { color: colors.muted, fontSize: 19, fontWeight: "700" },
  input: { flex: 1, color: colors.text, fontSize: 21, fontWeight: "700", paddingVertical: 12 },
  hint: { color: colors.muted, fontSize: 11, marginTop: -5 },
  optional: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  noteInput: { minHeight: 88, maxHeight: 150, color: colors.text, fontSize: 14, lineHeight: 20, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  error: { color: mechanic ? "#B4233A" : "#FF9DA8", fontSize: 12, marginTop: -5 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 11, borderRadius: 11, backgroundColor: mechanic ? MECHANIC.subtle : "#14212C", marginTop: 3 },
  noticeText: { flex: 1, color: mechanic ? "#526277" : "#C9D9E6", fontSize: 12, lineHeight: 18 },
  primary: { minHeight: mechanic ? 54 : 51, borderRadius: mechanic ? 14 : 13, backgroundColor: mechanic ? MECHANIC.primary : colors.red, alignItems: "center", justifyContent: "center", marginTop: 5 },
  disabled: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontSize: mechanic ? 14 : 15, fontWeight: "800" },
  secondary: { minHeight: 43, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
});
const defaultStyles = makeStyles(C);
const mechanicStyles = makeStyles(MECHANIC, true);
