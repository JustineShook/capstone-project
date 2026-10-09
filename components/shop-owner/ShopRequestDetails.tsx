import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
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

  return <ShopScreen title={active ? "Active Service" : "Request Details"} back scrollable={!id}>
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && (active && !id ? <>
      <Text style={s.muted}>Customers bring their vehicles to your shop. Select a service to update its progress.</Text>
      <RequestList requests={requests.filter((item) => isActiveShopService(item.status))} empty="No active services." />
    </> : !request ? <View style={s.card}><Text style={s.title}>Request not found</Text>
      <Text style={s.muted}>This request is missing or is not assigned to your shop.</Text></View> : <>
      <View style={d.summary}>
        <View style={d.summaryTop}><View style={d.avatar}><Feather name="user" size={23} color={C.textPrimary} /></View><View style={d.customerCopy}><Text style={d.customerName}>{request.customerName || "Customer"}</Text><Text style={d.summaryVehicle}>{request.vehicle} · {request.vehicleYear}</Text></View><StatusBadge status={request.status} /></View>
        <View style={d.summaryRule} />
        <View style={d.summaryMeta}><View style={d.metaItem}><Text style={d.metaLabel}>REQUESTED</Text><Text style={d.metaValue}>{formatTime(request.createdAt)}</Text></View><View style={d.metaDivider} /><View style={d.metaItem}><Text style={d.metaLabel}>{request.status === "completed" ? "COMPLETED" : "LAST UPDATED"}</Text><Text style={d.metaValue}>{formatTime(request.updatedAt)}</Text></View></View>
      </View>
      {currentIndex >= 0 && <View style={d.progressCard}><View style={d.progressHeading}><Feather name="activity" size={17} color={C.primary} /><Text style={d.progressTitle}>Service progress</Text></View>
        <View style={d.progressSteps}>{SHOP_STATUS_FLOW.map((status, index) => <View key={status} style={d.progressStep}><View style={[d.stepDot, index < currentIndex || request.status === "completed" ? d.stepDone : null, index === currentIndex && d.stepCurrent]}>{(index < currentIndex || request.status === "completed") && <Feather name="check" size={11} color={C.white} />}</View>{index < SHOP_STATUS_FLOW.length - 1 && <View style={[d.stepLine, index < currentIndex && d.stepLineActive]} />}<Text style={[d.stepLabel, index === currentIndex && d.stepLabelActive]}>{SHOP_STATUS_LABELS[status]}</Text></View>)}</View>
      </View>}
      <ScrollView style={d.dataScroll} contentContainerStyle={d.dataContent} showsVerticalScrollIndicator={false}>
        <View style={s.card}><Text style={d.cardTitle}>Customer</Text><Info label="Name" value={request.customerName} /><Info label="Email" value={request.customerEmail} /></View>
        <View style={s.card}><Text style={d.cardTitle}>Vehicle</Text><Info label="Vehicle" value={request.vehicle} /><Info label="Year" value={String(request.vehicleYear)} /><Info label="Plate number" value={request.vehiclePlate} /></View>
        <View style={s.card}><Text style={d.cardTitle}>Service request</Text><Info label="Problem / service requested" value={request.problem} /><Info label="Additional notes" value={request.notes} /><Info label="Starting price (not a final bill)" value={request.startingPrice} /></View>
        <View style={s.card}><Text style={d.cardTitle}>Location</Text><Info label="Customer location" value={formatLocation(request)} />
          {Number.isFinite(request.latitude) && Number.isFinite(request.longitude) && <Button title="View Customer Location" secondary onPress={() => void openMap()} />}
          {linkError && <Text accessibilityRole="alert" style={s.error}>{linkError}</Text>}
          <Info label="Service shop" value={request.providerName} /><Info label="Shop address" value={profile?.address ?? ""} />
          <Text style={s.muted}>Service takes place at the shop. The customer brings the vehicle.</Text>
        </View>
      </ScrollView>
      <View style={d.actionDock}><RequestActions key={`${request.id}:${request.status}`} request={request} /></View>
    </>)}
  </ShopScreen>;
}

const d = StyleSheet.create({
  summary: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 15, gap: 12 },
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
  progressCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 14, gap: 12 },
  progressHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTitle: { color: C.textPrimary, fontSize: 15, fontWeight: "800" },
  progressSteps: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  progressStep: { flex: 1, alignItems: "center", position: "relative", gap: 6 },
  stepDot: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: "#77797D", backgroundColor: C.surface, alignItems: "center", justifyContent: "center", zIndex: 1 },
  stepDone: { borderColor: C.primary, backgroundColor: C.primary },
  stepCurrent: { borderColor: C.primary, backgroundColor: "#35191E" },
  stepLine: { position: "absolute", height: 2, backgroundColor: "#45464A", left: "50%", right: "-50%", top: 11 },
  stepLineActive: { backgroundColor: C.primary },
  stepLabel: { color: C.muted, fontSize: 10, lineHeight: 13, textAlign: "center" },
  stepLabelActive: { color: C.textPrimary, fontWeight: "800" },
  dataScroll: { flex: 1, minHeight: 0 },
  dataContent: { gap: 12, paddingBottom: 4 },
  cardTitle: { color: C.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 1 },
  actionDock: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
});
