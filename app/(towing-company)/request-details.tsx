import { Platform } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { Animated, PanResponder, Pressable, useWindowDimensions, Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import MapHtmlSurface from "../../components/maps/MapHtmlSurface";
import { completeTowingBooking, getTowingBookingById, updateTowingBookingStatus, updateTowingProviderLocation } from "../../services/owner/towingService";
import { BookingDetailsModal } from "../../components/owner/BookingDetailsModal";
import type { TowingBookingRequest, TowingStatus } from "../../types/owner/towing";
import { BookingTimingBanner } from "../../components/owner/BookingTimingBanner";
import { buildTowingContactUrl } from "../../utils/towingContact";
import { FinalPriceCompletionModal } from "../../components/provider/FinalPriceCompletionModal";
import { formatPesoAmount } from "../../utils/finalPrice";
import { OpenGoogleMapsModal } from "../../components/owner/OpenGoogleMapsModal";
import { ReportProblemAction } from "../../components/owner/ReportProblemModal";
import { DeclineRequestModal } from "../../components/provider/DeclineRequestModal";

const C = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", status: "#F1F5F9", subtle: "#F1F5F9", line: "#D5DEE9", red: "#B4233A", blue: "#0F52BA", primary: "#0F52BA", primaryDark: "#0B3D8A", green: "#166534", warning: "#9A5B00" };
const ACTIVE: TowingStatus[] = ["accepted", "en_route", "arrived", "in_progress"];
const STEPS = ["Accepted", "On the way", "Arrived", "Towing", "Completed"];

function mapHtml(latitude: number, longitude: number, providerLatitude: number, providerLongitude: number) { return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{display:none}.pin{width:24px;height:24px;background:#ef2d45;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg)}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var a=[${providerLatitude},${providerLongitude}],b=[${latitude},${longitude}],m=L.map('map',{zoomControl:false,attributionControl:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);L.polyline([a,b],{color:'#277EF5',weight:5}).addTo(m);L.marker(a,{icon:L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:#277EF5;border:3px solid white;border-radius:50%"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(m);L.marker(b,{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[30,30],iconAnchor:[15,30]})}).addTo(m);var visiblePoints=[a,b],mapTop=45,mapBottom=45;function fitVisible(){m.invalidateSize();m.fitBounds(visiblePoints,{paddingTopLeft:[24,mapTop],paddingBottomRight:[24,mapBottom],maxZoom:16,animate:false});}window.setOverlayPadding=function(top,bottom){mapTop=top;mapBottom=bottom;fitVisible();};fitVisible();</script></body></html>`; }
function nextStatus(status: TowingStatus): TowingStatus | undefined { return ({ accepted: "en_route", en_route: "arrived", arrived: "in_progress", in_progress: "completed" } as Partial<Record<TowingStatus, TowingStatus>>)[status]; }
function actionLabel(status: TowingStatus) { return ({ accepted: "Start route", en_route: "Arrived at pickup", arrived: "Start towing", in_progress: "Complete towing" } as Partial<Record<TowingStatus, string>>)[status]; }
function estimatedPrice(booking: TowingBookingRequest) {
  if (typeof booking.estimatedTotalPrice === "number" && Number.isFinite(booking.estimatedTotalPrice)) return booking.estimatedTotalPrice;
  if (typeof booking.estimatedPrice === "number" && Number.isFinite(booking.estimatedPrice)) return booking.estimatedPrice;
  return undefined;
}
function historyEventDate(status: TowingStatus, completedAt?: string, updatedAt?: string, createdAt?: string) {
  const confirmedCompletion = status === "completed" && !!completedAt;
  const value = confirmedCompletion ? completedAt : updatedAt || createdAt;
  if (!value || Number.isNaN(new Date(value).getTime())) return confirmedCompletion ? "Completion time not recorded" : "Last updated · Date unavailable";
  const label = confirmedCompletion ? "Completed" : "Last updated";
  return `${label} · ${new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
}
function estimatedDistance(booking: TowingBookingRequest) {
  return typeof booking.totalDistanceKm === "number" && Number.isFinite(booking.totalDistanceKm)
    ? `${booking.totalDistanceKm.toFixed(1)} km (estimated)`
    : "Not recorded";
}
function isTowingTerminalStatus(status: TowingStatus): boolean {
  return status === "completed" || status === "cancelled" || status === "rejected";
}

export default function TowingRequestDetailsScreen() {
  const { id, cancellationSource } = useLocalSearchParams<{ id: string; cancellationSource?: string }>(); const router = useRouter(); const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<TowingBookingRequest>(); const [saving, setSaving] = useState(false); const [completionFormVisible, setCompletionFormVisible] = useState(false); const [showMapsConfirmation, setShowMapsConfirmation] = useState(false); const [declineVisible, setDeclineVisible] = useState(false); const [declineReason, setDeclineReason] = useState("");
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [overlayTop, setOverlayTop] = useState(insets.top + 56);
  const [overlayBottom, setOverlayBottom] = useState(0);
  const progressMapRef = useRef<{ injectJavaScript: (script: string) => void }>(null);
  const syncMapPadding = useCallback(() => {
    progressMapRef.current?.injectJavaScript(`window.setOverlayPadding && window.setOverlayPadding(${overlayTop + 16},${overlayBottom + 16}); true;`);
  }, [overlayTop, overlayBottom]);
  useEffect(() => { syncMapPadding(); }, [syncMapPadding]);
  const lastLocationSentAt = useRef(0);
  const back = () => router.replace("/(towing-company)/requests");
  useEffect(() => { if (typeof id === "string") void getTowingBookingById(id).then(setBooking).catch(() => setBooking(undefined)); }, [id]);
  useFocusEffect(useCallback(() => {
    if (!booking || !ACTIVE.includes(booking.status)) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    let browserWatchId: number | undefined;
    const publish = (latitude: number, longitude: number) => {
      if (cancelled || Date.now() - lastLocationSentAt.current < 10_000) return;
      lastLocationSentAt.current = Date.now();
      void updateTowingProviderLocation(booking.id, latitude, longitude).catch(() => undefined);
    };
    void (async () => {
      try {
        if (Platform.OS === "web") {
          if (!navigator.geolocation) return;
          browserWatchId = navigator.geolocation.watchPosition(({ coords }) => publish(coords.latitude, coords.longitude), () => undefined, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 });
          return;
        }
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled || !permission.granted) return;
        const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 10_000 }, position => publish(position.coords.latitude, position.coords.longitude));
        if (cancelled) watcher.remove(); else subscription = watcher;
      } catch { /* Keep the existing booking flow available if GPS is unavailable. */ }
    })();
    return () => { cancelled = true; subscription?.remove(); if (browserWatchId !== undefined && navigator.geolocation) navigator.geolocation.clearWatch(browserWatchId); };
  }, [booking?.id, booking?.status]));
  const update = async (status: TowingStatus, reason?: string) => { if (!booking) return; setSaving(true); try { await updateTowingBookingStatus(booking.id, status, reason); setBooking({ ...booking, status, ...(status === "rejected" ? { declineReason: reason?.trim() } : {}) }); setDeclineVisible(false); setDeclineReason(""); } catch (error) { Alert.alert("Unable to update booking", error instanceof Error ? error.message : "Please try again."); } finally { setSaving(false); } };
  const openMaps = () => {
    if (!booking) return;
    setShowMapsConfirmation(true);
  };
  if (!booking) return <SafeAreaView style={s.loading}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><Text style={s.loadingText}>Loading booking...</Text></SafeAreaView>;
  const active = ACTIVE.includes(booking.status);
  if (isTowingTerminalStatus(booking.status)) {
    return <TowingPastBooking booking={booking} back={back} insetsBottom={insets.bottom} cancellationSource={cancellationSource} />;
  }
  if (booking.status === "completed") return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]}><Header title="Completed Tow" back={back} /><View style={s.completedBanner}><Feather name="check-circle" size={25} color={C.text} /><View><Text style={s.completedTitle}>Towing service completed</Text><Text style={s.completedDate}>{historyEventDate(booking.status, booking.completedAt, booking.updatedAt, booking.createdAt)}</Text></View></View><BookingTimingBanner homeAppearance booking={booking} /><View style={s.recordCard}><Text style={s.vehicle}>{booking.vehicle}</Text><Text style={s.subtle}>{booking.vehicleYear} · {booking.vehiclePlate}</Text><View style={s.rule} /><Detail icon="user" label="Customer" value={booking.customerName || "Customer"} /><Detail icon="truck" label="Towing service" value={booking.towingType || "Not recorded"} /><Detail icon="alert-circle" label="Vehicle condition" value={booking.vehicleCondition || "Not recorded"} /><Detail icon="navigation" label="Estimated trip" value={estimatedDistance(booking)} /><Detail icon="map-pin" label="Pickup location" value={booking.pickupLocation || "Not recorded"} /><Detail icon="flag" label="Destination" value={booking.destination || "Not recorded"} /><Detail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."} />{estimatedPrice(booking) != null ? <Detail icon="credit-card" label="Estimated Price" value={formatPesoAmount(estimatedPrice(booking)!)} /> : null}<View style={s.fee}><Text style={s.detailLabel}>Final Price</Text><Text style={s.amount}>{typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded"}</Text>{booking.completionNote?.trim() ? <Text style={s.amount}>Service Completion Notes: {booking.completionNote}</Text> : null}</View></View></ScrollView><ReportProblemAction homeAppearance booking={booking} /></SafeAreaView>;
  if (booking.status === "cancelled" || booking.status === "rejected") {
    const wasCancelled = booking.status === "cancelled";
    const wasCustomerCancelled = cancellationSource === "customer";
    return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 18 }]}><Header title={wasCancelled ? "Cancelled Tow" : "Declined Request"} back={back} /><View style={[s.completedBanner, { backgroundColor: "#48262B" }]}><Feather name={wasCancelled ? "x-circle" : "slash"} size={25} color={C.text} /><View><Text style={s.completedTitle}>{wasCustomerCancelled ? "Customer cancelled towing service" : wasCancelled ? "Towing request cancelled" : "Request declined"}</Text><Text style={s.completedDate}>{historyEventDate(booking.status, booking.completedAt, booking.updatedAt, booking.createdAt)}</Text></View></View><BookingTimingBanner homeAppearance booking={booking} /><View style={s.recordCard}><Text style={s.vehicle}>{booking.vehicle}</Text><Text style={s.subtle}>{booking.vehicleYear} · {booking.vehiclePlate}</Text><View style={s.rule} /><Detail icon="user" label="Customer" value={booking.customerName || "Customer"} /><Detail icon="truck" label="Towing service" value={booking.towingType || "Towing request"} /><Detail icon="map-pin" label="Pickup location" value={booking.pickupLocation || "Not recorded"} /><Detail icon="flag" label="Destination" value={booking.destination || "Not recorded"} /><Detail icon="alert-circle" label="Vehicle condition" value={booking.vehicleCondition || "Not recorded"} /><Detail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."} />{booking.cancellationReason ? <Detail icon="message-circle" label="Owner cancellation reason" value={booking.cancellationReason} /> : null}{booking.declineReason ? <Detail icon="message-circle" label="Provider decline reason" value={booking.declineReason} /> : null}<Detail icon="navigation" label="Estimated trip" value={estimatedDistance(booking)} /><View style={s.fee}><Text style={s.detailLabel}>{booking.pricingMode === "dispatcher" ? "Pricing" : "Estimated price"}</Text><Text style={s.amount}>{booking.startingPrice || "Price not recorded"}</Text></View><View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#281B20", borderRadius: 10, padding: 12, marginTop: 4 }}><Feather name="info" size={17} color="#FF8995" /><Text style={{ color: "#FFD6DA", fontSize: 13, lineHeight: 19, flex: 1 }}>{wasCustomerCancelled ? "The customer cancelled this towing request. No further action is needed." : wasCancelled ? "This towing request was cancelled and is now closed." : "This towing request was declined and is now closed."}</Text></View></View></ScrollView></SafeAreaView>;
  }
  if (!active) return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ScrollView style={{flex:1}} contentContainerStyle={[s.content, { paddingBottom: 18 }]}><Header title="New Booking Request" back={back} /><BookingTimingBanner homeAppearance booking={booking} /><View style={s.requestCard}><View style={s.cardTop}><Text style={s.newBadge}>New request</Text><Text style={s.time}>Respond when ready</Text></View><Text style={s.vehicle}>{booking.vehicle}</Text><Text style={s.service}>{booking.towingType}</Text><View style={s.rule} /><Detail icon="map-pin" label="Pickup location" value={booking.pickupLocation || "Not recorded"} /><Detail icon="flag" label="Destination" value={booking.destination || "Not recorded"} /><Detail icon="alert-circle" label="Vehicle condition" value={booking.vehicleCondition || "Not recorded"} /><Detail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."} /><Detail icon="credit-card" label="Price" value={booking.startingPrice} /><View style={s.customerRow}><View style={s.personIcon}><Feather name="user" size={18} color={C.text} /></View><Text style={s.customerName}>{booking.customerName}</Text></View></View><MapPreview booking={booking} openMaps={openMaps} /></ScrollView><View style={[s.pendingFooter,{paddingBottom:Math.max(insets.bottom,12)}]}><View style={s.actionRow}><TouchableOpacity disabled={saving} style={s.decline} onPress={() => setDeclineVisible(true)}><Text style={s.declineText}>Decline</Text></TouchableOpacity><TouchableOpacity disabled={saving} style={s.primary} onPress={() => void update("accepted")}><Text style={s.primaryText}>{saving ? "Saving..." : "Accept"}</Text></TouchableOpacity></View></View><OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/dir/?api=1&destination=${booking.status === "in_progress" ? booking.destinationLatitude : booking.latitude},${booking.status === "in_progress" ? booking.destinationLongitude : booking.longitude}`} onCancel={() => setShowMapsConfirmation(false)} /><DeclineRequestModal appearance="light" visible={declineVisible} reason={declineReason} saving={saving} onReasonChange={setDeclineReason} onCancel={() => setDeclineVisible(false)} onConfirm={() => void update("rejected", declineReason)} /></SafeAreaView>;
  const currentStep = booking.status === "accepted" ? 0 : booking.status === "en_route" ? 1 : booking.status === "arrived" ? 2 : 3;
  const headingToDestination = booking.status === "in_progress";
  const targetLatitude = headingToDestination ? booking.destinationLatitude : booking.latitude;
  const targetLongitude = headingToDestination ? booking.destinationLongitude : booking.longitude;
  const targetName = headingToDestination ? booking.destination : booking.pickupLocation;
  const estimatedFinalPrice = estimatedPrice(booking);
  const customerPhone = booking.customerPhone?.trim();
  const openContactApp = (scheme: "tel" | "sms") => {
    const url = buildTowingContactUrl(scheme, customerPhone);
    if (!url) {
      Alert.alert("Contact number unavailable", "The saved contact number cannot be used. Ask the Vehicle Owner to update their profile.");
      return;
    }
    void Linking.openURL(url).catch(() => Alert.alert("Unable to open contact app", "Please try again or contact the Vehicle Owner another way."));
  };
  const reviewCompletion = (amount: number, completionNote: string) => {
    if (!booking || saving) return;
    setSaving(true);
    void completeTowingBooking(booking.id, amount, completionNote).then(() => {
      const completedAt = new Date().toISOString();
      setBooking({ ...booking, status: "completed", finalPrice: amount, ...(completionNote ? { completionNote } : {}), completedAt, updatedAt: completedAt });
      setCompletionFormVisible(false);
    }).catch((error) => Alert.alert("Unable to complete tow", error instanceof Error ? error.message : "Please try again.")).finally(() => setSaving(false));
  };
  return <View style={s.activeRoot}>
    <StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
    <MapHtmlSurface ref={progressMapRef} onLoadEnd={syncMapPadding} sourceHtml={mapHtml(targetLatitude, targetLongitude, booking.providerLatitude, booking.providerLongitude)} style={s.map} />
    <View onLayout={event => setOverlayTop(event.nativeEvent.layout.y + event.nativeEvent.layout.height)} style={{ position: "absolute", top: insets.top + 12, left: insets.left + 16 }}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to requests" onPress={back} style={s.back}><Feather name="chevron-left" size={28} color="#FFFFFF" /></TouchableOpacity></View>
    <JobProgressSheet onHeightChange={setOverlayBottom} onDetails={() => setDetailsVisible(true)} action={<TouchableOpacity disabled={saving} style={s.bottomAction} onPress={() => { const next = nextStatus(booking.status); if (next === "completed") setCompletionFormVisible(true); else if (next) void update(next); }}><Text style={s.primaryText}>{saving ? "Saving..." : actionLabel(booking.status)}</Text></TouchableOpacity>}>
      <View style={s.destination}><Feather name="map-pin" size={20} color={C.red} /><View style={{ flex: 1 }}><Text style={s.destinationTitle}>{headingToDestination ? "Tow vehicle to destination" : "Head to the pickup location"}</Text><Text style={s.destinationText}>{targetName}</Text></View></View>
      <TouchableOpacity style={s.navigate} onPress={openMaps}><Feather name="navigation" size={17} color="#fff" /><Text style={s.primaryText}>Navigate</Text></TouchableOpacity>
      <BookingTimingBanner homeAppearance booking={booking} />
      <View style={s.etaCard}><View style={{ flex: 1 }}><Text style={s.etaLabel}>{headingToDestination ? "DESTINATION" : "TOWING JOB"}</Text><Text style={s.eta}>{booking.totalDistanceKm.toFixed(1)} km</Text><Text style={s.destinationText}>{targetName}</Text></View><View style={s.contactActions}>{(["tel", "sms"] as const).map((scheme) => <TouchableOpacity key={scheme} disabled={!customerPhone} style={[scheme === "tel" ? progressStyles.contactIconButton : s.contactAction, !customerPhone && s.contactActionDisabled]} onPress={() => openContactApp(scheme)} accessibilityRole="button" accessibilityState={{ disabled: !customerPhone }} accessibilityLabel={scheme === "tel" ? "Call Vehicle Owner" : "Text Vehicle Owner"}>{scheme === "tel" ? <Ionicons name="call-outline" size={18} color={C.primary} /> : <><Feather name="message-circle" size={18} color={C.text} /><Text style={s.contactActionLabel}>SMS</Text></>}</TouchableOpacity>)}</View></View>
      {!customerPhone && <Text style={s.unavailableContact}>Contact number unavailable.</Text>}
      <View style={s.steps}>{STEPS.map((step, index) => <View key={step} style={s.step}><View style={[s.stepDot, index <= currentStep && s.stepDotActive]}>{index < currentStep && <Feather name="check" size={10} color="#fff" />}</View><Text style={[s.stepText, index === currentStep && s.stepTextActive]}>{step}</Text></View>)}</View>
      <ReportProblemAction homeAppearance booking={booking} />
    </JobProgressSheet>
    <BookingDetailsModal visible={detailsVisible} onClose={() => setDetailsVisible(false)}>
      <BookingTimingBanner homeAppearance booking={booking} />
      <Detail icon="user" label="Customer" value={booking.customerName}/><Detail icon="phone" label="Contact" value={booking.customerPhone || "Not provided"}/><Detail icon="map-pin" label="Saved pickup" value={booking.pickupLocation}/><Detail icon="flag" label="Saved destination" value={booking.destination}/><Detail icon="truck" label="Towing service" value={booking.towingType}/><Detail icon="alert-circle" label="Vehicle condition" value={booking.vehicleCondition}/><Detail icon="navigation" label="Estimated trip" value={estimatedDistance(booking)}/><Detail icon="credit-card" label="Price" value={booking.startingPrice}/><Detail icon="file-text" label="Notes" value={booking.notes?.trim() || "No additional notes"}/>
      <Detail icon="truck" label="Vehicle" value={booking.vehicle}/>
      <Detail icon="calendar" label="Vehicle year" value={String(booking.vehicleYear)}/>
      <Detail icon="hash" label="Plate" value={booking.vehiclePlate}/>
      <Detail icon="file-text" label="Booking ID" value={booking.id}/>
      {booking.declineReason ? <Detail icon="message-circle" label="Decline reason" value={booking.declineReason}/> : null}
      {booking.cancellationReason ? <Detail icon="message-circle" label="Cancellation reason" value={booking.cancellationReason}/> : null}
    </BookingDetailsModal>
    <FinalPriceCompletionModal appearance="mechanic" visible={completionFormVisible} estimatedPrice={estimatedFinalPrice} saving={saving} onCancel={() => setCompletionFormVisible(false)} onReview={reviewCompletion} />
    <OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/dir/?api=1&destination=${targetLatitude},${targetLongitude}`} onCancel={() => setShowMapsConfirmation(false)} />
  </View>;
}
function Header({ title, back, archive = false }: { title: string; back: () => void; archive?: boolean }) { return <View style={archive ? historyStyles.detailHeader : s.header}><TouchableOpacity onPress={back} style={s.back}><Feather name="chevron-left" size={28} color="#FFFFFF" /></TouchableOpacity><Text style={archive ? historyStyles.detailHeaderTitle : s.headerTitle}>{title}</Text></View>; }
const historyStyles = StyleSheet.create({
  archiveCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 3 }, default: {} }) },
  recordEyebrow: { fontSize: 10, fontWeight: '800', color: C.primaryDark, letterSpacing: 1, marginBottom: 5 },
  recordTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: C.text, marginBottom: 4 },
  recordDate: { fontSize: 13, lineHeight: 19, color: C.muted },
  recordSectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { fontSize: 12, color: C.muted, width: 90 },
  detailValue: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500', color: C.text, textAlign: 'right' },
  reasonText: { fontSize: 13, lineHeight: 19, color: C.text },

pastSafe: { backgroundColor: C.primary },
detailHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: C.primary },
detailHeaderTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '700', flex: 1 },
detailBack: { width: 44, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
detailScroll: { flex: 1, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
detailContent: { paddingHorizontal: 16, paddingTop: 16 },
completedStatus: { color: C.green },
});
function TowingPastBooking({ booking, back, insetsBottom, cancellationSource }: { booking: TowingBookingRequest; back: () => void; insetsBottom: number; cancellationSource?: string }) {
  const completed = booking.status === "completed";
  const cancelled = booking.status === "cancelled";
  const statusLabel = completed ? "Completed" : cancelled ? "Cancelled" : "Declined";
  return <SafeAreaView style={[s.safe, historyStyles.pastSafe]} edges={["top", "left", "right"]}>
    <StatusBar barStyle="light-content" backgroundColor={C.primary} />
    <View style={historyStyles.detailHeader}>
      <TouchableOpacity onPress={back} style={historyStyles.detailBack} accessibilityRole="button" accessibilityLabel="Back to history"><Feather name="chevron-left" size={28} color="#FFFFFF" /></TouchableOpacity>
      <Text style={historyStyles.detailHeaderTitle}>Past Booking Details</Text>
    </View>
    <ScrollView style={historyStyles.detailScroll} contentContainerStyle={[historyStyles.detailContent, { paddingBottom: insetsBottom + 18 }]} showsVerticalScrollIndicator={false}>
      <View style={historyStyles.archiveCard}>
        <Text style={historyStyles.recordEyebrow}>PAST BOOKING RECORD</Text><Text style={[historyStyles.recordTitle, completed && historyStyles.completedStatus]}>{statusLabel}</Text><Text style={historyStyles.recordDate}>{historyEventDate(booking.status, booking.completedAt, booking.updatedAt, booking.createdAt)}</Text>
      </View>
      <BookingTimingBanner homeAppearance booking={booking} />
      <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Customer and vehicle</Text><HistoryDetail icon="user" label="Customer" value={booking.customerName || "Customer"}/><HistoryDetail icon="truck" label="Vehicle" value={booking.vehicle || "Vehicle not recorded"}/><HistoryDetail icon="calendar" label="Year" value={booking.vehicleYear ? String(booking.vehicleYear) : "Not recorded"}/><HistoryDetail icon="tag" label="Plate number" value={booking.vehiclePlate || "Plate not recorded"} last/></View>
      <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Towing service and route</Text><HistoryDetail icon="truck" label="Towing service" value={booking.towingType || "Not recorded"}/><HistoryDetail icon="alert-circle" label="Vehicle condition" value={booking.vehicleCondition || "Not recorded"}/><HistoryDetail icon="map-pin" label="Pickup location" value={booking.pickupLocation || "Not recorded"}/><HistoryDetail icon="flag" label="Destination" value={booking.destination || "Not recorded"}/><HistoryDetail icon="navigation" label="Estimated trip" value={estimatedDistance(booking)}/><HistoryDetail icon="file-text" label="Notes" value={booking.notes?.trim() || "No additional notes"} last/></View>
      {booking.cancellationReason ? <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Owner cancellation reason</Text><Text style={historyStyles.reasonText}>{booking.cancellationReason}</Text></View> : null}
      {booking.declineReason ? <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Provider decline reason</Text><Text style={historyStyles.reasonText}>{booking.declineReason}</Text></View> : null}
      <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Price information</Text>{completed && estimatedPrice(booking) != null ? <HistoryDetail icon="credit-card" label="Estimated price" value={formatPesoAmount(estimatedPrice(booking)!)}/>:null}<HistoryDetail icon="dollar-sign" label={completed ? "Final price" : booking.pricingMode === "dispatcher" ? "Pricing" : "Estimated price"} value={completed ? typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded" : booking.startingPrice || "Price not recorded"} last/>{completed && booking.completionNote?.trim() ? <HistoryDetail icon="file-text" label="Service notes" value={booking.completionNote} last/> : null}</View>
      {!completed ? <View style={historyStyles.archiveCard}><Text style={historyStyles.recordSectionTitle}>Booking notice</Text><Text style={historyStyles.reasonText}>{cancellationSource === "customer" ? "The customer cancelled this towing request. No further action is needed." : cancelled ? "This towing request was cancelled and is now closed." : "This towing request was declined and is now closed."}</Text></View> : null}
    </ScrollView>
  </SafeAreaView>;
}
function Detail({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) { return <View style={s.detail}><Feather name={icon} size={18} color={C.muted} /><View style={{ flex: 1 }}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value}</Text></View></View>; }
function HistoryDetail({ icon, label, value, last = false }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; last?: boolean }) { return <View style={[historyStyles.detailRow, last && historyStyles.detailRowLast]}><Feather name={icon} size={16} color={C.muted}/><Text style={historyStyles.detailLabel}>{label}</Text><Text style={historyStyles.detailValue}>{value || "Not recorded"}</Text></View>; }
function MapPreview({ booking, openMaps }: { booking: TowingBookingRequest; openMaps: () => void }) { return <View style={s.mapPreview}><MapHtmlSurface sourceHtml={mapHtml(booking.latitude, booking.longitude, booking.providerLatitude, booking.providerLongitude)} style={{ flex: 1 }} /><TouchableOpacity style={s.mapButton} onPress={openMaps}><Feather name="navigation" size={16} color="#fff" /><Text style={s.mapButtonText}>View in Maps</Text></TouchableOpacity></View>; }
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 }, loading: { flex: 1, backgroundColor: C.canvas, justifyContent: 'center', alignItems: 'center', gap: 18 }, loadingText: { color: C.text, fontSize: 17 }, backText: { color: C.text, fontSize: 16 }, header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, back: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: C.primary }, headerTitle: { color: C.text, fontSize: 19, fontWeight: '700', flex: 1, flexShrink: 1 }, completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#EAF6EE', borderRadius: 14, padding: 15, marginBottom: 12 }, completedTitle: { color: C.text, fontSize: 17, fontWeight: '700' }, completedDate: { color: C.muted, fontSize: 13, marginTop: 3 }, recordCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16 }, requestCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, newBadge: { backgroundColor: '#FFF4E5', color: '#9A5B00', fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, time: { color: C.muted, fontSize: 13, flexShrink: 1, textAlign: 'right' }, vehicle: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: '700', marginTop: 16 }, service: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 5 }, subtle: { color: C.muted, fontSize: 15, marginTop: 4 }, rule: { height: 1, backgroundColor: C.line, marginVertical: 16 }, detail: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 14 }, detailLabel: { color: C.muted, fontSize: 12 }, detailValue: { color: C.text, fontSize: 15, lineHeight: 21, marginTop: 2, flexShrink: 1 }, customerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 }, personIcon: { height: 42, width: 42, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, customerName: { color: C.text, fontSize: 16, fontWeight: '700', flexShrink: 1 }, fee: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, marginTop: 2 }, amount: { color: C.text, fontSize: 25, fontWeight: '700', marginTop: 4 }, mapPreview: { height: 185, borderRadius: 14, overflow: 'hidden', marginTop: 14, position: 'relative', backgroundColor: C.subtle }, mapButton: { position: 'absolute', right: 12, bottom: 12, minHeight: 46, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, mapButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }, pendingFooter: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.canvas, borderTopWidth: 1, borderTopColor: C.line }, actionRow: { flexDirection: 'row', gap: 12 }, decline: { minHeight: 54, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#FDECEF' }, declineText: { color: C.red, fontSize: 15, fontWeight: '700' }, primary: { minHeight: 54, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: C.blue }, primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, activeRoot: { flex: 1, backgroundColor: C.canvas }, map: { ...StyleSheet.absoluteFillObject }, activeHeader: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 56, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, topJobCard: { position: 'absolute', top: 84, left: 16, right: 16, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 14, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, jobPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 8 }, default: {} }) }, destination: { backgroundColor: C.subtle, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, destinationTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }, destinationText: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 3, flexShrink: 1 }, navigate: { minHeight: 54, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10 }, etaCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: C.subtle, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }, etaLabel: { color: C.muted, fontSize: 12, fontWeight: '700' }, eta: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 2 }, contactActions: { flexDirection: "row", alignItems: "center", gap: 8 }, contactAction: { flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', borderColor: C.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, minHeight: 48, backgroundColor: C.card, width: 54 }, contactActionDisabled: { opacity: 0.4 }, contactActionLabel: { color: C.primary, fontSize: 11, fontWeight: '700' ,lineHeight: 16}, unavailableContact: { color: C.muted, fontSize: 12, marginTop: 3 ,lineHeight: 17}, steps: { paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' }, step: { flex: 1, alignItems: 'center' ,width: "20%"}, stepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#8A96A6', alignItems: 'center', justifyContent: 'center' }, stepDotActive: { borderColor: C.blue, backgroundColor: C.blue }, stepText: { color: C.muted, fontSize: 9, marginTop: 5, textAlign: 'center' }, stepTextActive: { color: C.text, fontWeight: '700' }, bottomAction: { minHeight: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: C.blue, borderRadius: 14, marginTop: 4 } ,
activeHeaderTitle: { color: '#FFFFFF' },
});

function JobProgressSheet({ children, action, onDetails, onHeightChange }: { children: ReactNode; action: ReactNode; onDetails: () => void; onHeightChange: (height: number) => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const expanded = Math.min(height * 0.58, Math.max(160, height - insets.top - 56 - 112));
  const collapsed = Math.min(190 + insets.bottom, expanded);
  const size = useRef(new Animated.Value(expanded)).current;
  const current = useRef(expanded);
  const dragStart = useRef(expanded);
  const collapsedTarget = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const snap = useCallback((collapse: boolean) => {
    collapsedTarget.current = collapse;
    const target = collapse ? collapsed : expanded;
    size.stopAnimation();
    Animated.spring(size, { toValue: target, useNativeDriver: false, bounciness: 4 }).start(({ finished }) => { if (finished) onHeightChange(target); });
  }, [collapsed, expanded, size, onHeightChange]);
  useEffect(() => {
    const listener = size.addListener(({ value }) => { current.current = value; });
    snap(collapsedTarget.current);
    return () => { size.removeListener(listener); size.stopAnimation(); };
  }, [size, snap]);
  const gestures = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { size.stopAnimation(); dragStart.current = current.current; scrollRef.current?.scrollTo({ y: 0, animated: false }); },
    onPanResponderMove: (_, gesture) => size.setValue(Math.max(collapsed, Math.min(expanded, dragStart.current - gesture.dy))),
    onPanResponderRelease: (_, gesture) => snap(gesture.vy > 0.4 || (gesture.vy >= -0.4 && dragStart.current - gesture.dy < (collapsed + expanded) / 2)),
    onPanResponderTerminate: () => snap(collapsedTarget.current),
  }), [collapsed, expanded, size, snap]);
  return <Animated.View onLayout={event => {
    const measuredHeight = event.nativeEvent.layout.height;
    const target = collapsedTarget.current ? collapsed : expanded;
    if (Math.abs(measuredHeight - target) < 1) onHeightChange(measuredHeight);
  }} style={[progressStyles.sheet, { height: size, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View {...gestures.panHandlers}><Pressable onPress={() => snap(!collapsedTarget.current)} accessibilityRole="button" accessibilityLabel="Expand or collapse job progress" style={progressStyles.handleTouch}><View style={progressStyles.handle}/></Pressable></View>
    <ScrollView ref={scrollRef} style={progressStyles.scroll} contentContainerStyle={progressStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>{children}</ScrollView>
    <View style={progressStyles.footer}>
      <Pressable accessibilityRole="button" onPress={onDetails} style={progressStyles.details}><Text style={progressStyles.detailsText}>Booking Details</Text></Pressable>
      <View style={progressStyles.action}>{action}</View>
    </View>
  </Animated.View>;
}
const progressStyles = StyleSheet.create({
  contactIconButton: { width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: "#0F52BA", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", elevation: 10, shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
  handleTouch: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D5DEE9" },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  footer: { padding: 12, gap: 10, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderTopColor: "#D5DEE9" },
  details: { flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: "#0F52BA", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  detailsText: { color: "#0F52BA", fontSize: 14, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  action: { flex: 1 },
});
