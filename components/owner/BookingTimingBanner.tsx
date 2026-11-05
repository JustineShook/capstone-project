import { homeColors } from "../../constants/owner/homeTheme";
import { Text, View } from "react-native";
import { Timestamp } from "firebase/firestore";
import type { BookingTimingFields } from "../../types/bookingTiming";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";

export function BookingTimingBanner({ homeAppearance = false, booking }: { homeAppearance?: boolean; booking: BookingTimingFields & { status?: string } }) {
  const scheduledAt = booking.scheduledAt;
  const date = scheduledAt instanceof Timestamp
    ? scheduledAt.toDate()
    : scheduledAt ? new Date(scheduledAt as string) : null;
  const awaiting = booking.timingMode === "scheduled" && booking.status === "accepted"
    && date !== null && date.getTime() <= Date.now();
  return <View style={{ backgroundColor: homeAppearance ? homeColors.surfaceAlt : "#1C252E", borderRadius: 10, padding: 12, gap: 4 }}>
    <Text style={{ color: homeAppearance ? homeColors.textPrimary : "#F4F6F8", fontWeight: homeAppearance ? "700" : "800", ...(homeAppearance ? { fontSize: 16, lineHeight: 22 } : {}) }}>{formatBookingTimingLabel(booking)}</Text>
    {awaiting && <Text accessibilityLiveRegion="polite" style={{ color: homeAppearance ? homeColors.textSecondary : "#AAB5C0", ...(homeAppearance ? { fontSize: 13, lineHeight: 19 } : {}) }}>Awaiting service. The provider will start the existing service flow when ready.</Text>}
    {booking.urgency === "emergency" && <Text style={{ color: homeAppearance ? homeColors.textSecondary : "#AAB5C0", ...(homeAppearance ? { fontSize: 13, lineHeight: 19 } : {}) }}>Acceptance and response time are not guaranteed.</Text>}
    {booking.timingMode === "scheduled" && <Text style={{ color: homeAppearance ? homeColors.textSecondary : "#AAB5C0", ...(homeAppearance ? { fontSize: 13, lineHeight: 19 } : {}) }}>Appointment start only; service duration is not guaranteed. Subject to provider confirmation.</Text>}
  </View>;
}
