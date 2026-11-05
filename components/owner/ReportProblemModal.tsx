import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../constants/owner/theme";
import { COMPLAINT_CATEGORIES, type ComplaintBooking, type ComplaintCategory } from "../../types/complaint";
import { submitComplaint } from "../../services/complaintService";
import { auth } from "../../services/firebase";

export function ReportProblemAction({ homeAppearance = false, booking }: { homeAppearance?: boolean; booking: ComplaintBooking }) {
  const colors = homeAppearance ? homeColors : defaultColors;
  const s = homeAppearance ? lightStyles : defaultStyles;
  const [visible, setVisible] = useState(false);
  const user = auth.currentUser;
  if (!user || (user.uid !== booking.customerId && user.uid !== booking.providerId)) return null;
  const active = ["accepted", "en_route", "arrived", "in_progress", "vehicle_arrived", "diagnosing", "repairing"].includes(booking.status);
  const completed = booking.status === "completed" && booking.completedAt;
  const completionDate = completed && typeof booking.completedAt === "object" && booking.completedAt.toDate
    ? booking.completedAt.toDate() : typeof booking.completedAt === "string" ? new Date(booking.completedAt) : null;
  if (!active && !(completionDate && !Number.isNaN(completionDate.getTime()) && Date.now() - completionDate.getTime() <= 7 * 86400000)) return null;
  return <><Pressable style={s.reportAction} accessibilityRole="button" onPress={() => setVisible(true)}>{homeAppearance && <Ionicons name="flag-outline" size={18} color={homeColors.primary} accessible={false} />}<Text style={s.reportActionText}>Report a Problem</Text></Pressable><ReportProblemModal homeAppearance={homeAppearance} visible={visible} booking={booking} onClose={() => setVisible(false)} /></>;
}

export function ReportProblemModal({ homeAppearance = false, visible, booking, onClose }: { homeAppearance?: boolean; visible: boolean; booking: ComplaintBooking; onClose: () => void }) {
  const colors = homeAppearance ? homeColors : defaultColors;
  const s = homeAppearance ? lightStyles : defaultStyles;
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const reset = () => { setCategory(null); setExplanation(""); setSuccess(false); setError(""); onClose(); };
  async function submit() {
    if (!category || explanation.trim().length < 10) { setError("Choose a category and explain the problem in at least 10 characters."); return; }
    setSaving(true); setError("");
    try { await submitComplaint(booking, category, explanation); setSuccess(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit the report. Please try again."); }
    finally { setSaving(false); }
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
    <View style={s.overlay}><View style={s.card}>
      <Text style={s.title}>{success ? "Report submitted" : "Report a Problem"}</Text>
      {success ? <><Text style={s.copy}>Your report is linked to this booking and has been sent to VeResc for review.</Text><Pressable onPress={reset} style={s.primary}><Text style={s.primaryText}>Done</Text></Pressable></> : <>
        <Text style={s.copy}>Choose a category and describe the issue. Only you and VeResc admins can view this report.</Text>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Category <Text style={s.required}>*</Text></Text>
          <View style={s.categories}>{COMPLAINT_CATEGORIES.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[s.category, category === item && s.categorySelected]}><Text style={[s.categoryText, category === item && s.categoryTextSelected]}>{item}</Text></Pressable>)}</View>
          <Text style={s.label}>Explanation <Text style={s.required}>*</Text></Text>
          <TextInput value={explanation} onChangeText={setExplanation} editable={!saving} multiline maxLength={2000} textAlignVertical="top" placeholder="Describe what happened…" placeholderTextColor={colors.textMuted} style={s.input} />
          <Text style={s.counter}>{explanation.trim().length}/2000 characters</Text>
        </ScrollView>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <View style={s.actions}><Pressable onPress={reset} disabled={saving} style={s.secondary}><Text style={s.secondaryText}>Cancel</Text></Pressable><Pressable onPress={() => void submit()} disabled={saving || !category || explanation.trim().length < 10} style={[s.primary, (saving || !category || explanation.trim().length < 10) && s.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.primaryText}>Submit Report</Text>}</Pressable></View>
      </>}
    </View></View>
  </Modal>;
}

const defaultColors = colors;
const makeStyles = (colors: typeof defaultColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.66)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 480, maxHeight: "88%", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" }, copy: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 16 }, scroll: { flexGrow: 0 }, label: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 }, required: { color: colors.primary },
  categories: { gap: 7, marginBottom: 8 }, category: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surfaceAlt }, categorySelected: { borderColor: colors.primary, backgroundColor: "#3A2027" }, categoryText: { color: colors.textSecondary, fontSize: 13 }, categoryTextSelected: { color: colors.textPrimary, fontWeight: "700" },
  input: { minHeight: 112, maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 12, color: colors.textPrimary, backgroundColor: colors.background, fontSize: 14, lineHeight: 20 }, counter: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: 5 }, error: { color: colors.primary, fontSize: 12, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 18 }, primary: { minHeight: 44, borderRadius: 11, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }, primaryText: { color: colors.white, fontSize: 14, fontWeight: "700" }, secondary: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }, secondaryText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" }, disabled: { opacity: 0.45 },
  reportAction: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.primary, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, marginVertical: 8 }, reportActionText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
const defaultStyles = makeStyles(defaultColors);
const lightStyles = { ...makeStyles(homeColors), ...StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.66)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 480, maxHeight: "88%", backgroundColor: homeColors.surface, borderRadius: 20, borderWidth: 1, borderColor: homeColors.border, padding: 20 },
  title: { color: homeColors.textPrimary, fontSize: 20, fontWeight: "800" }, copy: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 16 }, scroll: { flexGrow: 0 }, label: { color: homeColors.textPrimary, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 }, required: { color: homeColors.busy },
  categories: { gap: 7, marginBottom: 8 }, category: { borderWidth: 1, borderColor: homeColors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: homeColors.surfaceAlt }, categorySelected: { borderColor: homeColors.primary, backgroundColor: homeColors.surfaceAlt }, categoryText: { color: homeColors.textSecondary, fontSize: 13 }, categoryTextSelected: { color: homeColors.textPrimary, fontWeight: "700" },
  input: { minHeight: 112, maxHeight: 180, borderWidth: 1, borderColor: homeColors.border, borderRadius: 11, padding: 12, color: homeColors.textPrimary, backgroundColor: homeColors.background, fontSize: 14, lineHeight: 20 }, counter: { color: homeColors.textMuted, fontSize: 11, textAlign: "right", marginTop: 5 }, error: { color: homeColors.busy, fontSize: 12, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 18 }, primary: { minHeight: 54, borderRadius: 11, backgroundColor: homeColors.primary, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }, primaryText: { color: homeColors.white, fontSize: 14, fontWeight: "700" }, secondary: { minHeight: 54, borderRadius: 11, borderWidth: 1, borderColor: homeColors.border, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }, secondaryText: { color: homeColors.textPrimary, fontSize: 14, fontWeight: "600" }, disabled: { opacity: 0.45 },
  reportAction: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B9CCE8",
    backgroundColor: homeColors.surface,
  },
  reportActionText: {
    color: homeColors.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    flexShrink: 1,
  },
}) };
