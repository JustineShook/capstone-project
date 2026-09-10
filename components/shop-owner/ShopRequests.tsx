import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { updateShopBookingStatus } from "../../services/shopOwnerService";
import { isActiveShopService, type ShopBookingRequest, type ShopBookingStatus } from "../../types/shopBooking";
import { Button, formatTime, Info, s, StatusBadge } from "./ShopUI";

const NEXT_ACTION: Partial<Record<ShopBookingStatus, { status: ShopBookingStatus; title: string }>> = {
  accepted: { status: "vehicle_arrived", title: "Mark Vehicle Arrived" },
  vehicle_arrived: { status: "diagnosing", title: "Start Diagnosing" },
  diagnosing: { status: "repairing", title: "Start Repairing" },
  repairing: { status: "completed", title: "Complete Service" },
};

export function RequestActions({ request }: { request: ShopBookingRequest }) {
  const { profile, profileLoading, profileError } = useShopDashboard();
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAccept = !profileLoading && !profileError && profile?.status === "open" && profile.verified === true;
  const next = NEXT_ACTION[request.status];

  async function update(status: ShopBookingStatus) {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    try { await updateShopBookingStatus(request.id, status); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this request. Please try again."); }
    finally { locked.current = false; setSaving(false); }
  }

  return <View style={{ gap: 10 }}>
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {request.status === "pending" && <>
      {!canAccept && <Text style={s.muted}>{profile?.verified ? "Open your shop from Home before accepting this request." : "Administrator approval is required before accepting requests."}</Text>}
      <View style={s.row}>
        <View style={s.flex}><Button title="Reject" secondary disabled={saving} onPress={() => void update("rejected")} /></View>
        <View style={s.flex}><Button title={saving ? "Saving…" : "Accept Request"} disabled={saving || !canAccept} onPress={() => void update("accepted")} /></View>
      </View>
    </>}
    {next && <Button title={saving ? "Saving…" : next.title} disabled={saving} onPress={() => void update(next.status)} />}
    {request.status === "accepted" && <Text style={s.muted}>Waiting for the customer to bring the vehicle to your shop.</Text>}
  </View>;
}

export function RequestCard({ request, actions = false }: { request: ShopBookingRequest; actions?: boolean }) {
  const router = useRouter();
  return <View style={s.card}>
    <View style={s.between}><Text style={s.title}>{request.customerName}</Text><StatusBadge status={request.status} /></View>
    <Text style={s.muted}>{request.vehicle} · {request.vehicleYear} · {request.vehiclePlate || "No plate provided"}</Text>
    <Info label="Reported problem" value={request.problem} />
    <Info label="Customer location" value={formatLocation(request)} />
    <Text style={s.muted}>Requested: {formatTime(request.createdAt)}</Text>
    {request.status === "completed" && <Text style={s.muted}>Completed: {formatTime(request.updatedAt)}</Text>}
    <Button title={isActiveShopService(request.status) ? "Manage Service" : "View Request"} secondary onPress={() => router.push({
      pathname: isActiveShopService(request.status) ? "/(shop-owner)/active-service" : "/(shop-owner)/request-details",
      params: { id: request.id },
    })} />
    {actions && <RequestActions key={`${request.id}:${request.status}`} request={request} />}
  </View>;
}

export function formatLocation(request: Pick<ShopBookingRequest, "latitude" | "longitude">): string {
  return Number.isFinite(request.latitude) && Number.isFinite(request.longitude)
    ? `${request.latitude.toFixed(6)}, ${request.longitude.toFixed(6)}` : "Location not provided";
}

export function RequestList({ requests, empty, actions = false }: { requests: ShopBookingRequest[]; empty: string; actions?: boolean }) {
  if (!requests.length) return <View style={s.card}><Text style={s.muted}>{empty}</Text></View>;
  return <>{requests.map((request) => <RequestCard key={request.id} request={request} actions={actions} />)}</>;
}
