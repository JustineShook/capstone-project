import { Text, View } from "react-native";
import { Timestamp } from "firebase/firestore";
import type { BookingTimingFields } from "../../types/bookingTiming";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";

export function BookingTimingBanner({ booking }: { booking: BookingTimingFields & { status?: string } }) {
  const scheduledAt = booking.scheduledAt;
  const date = scheduledAt instanceof Timestamp
    ? scheduledAt.toDate()
    : scheduledAt ? new Date(scheduledAt as string) : null;
  const awaiting = booking.timingMode === "scheduled" && booking.status === "accepted"
    && date !== null && date.getTime() <= Date.now();
  return <View style={{ backgroundColor: "#1C252E", borderRadius: 10, padding: 12, gap: 4 }}>
    <Text style={{ color: "#F4F6F8", fontWeight: "800" }}>{formatBookingTimingLabel(booking)}</Text>
    {awaiting && <Text accessibilityLiveRegion="polite" style={{ color: "#AAB5C0" }}>Awaiting service. The provider will start the existing service flow when ready.</Text>}
    {booking.urgency === "emergency" && <Text style={{ color: "#AAB5C0" }}>Acceptance and response time are not guaranteed.</Text>}
    {booking.timingMode === "scheduled" && <Text style={{ color: "#AAB5C0" }}>Appointment start only; service duration is not guaranteed. Subject to provider confirmation.</Text>}
  </View>;
}
