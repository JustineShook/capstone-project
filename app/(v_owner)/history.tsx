import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "../../services/firebase";
import { formatBookingTimingLabel } from "../../utils/bookingTiming";
import { formatPesoAmount } from "../../utils/finalPrice";

type HistoryItem = { id: string; bookingType: "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage"; providerName: string; vehicle: string; vehiclePlate: string; status: string; problem?: string; towingType?: string; startingPrice: string; assessmentPrice?: number; finalPrice?: number; timingMode?: "now" | "scheduled"; urgency?: "standard" | "emergency"; scheduledAt?: Timestamp | string; createdAt?: Timestamp };
const C = { bg: "#0C1015", card: "#151C23", text: "#F4F6F8", muted: "#AAB5C0", border: "#28313A", red: "#F52239", success: "#39D98A" };
function historyPrice(item: HistoryItem) {
  const format = (price: number) => `₱${price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (item.bookingType === "homegarage" && item.status === "completed") return typeof item.finalPrice === "number" ? `Final ${format(item.finalPrice)}` : "Final price not recorded";
  if (item.bookingType === "homegarage" && item.assessmentPrice != null) return `Assessed ${format(item.assessmentPrice)}`;
  if (item.bookingType === "shop-owner" && item.status === "completed") return typeof item.finalPrice === "number" ? `Final ${formatPesoAmount(item.finalPrice)}` : "Final price not recorded";
  if (["onsite-mechanic", "towing-company"].includes(item.bookingType) && item.status === "completed") {
    return typeof item.finalPrice === "number" ? `Final ${formatPesoAmount(item.finalPrice)}` : "Final price not recorded";
  }
  return item.startingPrice;
}

export default function HistoryScreen() {
  const router = useRouter(); const [items, setItems] = useState<HistoryItem[]>([]); const [loading, setLoading] = useState(true);
  const returnToHome = useCallback(() => router.replace("/(v_owner)"), [router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      returnToHome();
      return true;
    });
    return () => subscription.remove();
  }, [returnToHome]));
  useEffect(() => { const uid = auth.currentUser?.uid; if (!uid) { setLoading(false); return; } return onSnapshot(query(collection(db, "bookings"), where("customerId", "==", uid)), (snapshot) => { setItems(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as HistoryItem)).filter((item) => ["onsite-mechanic", "towing-company", "shop-owner", "homegarage"].includes(item.bookingType)).sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0))); setLoading(false); }, () => setLoading(false)); }, []);
  const grouped = useMemo(() => items, [items]);
  const openDetails = (item: HistoryItem) => router.push({ pathname: item.bookingType === "homegarage" ? "/(v_owner)/homegarage-booking/booking-detail" : item.bookingType === "towing-company" ? "/(v_owner)/towing-booking/booking-detail" : item.bookingType === "shop-owner" ? "/(v_owner)/shop-booking/booking-detail" : "/(v_owner)/mechanic-booking/booking-detail", params: { bookingId: item.id } });
  const kind = (item: HistoryItem) => item.bookingType === "homegarage" ? "HOME GARAGE REPAIR" : item.bookingType === "towing-company" ? "TOWING" : item.bookingType === "shop-owner" ? "AUTO SHOP" : "INDIE MECHANIC";
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><View style={s.header}><View style={s.headerRow}><Pressable onPress={returnToHome} accessibilityRole="button" accessibilityLabel="Back to home" style={s.backButton}><Ionicons name="chevron-back" size={23} color={C.text} /></Pressable><View style={s.headerCopy}><Text style={s.title}>History</Text><Text style={s.subtitle}>All vehicle service requests</Text></View></View></View><ScrollView contentContainerStyle={s.content}>{loading ? <ActivityIndicator color={C.red} style={{ marginTop: 56 }} /> : grouped.length === 0 ? <View style={s.empty}><Ionicons name="time-outline" size={38} color={C.muted} /><Text style={s.emptyTitle}>No history yet</Text><Text style={s.muted}>Your towing, mechanic, and auto-shop requests will appear here.</Text></View> : grouped.map((item) => <Pressable key={item.id} style={s.card} onPress={() => openDetails(item)}><View style={s.top}><Text style={s.type}>{kind(item)}</Text><Text style={[s.status, item.status === "completed" && s.completed]}>{item.status.replace(/_/g, " ")}</Text></View><Text style={s.provider}>{item.providerName}</Text><View style={s.vehicleRow}><Ionicons name="car-sport-outline" size={15} color={C.muted} /><Text style={s.vehicle}>{item.vehicle} · {item.vehiclePlate}</Text></View><Text style={s.detail}>{item.problem || item.towingType || "Service request"}</Text><Text style={s.detail}>{formatBookingTimingLabel(item)}</Text><View style={s.bottom}><Text style={s.date}>{item.createdAt?.toDate().toLocaleDateString() || "Recent"}</Text><View style={s.priceRow}><Text style={s.price}>{historyPrice(item)}</Text><Ionicons name="chevron-forward" size={16} color={C.red} /></View></View></Pressable>)}</ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.bg }, header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }, headerRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11 }, backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: "#1C252E" }, headerCopy: { flex: 1 }, title: { color: C.text, fontSize: 22, fontWeight: "800" }, subtitle: { color: C.muted, fontSize: 13, marginTop: 2 }, content: { padding: 16, paddingBottom: 32, gap: 12 }, card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 }, top: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, type: { color: C.red, fontSize: 11, fontWeight: "800", letterSpacing: .5 }, status: { color: C.muted, fontSize: 12, textTransform: "capitalize" }, completed: { color: C.success, fontWeight: "700" }, provider: { color: C.text, fontSize: 16, fontWeight: "700", marginTop: 10 }, vehicleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 }, vehicle: { color: C.muted, fontSize: 13 }, detail: { color: C.muted, fontSize: 13, marginTop: 5 }, bottom: { borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10 }, date: { color: C.muted, fontSize: 12 }, priceRow: { flexDirection: "row", alignItems: "center", gap: 5 }, price: { color: C.text, fontSize: 14, fontWeight: "700" }, empty: { alignItems: "center", paddingTop: 90, gap: 10 }, emptyTitle: { color: C.text, fontSize: 17, fontWeight: "700" }, muted: { color: C.muted, fontSize: 13, textAlign: "center" } });
