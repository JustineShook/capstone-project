import { Timestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { BookingTimingInput } from "../../types/bookingTiming";
import { clearScheduledHour, createManilaSlot, getManilaDayLabel, getManilaTimeLabel } from "../../utils/bookingTiming";

const C = { text: "#F4F6F8", muted: "#AAB5C0", line: "#28313A", card: "#151C23", red: "#F52239" };

export function BookingTimingSelector({ value, emergencyAvailable, acceptsScheduled = false, showStandardNow = true, onChange }: {
  value: BookingTimingInput | null;
  emergencyAvailable: boolean;
  acceptsScheduled?: boolean;
  showStandardNow?: boolean;
  onChange: (next: BookingTimingInput) => void;
}) {
  const [dayOffset, setDayOffset] = useState(0);
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: 30 }, (_, index) => createManilaSlot(index, 0, now)), [now]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, hour) => ({
    hour, date: createManilaSlot(dayOffset, hour, now),
  })).filter(({ date }) => date.getTime() > Date.now()), [dayOffset, now]);

  const chooseNow = (urgency: "standard" | "emergency") => onChange({ timingMode: "now", urgency });
  const scheduledSelected = value?.timingMode === "scheduled" && acceptsScheduled;

  return <View style={{ gap: 10 }}>
    <Text style={{ color: C.text, fontSize: 16, fontWeight: "800" }}>When do you need service?</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {showStandardNow && <Choice label="Now" selected={value?.timingMode === "now" && value.urgency === "standard"} onPress={() => chooseNow("standard")} />}
      {emergencyAvailable && <Choice label="Emergency" selected={value?.timingMode === "now" && value.urgency === "emergency"} onPress={() => chooseNow("emergency")} />}
      {acceptsScheduled && <Choice label="Schedule" selected={scheduledSelected} onPress={() => onChange(clearScheduledHour())} />}
    </View>
    {!showStandardNow && value?.timingMode === "now" && value.urgency === "standard" && <Text style={{ color: C.muted }}>Now selected on provider discovery.</Text>}
    {!showStandardNow && !acceptsScheduled && !emergencyAvailable && <Text style={{ color: C.muted }}>This provider has not enabled scheduling or emergency requests. You cannot submit a request.</Text>}
    {value?.timingMode === "now" && value.urgency === "emergency" && <Text style={{ color: C.muted, lineHeight: 20 }}>Acceptance and response time are not guaranteed.</Text>}
    {scheduledSelected && <>
      <Text style={{ color: C.muted }}>Preferred start time \u00B7 Asia/Manila. Subject to provider confirmation.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((day, index) => <Choice key={day.toISOString()} label={getManilaDayLabel(day)} selected={index === dayOffset} onPress={() => {
          setDayOffset(index);
          onChange(clearScheduledHour());
        }} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {hours.map(({ hour, date }) => <Choice key={hour} label={getManilaTimeLabel(date)} selected={value?.scheduledAt?.toMillis() === date.getTime()} onPress={() => onChange({ timingMode: "scheduled", urgency: "standard", scheduledAt: Timestamp.fromDate(date) })} />)}
      </ScrollView>
      {!value?.scheduledAt && <Text style={{ color: C.muted }}>Choose a new hour for the selected day before continuing.</Text>}
    </>}
  </View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: 42, paddingHorizontal: 13, borderRadius: 10, justifyContent: "center", backgroundColor: selected ? C.red : C.card, borderWidth: 1, borderColor: selected ? C.red : C.line }}>
    <Text style={{ color: C.text, fontSize: 14, fontWeight: selected ? "800" : "600" }}>{label}</Text>
  </TouchableOpacity>;
}
