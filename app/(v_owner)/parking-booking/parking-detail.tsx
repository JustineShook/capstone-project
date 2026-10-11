import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerRating } from "../../../components/owner/CustomerRating";
import { endParking, startParking, subscribeToMyParkingBookings } from "../../../services/parkingBookingService";
import type { ParkingBooking } from "../../../types/parkingBooking";

export default function ParkingDetail() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<ParkingBooking>();
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeToMyParkingBookings((items) => setBooking(items.find((item) => item.id === bookingId)), () => {}), [bookingId]);

  const act = async (kind: "start" | "end") => {
    const current = booking;
    if (!current || saving) return;
    const run = async () => {
      setSaving(true);
      try {
        if (kind === "start") await startParking(current.id);
        else await endParking(current.id);
      } catch (error) {
        Alert.alert("Unable to update", error instanceof Error ? error.message : "Please try again.");
      } finally { setSaving(false); }
    };
    if (kind === "end") {
      Alert.alert("End parking?", "Are you leaving this parking space?", [
        { text: "Cancel", style: "cancel" }, { text: "Yes, End Parking", onPress: () => void run() },
      ]);
      return;
    }
    await run();
  };

  if (!booking) return <SafeAreaView style={s.loading}><StatusBar barStyle="light-content" backgroundColor="#151C23" /><Text style={s.body}>Loading parking session...</Text></SafeAreaView>;
  const label = booking.status === "reserved" ? "Parking Reserved" : booking.status === "active" ? "Parking Active" : "Parking Completed";

  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content" backgroundColor="#151C23" />
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)")}><Ionicons name="chevron-back" size={25} color="#F4F6F8" /></Pressable><Text style={s.headerTitle}>Parking Booking</Text><View style={{ width: 25 }} /></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        <View style={s.headingRow}><View style={s.icon}><Text style={s.iconText}>P</Text></View><View style={{ flex: 1 }}><Text style={s.title}>{label}</Text><Text style={s.name}>{booking.providerName}</Text></View></View>
        <View style={s.rule} />
        <Detail label="Parking slot" value={`Slot ${booking.slotNumber}`} />
        <Detail label="Vehicle" value={`${booking.vehicle} · ${booking.vehiclePlate}`} />
        {booking.notes ? <Detail label="Arrival notes" value={booking.notes} /> : null}
        {booking.status === "reserved" && <Pressable accessibilityRole="button" disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => void act("start")}><Text style={s.buttonText}>{saving ? "Starting..." : "Start Parking"}</Text></Pressable>}
        {booking.status === "active" && <Pressable accessibilityRole="button" disabled={saving} style={[s.button, saving && s.disabled]} onPress={() => void act("end")}><Text style={s.buttonText}>{saving ? "Ending..." : "End Parking"}</Text></Pressable>}
        {booking.status === "completed" && <Text style={s.done}>Your parking slot has been released.</Text>}
      </View>
      {booking.status === "completed" && <CustomerRating bookingId={booking.id} bookingType="parking" providerName={booking.providerName} />}
    </ScrollView>
  </SafeAreaView>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={s.detail}><Text style={s.detailLabel}>{label}</Text><Text style={s.body}>{value}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0C1015" },
  header: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: "#28313A" },
  headerTitle: { color: "#F4F6F8", fontSize: 18, fontWeight: "700" },
  loading: { flex: 1, backgroundColor: "#0C1015", alignItems: "center", justifyContent: "center", padding: 20 },
  content: { flexGrow: 1, justifyContent: "center", padding: 18, gap: 14 },
  card: { backgroundColor: "#0C1015", borderWidth: 1, borderColor: "#28313A", borderRadius: 16, padding: 18, gap: 13 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#3A2025", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#F52239", fontSize: 21, fontWeight: "800" },
  title: { color: "#F4F6F8", fontSize: 21, fontWeight: "800" },
  name: { color: "#AAB5C0", fontSize: 15, marginTop: 3 },
  rule: { height: 1, backgroundColor: "#28313A" },
  detail: { gap: 3 },
  detailLabel: { color: "#AAB5C0", fontSize: 13, fontWeight: "600" },
  body: { color: "#F4F6F8", fontSize: 15, lineHeight: 22 },
  button: { minHeight: 50, marginTop: 3, backgroundColor: "#F52239", padding: 14, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#F4F6F8", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
  done: { color: "#39D98A", fontWeight: "700", fontSize: 14 },
});
