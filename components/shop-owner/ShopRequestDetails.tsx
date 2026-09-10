import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { isActiveShopService, SHOP_STATUS_FLOW, SHOP_STATUS_LABELS } from "../../types/shopBooking";
import { formatLocation, RequestActions, RequestList } from "./ShopRequests";
import { Button, C, formatTime, Info, LoadState, s, ShopScreen, StatusBadge } from "./ShopUI";

export default function ShopRequestDetails({ active = false }: { active?: boolean }) {
  const { id: parameter } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(parameter) ? parameter[0] : parameter;
  const { requests, requestsLoading, requestsError, profile, retry } = useShopDashboard();
  const [linkError, setLinkError] = useState<string | null>(null);
  const request = requests.find((item) => item.id === id);
  const currentIndex = request ? SHOP_STATUS_FLOW.findIndex((status) => status === request.status) : -1;

  async function openMap() {
    if (!request) return;
    setLinkError(null);
    try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`); }
    catch { setLinkError("Unable to open maps. You can copy the coordinates above."); }
  }

  return <ShopScreen title={active ? "Active Service" : "Request Details"} back>
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && (active && !id ? <>
      <Text style={s.muted}>Customers bring their vehicles to your shop. Select a service to update its progress.</Text>
      <RequestList requests={requests.filter((item) => isActiveShopService(item.status))} empty="No active services." />
    </> : !request ? <View style={s.card}><Text style={s.title}>Request not found</Text>
      <Text style={s.muted}>This request is missing or is not assigned to your shop.</Text></View> : <>
      <View style={s.card}><Text style={s.title}>{request.customerName}</Text><StatusBadge status={request.status} />
        <Info label="Request ID" value={request.id} />
        <Info label="Requested" value={formatTime(request.createdAt)} />
        <Info label={request.status === "completed" ? "Completed" : "Last updated"} value={formatTime(request.updatedAt)} />
      </View>
      {currentIndex >= 0 && <View style={s.card}><Text style={s.heading}>SERVICE PROGRESS</Text>
        {SHOP_STATUS_FLOW.map((status, index) => <View key={status} style={s.row}>
          <Feather name={index < currentIndex || request.status === "completed" ? "check-circle" : "circle"} size={18} color={index <= currentIndex ? C.primary : C.muted} />
          <Text style={[s.text, index === currentIndex && { color: C.primary, fontWeight: "700" }]}>{SHOP_STATUS_LABELS[status]}</Text>
        </View>)}
      </View>}
      <View style={s.card}><Info label="Customer" value={request.customerName} /><Info label="Customer email" value={request.customerEmail} /></View>
      <View style={s.card}><Info label="Vehicle" value={request.vehicle} /><Info label="Year" value={String(request.vehicleYear)} /><Info label="Plate number" value={request.vehiclePlate} /></View>
      <View style={s.card}><Info label="Problem / service requested" value={request.problem} /><Info label="Additional notes" value={request.notes} /><Info label="Starting price (not a final bill)" value={request.startingPrice} /></View>
      <View style={s.card}><Info label="Customer location" value={formatLocation(request)} />
        {Number.isFinite(request.latitude) && Number.isFinite(request.longitude) && <Button title="View Customer Location" secondary onPress={() => void openMap()} />}
        {linkError && <Text accessibilityRole="alert" style={s.error}>{linkError}</Text>}
        <Info label="Service shop" value={request.providerName} /><Info label="Shop address" value={profile?.address ?? ""} />
        <Text style={s.muted}>Service takes place at the shop. The customer brings the vehicle.</Text>
      </View>
      <RequestActions key={`${request.id}:${request.status}`} request={request} />
    </>)}
  </ShopScreen>;
}
