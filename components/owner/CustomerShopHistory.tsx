import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToMyShopBookings } from "../../services/shopOwnerService";
import type { ShopBookingRequest } from "../../types/shopBooking";
import { Button, formatTime, LoadState, StatusBadge } from "../shop-owner/ShopUI";
import { styles as s } from "./ShopBookingScreen";

export function CustomerShopHistory() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const uid = user?.uid;
  const role = userProfile?.role;
  const [bookings, setBookings] = useState<ShopBookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setBookings([]); setError(null); setLoading(true);
    if (authLoading) return;
    if (!uid || role !== "owner") { setLoading(false); return; }
    try {
      return subscribeToMyShopBookings((items) => { setBookings(items); setLoading(false); }, () => {
        setError("Unable to load your shop requests. Please try again."); setLoading(false);
      });
    } catch (cause) { setError((cause as Error).message); setLoading(false); }
  }, [uid, role, authLoading, attempt]);
  return <View style={{ gap: 14, marginBottom: 14 }}>
    <Text style={s.label}>AUTO SHOP REQUESTS</Text>
    <LoadState loading={loading} error={error} retry={() => setAttempt((value) => value + 1)} />
    {!loading && !error && (!uid || role !== "owner" ? <Text style={s.muted}>Sign in as a Vehicle Owner to view your shop requests.</Text>
      : bookings.length === 0 ? <Text style={s.muted}>No shop requests yet. Choose an available Auto Shop from Home.</Text>
      : bookings.map((booking) => <View key={booking.id} style={s.card}>
        <View style={[s.row, { justifyContent: "space-between" }]}><Text style={[s.title, { flex: 1 }]}>{booking.providerName}</Text><StatusBadge status={booking.status} /></View>
        <Text style={s.text}>{booking.problem}</Text><Text style={s.muted}>{booking.vehicle} · {booking.vehiclePlate}</Text>
        <Text style={s.muted}>{formatTime(booking.createdAt)}</Text>
        <Button title="View Request Status" secondary onPress={() => router.push({ pathname: "/(v_owner)/shop-booking/booking-detail", params: { bookingId: booking.id } })} />
      </View>))}
  </View>;
}
