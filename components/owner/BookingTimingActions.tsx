import { Ionicons } from "@expo/vector-icons";
import { homeColors } from "../../constants/owner/homeTheme";
import { Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BookingTimingInput } from "../../types/bookingTiming";
import { clearScheduledHour, createManilaSlot, formatBookingTimingLabel, getManilaDayKey, getManilaDayLabel, getManilaHour, getManilaTimeLabel, isBookingTimingReady } from "../../utils/bookingTiming";

const C = { bg: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", line: "#28313A", red: "#F52239" };

export function BookingTimingActions({ validationOutside = false, formAppearance = false, value, emergencyAvailable, acceptsScheduled, requiredFieldsValid, reviewDisabled = false, validationMessage, emergencyUnavailableMessage, unavailableMessage, hideUnsupportedSchedule = false, standardNowMessage, onChange, onEmergency, onReview }: { validationOutside?: boolean; formAppearance?: boolean;
  value: BookingTimingInput | null;
  emergencyAvailable: boolean;
  acceptsScheduled: boolean;
  requiredFieldsValid: boolean;
  reviewDisabled?: boolean;
  validationMessage?: string;
  emergencyUnavailableMessage?: string;
  unavailableMessage?: string;
  hideUnsupportedSchedule?: boolean;
  standardNowMessage?: string;
  onChange: (next: BookingTimingInput) => void;
  onEmergency: () => void;
  onReview: () => void;
}) {
  const s = formAppearance ? lightTimingStyles : defaultTimingStyles;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: 30 }, (_, index) => createManilaSlot(index, 0, now)), [now]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, hour) => ({ hour, date: createManilaSlot(dayOffset, hour, now) }))
    .filter(({ date }) => date.getTime() > Date.now()), [dayOffset, now]);

  useEffect(() => {
    if (value?.timingMode !== "scheduled" || !value.scheduledAt) return;
    const date = value.scheduledAt.toDate();
    const day = days.findIndex((item) => getManilaDayKey(item) === getManilaDayKey(date));
    if (day >= 0) { setDayOffset(day); setSelectedHour(getManilaHour(date)); }
  }, [value?.timingMode, value?.scheduledAt, days]);

  const selectedTimestamp = selectedHour === null ? null : createManilaSlot(dayOffset, selectedHour, now);
  const draftReady = !!selectedTimestamp && selectedTimestamp.getTime() > Date.now() && selectedTimestamp.getTime() % 3_600_000 === 0;
  const hasValidSelection = isBookingTimingReady(value);
  const selectedLabel = value ? formatBookingTimingLabel(value) : null;

  const confirmSchedule = () => {
    if (!acceptsScheduled || !draftReady || !selectedTimestamp) return;
    onChange({ timingMode: "scheduled", urgency: "standard", scheduledAt: Timestamp.fromDate(selectedTimestamp) });
    setSheetOpen(false);
  };

  return <>
    <View style={s.footerContent}>
      <View style={s.choiceRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !emergencyAvailable, selected: value?.timingMode === "now" && value.urgency === "emergency" }} disabled={!emergencyAvailable} onPress={onEmergency}
          style={[s.choice, value?.timingMode === "now" && value.urgency === "emergency" && s.selected, !emergencyAvailable && s.disabled]}>
          {formAppearance && <Ionicons accessible={false} name={value?.timingMode === "now" && value.urgency === "emergency" ? "checkmark-circle" : "flash-outline"} size={20} color={homeColors.primary} />}
          <Text style={[s.choiceText, formAppearance && value?.timingMode === "now" && value.urgency === "emergency" && lightTimingStyles.selectedText]}>Emergency</Text>
        </Pressable>
        {(acceptsScheduled || !hideUnsupportedSchedule) && <Pressable accessibilityRole="button" accessibilityState={{ disabled: !acceptsScheduled, selected: value?.timingMode === "scheduled" }} disabled={!acceptsScheduled} onPress={() => { if (acceptsScheduled) setSheetOpen(true); }}
          style={[s.choice, value?.timingMode === "scheduled" && s.selected, !acceptsScheduled && s.disabled]}>
          {formAppearance && <Ionicons accessible={false} name={value?.timingMode === "scheduled" ? "checkmark-circle" : "calendar-outline"} size={20} color={homeColors.primary} />}
          <Text style={[s.choiceText, formAppearance && value?.timingMode === "scheduled" && lightTimingStyles.selectedText]}>Schedule</Text>
        </Pressable>}
      </View>
      {unavailableMessage ? <Text style={s.validation}>{unavailableMessage}</Text> : null}
      {!emergencyAvailable || (!acceptsScheduled && !hideUnsupportedSchedule) ? <Text style={s.reason}>{[
        !emergencyAvailable ? emergencyUnavailableMessage ?? "Emergency disabled: this provider has not enabled urgent requests." : null,
        !acceptsScheduled && !hideUnsupportedSchedule ? "Schedule disabled: this provider has not enabled future bookings." : null,
      ].filter(Boolean).join(" · ")}</Text> : null}
      {!validationOutside && validationMessage ? <Text style={s.validation}>{validationMessage}</Text> : null}
      {!value ? <Text style={s.reason}>Choose Emergency or Schedule. Standard Now stays selected when you arrive from provider discovery.</Text> : null}
      {value?.timingMode === "now" && value.urgency === "emergency" ? <Text style={s.reason}>Acceptance and response time are not guaranteed.</Text> : null}
      {standardNowMessage && value?.timingMode === "now" && value.urgency === "standard" ? <Text style={s.validation}>{standardNowMessage}</Text> : null}
      {value?.timingMode === "scheduled" ? <View style={s.scheduleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.selectedLabel} numberOfLines={formAppearance ? undefined : 1}>{hasValidSelection ? selectedLabel : "Choose a valid appointment hour"}</Text>
          <Text style={s.reason} numberOfLines={formAppearance ? undefined : 1}>Asia/Manila · Subject to provider confirmation</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} style={formAppearance ? lightTimingStyles.changeButton : undefined}><Text style={s.change}>Change</Text></Pressable>
      </View> : value?.timingMode === "now" && value.urgency === "standard" ? <Text style={s.selectedLabel}>Now selected</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !requiredFieldsValid || !hasValidSelection || reviewDisabled }} disabled={!requiredFieldsValid || !hasValidSelection || reviewDisabled} onPress={onReview}
        style={[s.review, (!requiredFieldsValid || !hasValidSelection || reviewDisabled) && s.disabled]}>
        {formAppearance && <Ionicons accessible={false} name="document-text-outline" size={20} color={homeColors.white} />}
        <Text style={s.reviewText}>Review Booking</Text>
      </Pressable>
    </View>

    <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} accessibilityLabel="Close schedule picker" />
        <SafeAreaView edges={["bottom"]} style={s.sheet}>
          <Text style={s.title}>Choose a preferred time</Text>
          <Text style={s.reason}>One-hour appointment start window · Asia/Manila · Subject to provider confirmation</Text>
          <Text style={s.section}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.options}>
            {days.map((day, index) => <Option formAppearance={formAppearance} key={day.toISOString()} label={getManilaDayLabel(day)} selected={index === dayOffset} onPress={() => { if (index === dayOffset) return; setDayOffset(index); setSelectedHour(null); onChange(clearScheduledHour()); }} />)}
          </ScrollView>
          <Text style={s.section}>AVAILABLE HOURS</Text>
          <ScrollView style={s.hourList} contentContainerStyle={s.options} keyboardShouldPersistTaps="handled">
            {hours.map(({ hour, date }) => <Option formAppearance={formAppearance} key={hour} label={getManilaTimeLabel(date)} selected={selectedHour === hour} onPress={() => setSelectedHour(hour)} />)}
            {!hours.length ? <Text style={s.reason}>No future hours remain on this date. Choose another day.</Text> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draftReady }} disabled={!draftReady} onPress={confirmSchedule} style={[s.review, !draftReady && s.disabled]}>
            <Text style={s.reviewText}>Confirm Date and Time</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSheetOpen(false)} style={s.cancel}><Text style={s.reason}>Cancel</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}

