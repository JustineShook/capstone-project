import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "../../services/firebase";
import { subscribeToMyVehicles } from "../../services/owner/vehicleService";
import type { SavedVehicle } from "../../types/owner/vehicle";
import { formatPesoAmount } from "../../utils/finalPrice";

type VehicleHistoryItem = { id: string; bookingType: string; providerName: string; status: string; problem?: string; towingType?: string; startingPrice: string; finalPrice?: number; createdAt?: { toDate?: () => Date }; vehicleId: string };
const C = { bg: "#0C1015", card: "#151C23", elevated: "#1C252E", text: "#F4F6F8", muted: "#AAB5C0", border: "#28313A", red: "#F52239", green: "#62D5A5" };

function serviceLabel(bookingType: string) {
  if (bookingType === "towing-company") return "Towing";
  if (bookingType === "shop-owner") return "Auto shop";
  return "Indie mechanic";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColor(status: string) {
  return ["completed", "complete"].includes(status.toLowerCase()) ? C.green : C.red;
}

function historyPrice(item: VehicleHistoryItem) {
  if (["onsite-mechanic", "towing-company", "shop-owner", "homegarage"].includes(item.bookingType) && item.status === "completed") {
    return typeof item.finalPrice === "number" ? `Final ${formatPesoAmount(item.finalPrice)}` : "Final price not recorded";
  }
  return item.startingPrice || "";
}

export default function VehicleHistoryScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const returnToVehicles = useCallback(() => router.replace("/(v_owner)/vehicle"), [router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      returnToVehicles();
      return true;
    });
    return () => subscription.remove();
  }, [returnToVehicles]));
  const [vehicle, setVehicle] = useState<SavedVehicle | null>(null);
  const [items, setItems] = useState<VehicleHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      return subscribeToMyVehicles((vehicles) => setVehicle(vehicles.find((item) => item.vehicleId === vehicleId) ?? null), () => setVehicle(null));
    } catch { return; }
  }, [vehicleId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !vehicleId) { setLoading(false); return; }
    return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", uid)), (snapshot) => {
      setItems(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as VehicleHistoryItem))
        .filter((item) => item.vehicleId === vehicleId)
        .sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0)));
      setLoading(false);
    }, () => setLoading(false));
  }, [vehicleId]);

  const title = useMemo(() => vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle History", [vehicle]);
  const openDetails = (item: VehicleHistoryItem) => router.push({ pathname: item.bookingType === "towing-company" ? "/(v_owner)/towing-booking/booking-detail" : item.bookingType === "shop-owner" ? "/(v_owner)/shop-booking/booking-detail" : "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: item.id } });

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <View style={s.header}>
      <Pressable onPress={returnToVehicles} style={s.back} accessibilityRole="button" accessibilityLabel="Back to vehicles">
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <View style={s.headerCopy}>
        <Text style={s.eyebrow}>VEHICLE GARAGE</Text>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.subtitle}>{vehicle?.plateNumber || "Service history"}</Text>
      </View>
      <View style={s.headerIcon}><Ionicons name="time-outline" size={20} color={C.red} /></View>
    </View>

    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {!loading && items.length > 0 && <View style={s.summaryRow}>
        <View><Text style={s.summaryTitle}>Service activity</Text><Text style={s.summaryHint}>Services linked to this vehicle</Text></View>
        <View style={s.countBadge}><Text style={s.count}>{items.length}</Text></View>
      </View>}

      {loading ? <ActivityIndicator color={C.red} style={s.loader} /> : items.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}><Ionicons name="time-outline" size={30} color={C.red} /></View>
          <Text style={s.emptyTitle}>No service history yet</Text>
          <Text style={s.muted}>Bookings for this vehicle will appear here.</Text>
          <Pressable style={s.browseButton} onPress={() => router.replace("/(v_owner)")} accessibilityRole="button">
            <Text style={s.browseText}>Find a provider</Text><Ionicons name="arrow-forward" size={16} color={C.text} />
          </Pressable>
        </View>
      ) : items.map((item, index) => (
        <Pressable key={item.id} style={s.historyRow} onPress={() => openDetails(item)} accessibilityRole="button">
          <View style={s.timeline}>
            <View style={s.timelineIcon}><Ionicons name={item.bookingType === "towing-company" ? "car-outline" : item.bookingType === "shop-owner" ? "build-outline" : "construct-outline"} size={17} color={C.red} /></View>
            {index < items.length - 1 && <View style={s.timelineLine} />}
          </View>
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.type}>{serviceLabel(item.bookingType)}</Text>
              <View style={[s.statusBadge, { backgroundColor: `${statusColor(item.status)}18` }]}><View style={[s.statusDot, { backgroundColor: statusColor(item.status) }]} /><Text style={[s.status, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text></View>
            </View>
            <Text style={s.provider} numberOfLines={1}>{item.providerName || "Service provider"}</Text>
            <Text style={s.detail} numberOfLines={2}>{item.problem || item.towingType || "Service request"}</Text>
            <View style={s.cardFooter}>
              <View style={s.dateRow}><Ionicons name="calendar-outline" size={14} color={C.muted} /><Text style={s.date}>{item.createdAt?.toDate?.().toLocaleDateString() || "Recent"}</Text></View>
              <View style={s.priceRow}><Text style={s.price}>{historyPrice(item)}</Text><Ionicons name="chevron-forward" size={16} color={C.red} /></View>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 18, paddingVertical: 14 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: C.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 3 },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 3 },
  headerIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 30 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  summaryTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  summaryHint: { color: C.muted, fontSize: 12, marginTop: 3 },
  countBadge: { minWidth: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  count: { color: C.text, fontSize: 14, fontWeight: "800" },
  loader: { marginTop: 70 },
  historyRow: { flexDirection: "row", alignItems: "stretch" },
  timeline: { width: 42, alignItems: "center" },
  timelineIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineLine: { position: "absolute", top: 34, bottom: 0, width: 1, backgroundColor: C.border },
  card: { flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  type: { color: C.red, fontSize: 11, fontWeight: "800", letterSpacing: .45, textTransform: "uppercase" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontSize: 10, fontWeight: "800" },
  provider: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: 12 },
  detail: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  cardFooter: { borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 11 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { color: C.muted, fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  price: { color: C.text, fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 25, paddingVertical: 32, marginTop: 40 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: "#3A2025", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 5 },
  muted: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  browseButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.red, borderRadius: 13, paddingHorizontal: 17, paddingVertical: 12, marginTop: 20 },
  browseText: { color: C.text, fontSize: 13, fontWeight: "800" },
});
