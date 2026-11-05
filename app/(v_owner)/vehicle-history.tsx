import { StatusBar } from "react-native";
import { homeColors } from "../../constants/owner/homeTheme";
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
const C = { bg: homeColors.background, card: homeColors.surface, elevated: homeColors.surfaceAlt, text: homeColors.textPrimary, muted: homeColors.textSecondary, border: homeColors.border, red: homeColors.primary, green: homeColors.success };

function serviceLabel(bookingType: string) {
  if (bookingType === "towing-company") return "Towing";
  if (bookingType === "shop-owner") return "Auto shop";
  return "Indie mechanic";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColor(status: string) {
  if (["completed", "complete"].includes(status.toLowerCase())) return C.green;
  if (["cancelled", "rejected"].includes(status.toLowerCase())) return homeColors.busy;
  if (status.toLowerCase() === "pending") return "#854D0E";
  return C.red;
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

  return <SafeAreaView style={s.safe} edges={["left", "right"]}>
    <SafeAreaView style={[s.header, { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 }]} edges={["top"]}><StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
      <Pressable onPress={returnToVehicles} style={[s.back, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }]} accessibilityRole="button" accessibilityLabel="Back to vehicles">
        <Ionicons name="chevron-back" size={22} color={"#FFFFFF"} />
      </Pressable>
      <View style={s.headerCopy}>
        <Text style={[s.eyebrow, { color: "#FFFFFF" }]}>VEHICLE GARAGE</Text>
        <Text style={[s.title, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]} >{title}</Text>
        <Text style={[s.subtitle, { color: "#FFFFFF" }]}>{vehicle?.plateNumber || "Service history"}</Text>
      </View>
      <View style={[s.headerIcon, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }]}><Ionicons name="time-outline" size={20} color={"#FFFFFF"} /></View>
    </SafeAreaView>

    <ScrollView style={s.contentSurface} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
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
            <Text style={s.browseText}>Find a provider</Text><Ionicons name="arrow-forward" size={16} color={homeColors.white} />
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
            <Text style={s.provider} >{item.providerName || "Service provider"}</Text>
            <Text style={s.detail} >{item.problem || item.towingType || "Service request"}</Text>
            <View style={s.cardFooter}>
              <View style={s.dateRow}><Ionicons name="calendar-outline" size={14} color={C.muted} /><Text style={s.date}>{item.createdAt?.toDate?.().toLocaleDateString() || "Recent"}</Text></View>
              <View style={s.priceRow}><Text style={s.price}>{item.status === "completed" ? historyPrice(item) : historyPrice(item) ? `Starting / estimated: ${historyPrice(item)}` : "Starting / estimated price unavailable"}</Text><Ionicons name="chevron-forward" size={16} color={C.red} /></View>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F52BA" },
  contentSurface: { flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingVertical: 14 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: C.red, fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginBottom: 3 },
  title: { color: C.text, fontSize: 24, fontWeight: "700", lineHeight: 30},
  subtitle: { color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 19, fontWeight: "400"},
  headerIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  summaryTitle: { color: C.text, fontSize: 16, fontWeight: "700", lineHeight: 22},
  summaryHint: { color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 19, fontWeight: "400"},
  countBadge: { minWidth: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  count: { color: C.text, fontSize: 14, fontWeight: "700" },
  loader: { marginTop: 70 },
  historyRow: { flexDirection: "row", alignItems: "stretch" },
  timeline: { width: 42, alignItems: "center" },
  timelineIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineLine: { position: "absolute", top: 34, bottom: 0, width: 1, backgroundColor: C.border },
  card: { flex: 1, minWidth: 0, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 12 },
  cardTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  type: { color: C.red, fontSize: 13, fontWeight: "500", letterSpacing: .45, textTransform: "uppercase", lineHeight: 19},
  statusBadge: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontSize: 13, fontWeight: "500", lineHeight: 19, flexShrink: 1},
  provider: { color: C.text, fontSize: 18, fontWeight: "700", marginTop: 12, lineHeight: 25},
  detail: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 4, fontWeight: "400"},
  cardFooter: { borderTopWidth: 0, borderTopColor: C.border, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 11 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { color: C.muted, fontSize: 13, lineHeight: 19, fontWeight: "400"},
  priceRow: { flexDirection: "row", flexShrink: 1, alignItems: "center", gap: 5 },
  price: { color: C.text, fontSize: 15, fontWeight: "600", lineHeight: 22, flexShrink: 1},
  empty: { alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 25, paddingVertical: 32, marginTop: 40 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 5, lineHeight: 25},
  muted: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  browseButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.red, borderRadius: 13, paddingHorizontal: 17, minHeight: 54, paddingVertical: 12, marginTop: 20 },
  browseText: { color: homeColors.white, fontSize: 15, fontWeight: "700", lineHeight: 20},
});