function Option({ formAppearance = false, label, selected, onPress }: { formAppearance?: boolean; label: string; selected: boolean; onPress: () => void }) {
  const s = formAppearance ? lightTimingStyles : defaultTimingStyles;
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.option, selected && s.selected]}>{formAppearance && selected && <Ionicons accessible={false} name="checkmark-circle" size={18} color={homeColors.primary} />}<Text style={[s.choiceText, formAppearance && selected && lightTimingStyles.selectedText]}>{label}</Text></Pressable>;
}

export const timingActionStyles = StyleSheet.create({ safeFooter: { backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line } });
const s = StyleSheet.create({
  footerContent: { gap: 7, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 2, backgroundColor: C.bg },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, minHeight: 38, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 10 },
  choiceText: { color: C.text, fontSize: 13, fontWeight: "700" },
  selected: { borderColor: C.red, backgroundColor: "#3A2025" },
  disabled: { opacity: 0.45 },
  reason: { color: C.muted, fontSize: 11, lineHeight: 15 },
  validation: { color: "#FF9AA8", fontSize: 11, lineHeight: 15 },
  selectedLabel: { color: C.text, fontSize: 13, fontWeight: "700" },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  change: { color: C.red, fontSize: 13, fontWeight: "800", padding: 4 },
  review: { minHeight: 42, borderRadius: 10, backgroundColor: C.red, justifyContent: "center", alignItems: "center", paddingHorizontal: 14 },
  reviewText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,.68)" },
  sheet: { width: "100%", maxWidth: 520, maxHeight: "86%", flexShrink: 1, backgroundColor: C.bg, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 18, gap: 9 },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  section: { color: C.muted, fontSize: 11, fontWeight: "800", marginTop: 3 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingVertical: 3 },
  hourList: { maxHeight: 220, flexShrink: 1 },
  option: { minHeight: 38, justifyContent: "center", alignItems: "center", paddingHorizontal: 11, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.card },
  cancel: { minHeight: 30, justifyContent: "center", alignItems: "center" },
});

