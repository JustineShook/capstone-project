import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { BookingTimingBanner } from "../owner/BookingTimingBanner";
import { isActiveShopService, SHOP_STATUS_FLOW } from "../../types/shopBooking";
import { formatLocation, RequestActions, RequestList } from "./ShopRequests";
import { Button, C, formatTime, Info, LoadState, s, ShopScreen, StatusBadge } from "./ShopUI";
import { formatPesoAmount } from "../../utils/finalPrice";
import { OpenGoogleMapsModal } from "../owner/OpenGoogleMapsModal";

export default function ShopRequestDetails({ active = false }: { active?: boolean }) {
  const { id: parameter } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(parameter) ? parameter[0] : parameter;
  const { requests, requestsLoading, requestsError, profile, retry } = useShopDashboard();
  const [showMapsConfirmation, setShowMapsConfirmation] = useState(false);
  const request = requests.find((item) => item.id === id);
  const currentIndex = request ? SHOP_STATUS_FLOW.findIndex((status) => status === request.status) : -1;
  const isTerminal = !!request && ["completed", "cancelled", "rejected"].includes(request.status);

  function openMap() {
    if (!request) return;
    setShowMapsConfirmation(true);
  }

  return <ShopScreen title={active ? "Active Service" : isTerminal ? "Past Booking Details" : "Request Details"} back scrollable={!id}>
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && (active && !id ? <>
      <Text style={s.muted}>Customers bring their vehicles to your shop. Select a service to update its progress.</Text>
      <RequestList requests={requests.filter((item) => isActiveShopService(item.status))} empty="No active services." />
    </> : !request ? <View style={s.card}><Text style={s.title}>Request not found</Text>
      <Text style={s.muted}>This request is missing or is not assigned to your shop.</Text></View> : <>
      <View style={d.summary}>
        {isTerminal ? <Text style={d.archiveEyebrow}>PAST BOOKING RECORD</Text> : null}
        <View style={d.summaryTop}><View style={d.avatar}><Feather name="user" size={23} color={C.textPrimary} /></View><View style={d.customerCopy}><Text style={d.customerName}>{request.customerName || "Customer"}</Text><Text style={d.summaryVehicle}>{request.vehicle} · {request.vehicleYear}</Text></View><StatusBadge status={request.status} /></View>
        <View style={d.summaryRule} />
        <View style={d.summaryMeta}><View style={d.metaItem}><Text style={d.metaLabel}>REQUESTED</Text><Text style={d.metaValue}>{formatTime(request.createdAt)}</Text></View><View style={d.metaDivider} /><View style={d.metaItem}><Text style={d.metaLabel}>{request.status === "completed" && request.completedAt ? "COMPLETED" : "LAST UPDATED"}</Text><Text style={d.metaValue}>{formatTime(request.status === "completed" && request.completedAt ? request.completedAt : request.updatedAt || request.createdAt)}</Text></View></View>
      </View>
      {request && <BookingTimingBanner booking={request} />}
      {!isTerminal && currentIndex >= 0 && <View style={d.progressCard}>
        <View style={d.progressHeading}><View style={d.progressIcon}><Feather name="activity" size={16} color={C.primary} /></View><View style={d.progressCopy}><Text style={d.progressTitle}>Service progress</Text><Text style={d.progressSubtitle}>Step {currentIndex + 1} of {SHOP_STATUS_FLOW.length}</Text></View><StatusBadge status={request.status} /></View>
        <View style={d.progressTrack}><View style={[d.progressFill, { width: `${Math.round(((request.status === "completed" ? SHOP_STATUS_FLOW.length : currentIndex + 1) / SHOP_STATUS_FLOW.length) * 100)}%` }]} /></View>
      </View>}
      <ScrollView style={d.dataScroll} contentContainerStyle={d.dataContent} showsVerticalScrollIndicator={false}>
        <View style={s.card}><Text style={d.cardTitle}>Customer</Text><Info label="Name" value={request.customerName || "Customer"} />{!isTerminal ? <Info label="Email" value={request.customerEmail || "Not provided"} /> : null}</View>
        <View style={s.card}><Text style={d.cardTitle}>Vehicle</Text><Info label="Vehicle" value={request.vehicle} /><Info label="Year" value={String(request.vehicleYear)} /><Info label="Plate number" value={request.vehiclePlate} /></View>
        <View style={s.card}><Text style={d.cardTitle}>Service request</Text><Info label="Problem / service requested" value={request.problem} /><Info label="Additional notes" value={request.notes} /><Info label="Starting price (not a final bill)" value={request.startingPrice} />{request.status === "completed" ? <Info label="Final Price" value={typeof request.finalPrice === "number" ? formatPesoAmount(request.finalPrice) : "Final price not recorded"} /> : null}{request.completionNote ? <Info label="Completion note" value={request.completionNote} /> : null}</View>
        {request.cancellationReason ? <View style={s.card}><Text style={d.cardTitle}>Owner cancellation reason</Text><Text style={s.muted}>{request.cancellationReason}</Text></View> : null}
        {request.declineReason ? <View style={s.card}><Text style={d.cardTitle}>Provider decline reason</Text><Text style={s.muted}>{request.declineReason}</Text></View> : null}
        <View style={s.card}><Text style={d.cardTitle}>Location</Text><Info label="Customer location" value={formatLocation(request)} />
          {!isTerminal && Number.isFinite(request.latitude) && Number.isFinite(request.longitude) && <Button title="View Customer Location" secondary onPress={() => void openMap()} />}
          <Info label="Service shop" value={request.providerName} /><Info label="Shop address" value={profile?.address ?? ""} />
          <Text style={s.muted}>Service takes place at the shop. The customer brings the vehicle.</Text>
        </View>
      </ScrollView>
      {!isTerminal ? <View style={d.actionDock}><RequestActions key={`${request.id}:${request.status}`} request={request} /></View> : null}
    </>)}
    {request && <OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`} onCancel={() => setShowMapsConfirmation(false)} />}
  </ShopScreen>;
}

const d = StyleSheet.create({
  summary: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 15, gap: 12 },
  archiveEyebrow: { color: C.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#303135", alignItems: "center", justifyContent: "center" },
  customerCopy: { flex: 1, gap: 3 },
  customerName: { color: C.textPrimary, fontSize: 18, fontWeight: "800" },
  summaryVehicle: { color: C.muted, fontSize: 14 },
  summaryRule: { height: 1, backgroundColor: C.border },
  summaryMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaItem: { flex: 1, gap: 3 },
  metaLabel: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: .6 },
  metaValue: { color: C.textPrimary, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  metaDivider: { width: 1, height: 30, backgroundColor: C.border },
  progressCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, gap: 9 },
  progressHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  progressIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#35191E", alignItems: "center", justifyContent: "center" },
  progressCopy: { flex: 1, gap: 1 },
  progressTitle: { color: C.textPrimary, fontSize: 14, fontWeight: "800" },
  progressSubtitle: { color: C.muted, fontSize: 11, fontWeight: "600" },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: "#45464A", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: C.primary },
  dataScroll: { flex: 1, minHeight: 0 },
  dataContent: { gap: 12, paddingBottom: 4 },
  cardTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 1 },
  actionDock: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
});
