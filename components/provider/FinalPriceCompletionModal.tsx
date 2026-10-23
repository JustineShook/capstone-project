import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPesoAmount, parseFinalPriceInput } from "../../utils/finalPrice";

type Props = {
  visible: boolean;
  estimatedPrice?: number;
  referencePriceLabel?: string;
  saving?: boolean;
  onCancel: () => void;
  onReview: (amount: number) => void;
};

const C = { canvas: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", line: "#354249", red: "#F51F3B", green: "#173B2A" };

export function FinalPriceCompletionModal({ visible, estimatedPrice, referencePriceLabel = "Estimated Price", saving = false, onCancel, onReview }: Props) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setValue(typeof estimatedPrice === "number" && Number.isFinite(estimatedPrice) ? String(estimatedPrice) : "");
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
    onReview(amount);
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableOpacity style={s.scrim} activeOpacity={1} onPress={onCancel} accessibilityLabel="Close final price form" />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.headingRow}><View style={s.headingIcon}><Feather name="check-circle" size={20} color={C.green} /></View><View style={s.headingCopy}><Text style={s.title}>Complete Job</Text><Text style={s.subtitle}>Enter the final service charge in Philippine pesos.</Text></View><TouchableOpacity onPress={onCancel} style={s.close} accessibilityRole="button" accessibilityLabel="Close"><Feather name="x" size={21} color={C.muted} /></TouchableOpacity></View>
          {typeof estimatedPrice === "number" && Number.isFinite(estimatedPrice) ? <View style={s.estimate}><Text style={s.estimateLabel}>{referencePriceLabel}</Text><Text style={s.estimateValue}>{formatPesoAmount(estimatedPrice)}</Text></View> : null}
          <Text style={s.fieldLabel}>Final Price <Text style={s.required}>*</Text></Text>
          <View style={[s.inputWrap, error ? s.inputError : null]}><Text style={s.currency}>₱</Text><TextInput accessibilityLabel="Final price in Philippine pesos" value={value} onChangeText={(next) => { setValue(next); if (error) setError(""); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#69757D" style={s.input} maxLength={12} returnKeyType="done" onSubmitEditing={review} /></View>
          {error ? <Text style={s.error}>{error}</Text> : <Text style={s.hint}>Up to two decimal places · Maximum ₱100,000,000</Text>}
          <View style={s.notice}><Feather name="info" size={16} color="#8EBBEA" /><Text style={s.noticeText}>This records the service charge only. It does not mark the booking paid or process a payment.</Text></View>
          <TouchableOpacity style={[s.primary, saving && s.disabled]} onPress={review} disabled={saving} accessibilityRole="button"><Text style={s.primaryText}>{saving ? "Saving..." : "Review Final Price"}</Text></TouchableOpacity>
          <TouchableOpacity style={s.secondary} onPress={onCancel} disabled={saving} accessibilityRole="button"><Text style={s.secondaryText}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: { maxHeight: "90%", backgroundColor: C.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: C.line },
  content: { padding: 20, paddingTop: 17, gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 3 },
  headingIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1 },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  close: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  estimate: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  estimateLabel: { color: C.muted, fontSize: 13, fontWeight: "600" },
  estimateValue: { color: C.text, fontSize: 16, fontWeight: "800" },
  fieldLabel: { color: C.text, fontSize: 14, fontWeight: "700", marginTop: 3 },
  required: { color: C.red },
  inputWrap: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  inputError: { borderColor: C.red },
  currency: { color: C.muted, fontSize: 19, fontWeight: "700" },
  input: { flex: 1, color: C.text, fontSize: 21, fontWeight: "700", paddingVertical: 12 },
  hint: { color: C.muted, fontSize: 11, marginTop: -5 },
  error: { color: "#FF9DA8", fontSize: 12, marginTop: -5 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 11, borderRadius: 11, backgroundColor: "#14212C", marginTop: 3 },
  noticeText: { flex: 1, color: "#C9D9E6", fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 51, borderRadius: 13, backgroundColor: C.red, alignItems: "center", justifyContent: "center", marginTop: 5 },
  disabled: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondary: { minHeight: 43, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: C.muted, fontSize: 14, fontWeight: "700" },
});