const defaultTimingStyles = s;
const lightTimingStyles = StyleSheet.create({
  selectedText: { color: homeColors.primary },
  changeButton: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: homeColors.primary, borderRadius: 10, backgroundColor: homeColors.white, paddingHorizontal: 4 },
  footerContent: { gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: homeColors.background },
  choiceRow: { flexDirection: "row", gap: 8 , flexWrap: "wrap" },
  choice: { flex: 1, minHeight: 54, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: homeColors.border, backgroundColor: homeColors.surface, borderRadius: 10 , minWidth: 110, paddingHorizontal: 12, paddingVertical: 10 , gap: 8 , flexDirection: "row" },
  choiceText: { color: homeColors.textPrimary, fontSize: 15, fontWeight: "600" , lineHeight: 20 , flexShrink: 1 },
  selected: { borderColor: homeColors.primary, backgroundColor: "#EAF1FC" },
  disabled: { opacity: 0.45 },
  reason: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19 },
  validation: { color: homeColors.busy, fontSize: 13, lineHeight: 19 , fontWeight: "400", marginTop: 4, marginBottom: 4 },
  selectedLabel: { color: homeColors.textPrimary, fontSize: 13, fontWeight: "600" , lineHeight: 19 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12 , flexWrap: "wrap" , borderRadius: 10 , padding: 12 , backgroundColor: "#EAF1FC" },
  change: { color: homeColors.primary, fontSize: 15, fontWeight: "700", padding: 8 , lineHeight: 20 },
  review: { minHeight: 54, borderRadius: 10, backgroundColor: homeColors.primary, justifyContent: "center", alignItems: "center", paddingHorizontal: 14 , paddingVertical: 14 , gap: 8 , flexDirection: "row" },
  reviewText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" , lineHeight: 20 , textAlign: "center" , flexShrink: 1 },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,.68)" },
  sheet: { width: "100%", maxWidth: 520, maxHeight: "86%", flexShrink: 1, backgroundColor: homeColors.background, borderRadius: 20, borderWidth: 1, borderColor: homeColors.border, padding: 16, gap: 12 },
  title: { color: homeColors.textPrimary, fontSize: 18, fontWeight: "700" , lineHeight: 25 },
  section: { color: homeColors.textSecondary, fontSize: 13, fontWeight: "500", marginTop: 3 , lineHeight: 19 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingVertical: 3 },
  hourList: { maxHeight: 220, flexShrink: 1 },
  option: { minHeight: 54, justifyContent: "center", alignItems: "center", paddingHorizontal: 11, borderWidth: 1, borderColor: homeColors.border, borderRadius: 9, backgroundColor: homeColors.surface , paddingVertical: 10 , gap: 6 , flexDirection: "row" },
  cancel: { minHeight: 44, justifyContent: "center", alignItems: "center" },
});
