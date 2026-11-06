import { Feather, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Location from "expo-location";
import { Animated, PanResponder, Pressable, useWindowDimensions, Alert, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import MapHtmlSurface from "../../components/maps/MapHtmlSurface";
import { completeMechanicBooking, getBookingById, updateBookingStatus, updateMechanicLocation } from "../../services/owner/bookingService";
import { BookingDetailsModal } from "../../components/owner/BookingDetailsModal";
import type { BookingRequest, BookingStatus } from "../../types/owner/booking";
import { BookingTimingBanner } from "../../components/owner/BookingTimingBanner";
import { ReportProblemAction } from "../../components/owner/ReportProblemModal";
import { FinalPriceCompletionModal } from "../../components/provider/FinalPriceCompletionModal";
import { formatPesoAmount } from "../../utils/finalPrice";
import { OpenGoogleMapsModal } from "../../components/owner/OpenGoogleMapsModal";
import { DeclineRequestModal } from "../../components/provider/DeclineRequestModal";

const COLORS = { canvas: "#FFFFFF", card: "#FFFFFF", text: "#172B4D", muted: "#526277", status: "#F1F5F9", subtle: "#F1F5F9", line: "#D5DEE9", red: "#B4233A", blue: "#0F52BA", primary: "#0F52BA", primaryDark: "#0B3D8A", green: "#166534", warning: "#9A5B00" };
const ACTIVE_STATUSES: BookingStatus[] = ["accepted", "en_route", "arrived", "in_progress"];
const STEPS = ["Accepted", "On the way", "Arrived", "In progress", "Completed"];

function mapHtml(latitude: number, longitude: number, mechanicLatitude?: number, mechanicLongitude?: number) {
  const hasMechanicLocation = Number.isFinite(mechanicLatitude) && Number.isFinite(mechanicLongitude);
  const mechanicMarker = hasMechanicLocation
    ? `var o=[${mechanicLatitude},${mechanicLongitude}];L.polyline([o,c],{color:'#277EF5',weight:5,opacity:.9}).addTo(m);L.marker(o,{icon:L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:#277EF5;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px #333"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(m);visiblePoints=[o,c];fitVisible();`
    : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{display:none}.pin{width:24px;height:24px;background:#ef2d45;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 5px #333}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var c=[${latitude},${longitude}];var m=L.map('map',{zoomControl:false,attributionControl:false}).setView(c,14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(m);var visiblePoints=[c],mapTop=45,mapBottom=45;function fitVisible(){m.invalidateSize();m.fitBounds(visiblePoints,{paddingTopLeft:[24,mapTop],paddingBottomRight:[24,mapBottom],maxZoom:16,animate:false});}window.setOverlayPadding=function(top,bottom){mapTop=top;mapBottom=bottom;fitVisible();};L.marker(c,{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[30,30],iconAnchor:[15,30]})}).addTo(m);${mechanicMarker}</script></body></html>`;
}
function locationText(booking: BookingRequest) {
  if (booking.customerAddress?.trim()) return booking.customerAddress.trim();
  return Number.isFinite(booking.latitude) && Number.isFinite(booking.longitude)
    ? `${booking.latitude.toFixed(4)}, ${booking.longitude.toFixed(4)}`
    : "Location not recorded";
}
function historyEventDate(status: BookingStatus, completedAt?: string, updatedAt?: string, createdAt?: string) {
  const isConfirmedCompletion = status === "completed" && !!completedAt;
  const value = isConfirmedCompletion ? completedAt : updatedAt || createdAt;
  if (!value || Number.isNaN(new Date(value).getTime())) return isConfirmedCompletion ? "Completion time not recorded" : "Last updated · Date unavailable";
  const label = isConfirmedCompletion ? "Completed" : "Last updated";
  return `${label} · ${new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
}
function nextStatus(status: BookingStatus): BookingStatus | undefined {
  return ({ accepted: "en_route", en_route: "arrived", arrived: "in_progress", in_progress: "completed" } as Partial<Record<BookingStatus, BookingStatus>>)[status];
}
function actionLabel(status: BookingStatus) {
  return ({ accepted: "Start route", en_route: "Arrived at location", arrived: "Start service", in_progress: "Complete service" } as Partial<Record<BookingStatus, string>>)[status];
}

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets();
  const goToBookings = () => router.replace("/(onsite-mechanic)/requests");
  const [booking, setBooking] = useState<BookingRequest>(); const [mechanicLocation, setMechanicLocation] = useState<{ latitude: number; longitude: number }>(); const [locationTrackingError, setLocationTrackingError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [completionFormVisible, setCompletionFormVisible] = useState(false); const [showMapsConfirmation, setShowMapsConfirmation] = useState(false); const [declineVisible, setDeclineVisible] = useState(false); const [declineReason, setDeclineReason] = useState("");
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [overlayTop, setOverlayTop] = useState(insets.top + 56);
  const [overlayBottom, setOverlayBottom] = useState(0);
  const progressMapRef = useRef<{ injectJavaScript: (script: string) => void }>(null);
  const syncMapPadding = useCallback(() => {
    progressMapRef.current?.injectJavaScript(`window.setOverlayPadding && window.setOverlayPadding(${overlayTop + 16},${overlayBottom + 16}); true;`);
  }, [overlayTop, overlayBottom]);
  useEffect(() => { syncMapPadding(); }, [syncMapPadding]);
  const lastLocationSentAt = useRef(0);
  const activeBookingId = booking?.id;
  const activeBookingStatus = booking?.status;
  useEffect(() => { if (typeof id === "string") void getBookingById(id).then(setBooking).catch(() => setBooking(undefined)); }, [id]);
  useFocusEffect(useCallback(() => {
    setLocationTrackingError(null);
    if (!activeBookingId || !activeBookingStatus || !ACTIVE_STATUSES.includes(activeBookingStatus)) return;
    let subscription: Location.LocationSubscription | undefined;
    let browserWatchId: number | undefined;
    let cancelled = false;
    const handlePosition = (latitude: number, longitude: number) => {
      if (cancelled) return;
      setLocationTrackingError(null);
      setMechanicLocation({ latitude, longitude });
      const now = Date.now();
      if (now - lastLocationSentAt.current < 10_000) return;
      lastLocationSentAt.current = now;
      void updateMechanicLocation(activeBookingId, latitude, longitude).catch(() => undefined);
    };
    const handleBrowserError = (reason: GeolocationPositionError) => {
      if (cancelled) return;
      const message = reason.code === 1
        ? "Location permission was denied. Allow location access in your browser settings to share your live location with the customer."
        : reason.code === 2
          ? "Your location is unavailable. Check your device's location settings and try again."
          : reason.code === 3
            ? "Getting your location took too long. Check your connection and try again."
            : "We couldn't get your current location. Please try again.";
      setLocationTrackingError(message);
    };
    void (async () => {
      try {
        if (Platform.OS === "web") {
          if (!navigator.geolocation) {
            setLocationTrackingError("Location tracking is not available in this browser.");
            return;
          }
          browserWatchId = navigator.geolocation.watchPosition(
            ({ coords }) => handlePosition(coords.latitude, coords.longitude),
            handleBrowserError,
            { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
          );
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setLocationTrackingError("Location permission was denied. Enable location access in your device settings to share your live location with the customer.");
          return;
        }
        const nextSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 10_000 },
          (position) => handlePosition(position.coords.latitude, position.coords.longitude)
        );
        if (cancelled) nextSubscription.remove();
        else subscription = nextSubscription;
      } catch (error) {
        if (!cancelled) setLocationTrackingError(error instanceof Error ? error.message : "We couldn't start location tracking. Please check location access and try again.");
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
      if (browserWatchId !== undefined && navigator.geolocation) navigator.geolocation.clearWatch(browserWatchId);
    };
  }, [activeBookingId, activeBookingStatus]));
  const isActive = !!booking && ACTIVE_STATUSES.includes(booking.status);
  const update = async (status: BookingStatus, reason?: string) => { if (!booking) return; setSaving(true); try { await updateBookingStatus(booking.id, status, reason); setBooking({ ...booking, status, ...(status === "rejected" ? { declineReason: reason?.trim() } : {}) }); setDeclineVisible(false); setDeclineReason(""); } catch (error) { Alert.alert("Unable to update booking", error instanceof Error ? error.message : "Please try again."); } finally { setSaving(false); } };
  const openMaps = () => { if (booking) setShowMapsConfirmation(true); };
  const callCustomer = () => { const phone = booking?.customerPhone?.trim(); if (!phone) { Alert.alert("Phone number unavailable", "This booking does not include a customer phone number."); return; } void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`); };
  if (!booking) return <SafeAreaView style={styles.loading}><StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas}/><Text style={styles.loadingText}>Loading booking…</Text></SafeAreaView>;
  if (booking.status === "completed") return <SafeAreaView style={[styles.safeArea,historyStyles.pastSafe]} edges={["top","left","right"]}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.primary}/>
    <View style={historyStyles.detailHeader}><TouchableOpacity onPress={goToBookings} style={historyStyles.detailBack} accessibilityRole="button" accessibilityLabel="Back to history"><Feather name="chevron-left" size={28} color="#FFFFFF"/></TouchableOpacity><Text style={historyStyles.detailHeaderTitle}>Past Booking Details</Text></View>
    <ScrollView style={historyStyles.detailScroll} contentContainerStyle={[historyStyles.detailContent,{paddingBottom:insets.bottom+18}]} showsVerticalScrollIndicator={false}>
      <View style={historyStyles.archiveCard}><Text style={historyStyles.eyebrow}>PAST BOOKING RECORD</Text><Text style={[historyStyles.archiveTitle,historyStyles.completedStatus]}>Completed</Text><Text style={historyStyles.archiveDate}>{historyEventDate(booking.status, booking.completedAt, booking.updatedAt, booking.createdAt)}</Text></View>
      <BookingTimingBanner homeAppearance booking={booking}/>
      <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Customer and vehicle</Text><HistoryDetail icon="user" label="Customer" value={booking.customerName || "Customer"}/><HistoryDetail icon="truck" label="Vehicle" value={booking.vehicle || "Vehicle not recorded"}/><HistoryDetail icon="calendar" label="Year" value={booking.vehicleYear ? String(booking.vehicleYear) : "Not recorded"}/><HistoryDetail icon="tag" label="Plate number" value={booking.vehiclePlate || "Plate not recorded"} last/></View>
      <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Service and location</Text><HistoryDetail icon="tool" label="Service needed" value={booking.problem || "Mechanic service"}/><HistoryDetail icon="map-pin" label="Service address" value={locationText(booking)}/><HistoryDetail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."} last/></View>
      <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Price information</Text><HistoryDetail icon="credit-card" label="Final price" value={typeof booking.finalPrice === "number" ? formatPesoAmount(booking.finalPrice) : "Final price not recorded"} last/>{booking.completionNote?.trim() ? <HistoryDetail icon="file-text" label="Service notes" value={booking.completionNote} last/> : null}</View>
    </ScrollView>
    <View style={historyStyles.reportFooter}><ReportProblemAction homeAppearance booking={booking} /></View>
  </SafeAreaView>;
  if (booking.status === "cancelled" || booking.status === "rejected") {
    const wasCancelled = booking.status === "cancelled";
    return <SafeAreaView style={[styles.safeArea,historyStyles.pastSafe]} edges={["top","left","right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary}/>
      <View style={historyStyles.detailHeader}><TouchableOpacity onPress={goToBookings} style={historyStyles.detailBack} accessibilityRole="button" accessibilityLabel="Back to history"><Feather name="chevron-left" size={28} color="#FFFFFF"/></TouchableOpacity><Text style={historyStyles.detailHeaderTitle}>Past Booking Details</Text></View>
      <ScrollView style={historyStyles.detailScroll} contentContainerStyle={[historyStyles.detailContent,{paddingBottom:insets.bottom+18}]} showsVerticalScrollIndicator={false}>
        <View style={historyStyles.archiveCard}><Text style={historyStyles.eyebrow}>PAST BOOKING RECORD</Text><Text style={historyStyles.archiveTitle}>{wasCancelled ? "Cancelled" : "Declined"}</Text><Text style={historyStyles.archiveDate}>{historyEventDate(booking.status, booking.completedAt, booking.updatedAt, booking.createdAt)}</Text></View>
        <BookingTimingBanner homeAppearance booking={booking}/>
        <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Customer and vehicle</Text><HistoryDetail icon="user" label="Customer" value={booking.customerName || "Customer"}/><HistoryDetail icon="truck" label="Vehicle" value={booking.vehicle || "Vehicle not recorded"}/><HistoryDetail icon="calendar" label="Year" value={booking.vehicleYear ? String(booking.vehicleYear) : "Not recorded"}/><HistoryDetail icon="tag" label="Plate number" value={booking.vehiclePlate || "Plate not recorded"} last/></View>
        <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Service and location</Text><HistoryDetail icon="tool" label="Service needed" value={booking.problem || "Mechanic service"}/><HistoryDetail icon="map-pin" label="Service address" value={locationText(booking)}/><HistoryDetail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."} last/></View>
        <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Price information</Text><HistoryDetail icon="credit-card" label="Starting price" value={booking.startingPrice || "Not specified"} last/></View>
        {wasCancelled ? <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Cancellation notice</Text><Text style={historyStyles.noticeText}>The customer cancelled this service. No further action is needed.</Text></View> : null}
        {booking.cancellationReason ? <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Owner&apos;s cancellation reason</Text><Text style={historyStyles.reasonText}>{booking.cancellationReason}</Text></View> : null}
        {booking.declineReason ? <View style={historyStyles.archiveCard}><Text style={historyStyles.sectionTitle}>Provider decline reason</Text><Text style={historyStyles.reasonText}>{booking.declineReason}</Text></View> : null}
      </ScrollView>
    </SafeAreaView>;
  }  if (!isActive) return <SafeAreaView style={styles.safeArea} edges={["top","left","right"]}>
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas}/><ScrollView style={{flex:1}} contentContainerStyle={[styles.content,{paddingBottom:18}]}>
      <View style={styles.header}><TouchableOpacity onPress={goToBookings} style={styles.back}><Feather name="chevron-left" size={28} color="#FFFFFF"/></TouchableOpacity><Text style={styles.headerTitle}>New Booking Request</Text></View>
      <BookingTimingBanner homeAppearance booking={booking} /><View style={styles.requestCard}><View style={styles.cardTop}><Text style={styles.newBadge}>New request</Text><Text style={styles.time}>Respond when ready</Text></View><Text style={styles.vehicle}>{booking.vehicle}</Text><Text style={styles.service}>{booking.problem}</Text><View style={styles.rule}/><Detail icon="map-pin" label="Customer address" value={locationText(booking)}/><Detail icon="tool" label="Service needed" value={booking.problem}/><Detail icon="file-text" label="Description" value={booking.notes?.trim() || "No additional description provided."}/><Detail icon="credit-card" label="Starting price" value={booking.startingPrice}/><View style={styles.customerRow}><View style={styles.personIcon}><Feather name="user" size={18} color={COLORS.text}/></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.customerName}>{booking.customerName}</Text><Text style={styles.customerHint}>{booking.customerPhone || "Customer"}</Text></View><TouchableOpacity style={styles.callIcon} onPress={callCustomer}><Feather name="phone" size={20} color={COLORS.text}/></TouchableOpacity></View></View>
      <View style={styles.mapPreview}><MapHtmlSurface sourceHtml={mapHtml(booking.latitude,booking.longitude,mechanicLocation?.latitude,mechanicLocation?.longitude)} style={{ flex: 1 }}/><TouchableOpacity style={styles.mapButton} onPress={openMaps}><Feather name="navigation" size={16} color="#fff"/><Text style={styles.mapButtonText}>View in Maps</Text></TouchableOpacity></View>
    </ScrollView>
    <View style={[styles.pendingFooter,{paddingBottom:Math.max(insets.bottom,12)}]}><View style={styles.actionRow}><TouchableOpacity disabled={saving} style={styles.decline} onPress={() => setDeclineVisible(true)}><Text style={styles.declineText}>Decline</Text></TouchableOpacity><TouchableOpacity disabled={saving} style={styles.primary} onPress={() => void update("accepted")}><Text style={styles.primaryText}>{saving ? "Saving…" : "Accept"}</Text></TouchableOpacity></View></View>
    <OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`} onCancel={() => setShowMapsConfirmation(false)} />
    <DeclineRequestModal visible={declineVisible} reason={declineReason} saving={saving} onReasonChange={setDeclineReason} onCancel={() => setDeclineVisible(false)} onConfirm={() => void update("rejected", declineReason)} />
  </SafeAreaView>;
  const currentStep = booking.status === "accepted" ? 0 : booking.status === "en_route" ? 1 : booking.status === "arrived" ? 2 : 3;
  const reviewCompletion = (amount: number, completionNote: string) => {
    if (!booking || saving) return;
    setSaving(true);
    void completeMechanicBooking(booking.id, amount, completionNote).then(() => {
      const completedAt = new Date().toISOString();
      setBooking({ ...booking, status: "completed", finalPrice: amount, ...(completionNote ? { completionNote } : {}), completedAt, updatedAt: completedAt });
      setCompletionFormVisible(false);
    }).catch((error) => Alert.alert("Unable to complete service", error instanceof Error ? error.message : "Please try again.")).finally(() => setSaving(false));
  };
  return <View style={styles.activeRoot}>
    <StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
    <MapHtmlSurface ref={progressMapRef} onLoadEnd={syncMapPadding} sourceHtml={mapHtml(booking.latitude,booking.longitude,mechanicLocation?.latitude,mechanicLocation?.longitude)} style={styles.map}/>
    <View onLayout={event => setOverlayTop(event.nativeEvent.layout.y + event.nativeEvent.layout.height)} style={{ position: "absolute", top: insets.top + 12, left: insets.left + 16 }}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to bookings" onPress={goToBookings} style={styles.back}><Feather name="chevron-left" size={28} color="#FFFFFF"/></TouchableOpacity></View>
    <JobProgressSheet onHeightChange={setOverlayBottom} onDetails={() => setDetailsVisible(true)} action={<TouchableOpacity disabled={saving} style={styles.bottomAction} onPress={() => { const next=nextStatus(booking.status); if(next === "completed") setCompletionFormVisible(true); else if(next) void update(next); }}><Text style={styles.primaryText}>{saving ? "Saving…" : actionLabel(booking.status)}</Text></TouchableOpacity>}>
      <View style={styles.destination}><Feather name="map-pin" size={20} color={COLORS.red}/><View style={{flex:1,minWidth:0}}><Text style={styles.destinationTitle}>Head to the customer</Text><Text style={styles.destinationText}>{locationText(booking)}</Text></View></View>
      {locationTrackingError ? <Text style={styles.locationTrackingError}>{locationTrackingError}</Text> : null}
      <TouchableOpacity style={styles.navigate} onPress={openMaps}><Feather name="navigation" size={17} color="#fff"/><Text style={styles.primaryText}>Navigate</Text></TouchableOpacity>
      <BookingTimingBanner homeAppearance booking={booking} />
      <View style={styles.etaCard}><View><Text style={styles.etaLabel}>ETA</Text><Text style={styles.eta}>8 mins</Text><Text style={styles.destinationText}>2.4 km away</Text></View><TouchableOpacity style={progressStyles.contactIconButton} onPress={callCustomer} accessibilityRole="button" accessibilityLabel="Call Vehicle Owner"><Ionicons name="call-outline" size={18} color={COLORS.primary}/></TouchableOpacity></View>
      <View style={styles.steps}>{STEPS.map((step,index)=><View key={step} style={styles.step}><View style={[styles.stepDot,index<=currentStep&&styles.stepDotActive]}>{index<currentStep&&<Feather name="check" size={10} color="#fff"/>}</View><Text style={[styles.stepText,index===currentStep&&styles.stepTextActive]}>{step}</Text></View>)}</View>
      <ReportProblemAction homeAppearance booking={booking} />
    </JobProgressSheet>
    <BookingDetailsModal visible={detailsVisible} onClose={() => setDetailsVisible(false)}>
      <BookingTimingBanner homeAppearance booking={booking} />
      <Detail icon="user" label="Customer" value={booking.customerName}/><Detail icon="phone" label="Contact" value={booking.customerPhone || "Not provided"}/><Detail icon="map-pin" label="Saved pickup" value={locationText(booking)}/><Detail icon="navigation" label="Pickup coordinates" value={booking.latitude + ", " + booking.longitude}/><Detail icon="tool" label="Service" value={booking.problem}/><Detail icon="file-text" label="Notes" value={booking.notes?.trim() || "No additional description provided."}/><Detail icon="credit-card" label="Starting price" value={booking.startingPrice}/>
      <Detail icon="truck" label="Vehicle" value={booking.vehicle}/>
      <Detail icon="calendar" label="Vehicle year" value={String(booking.vehicleYear)}/>
      <Detail icon="hash" label="Plate" value={booking.vehiclePlate}/>
      <Detail icon="file-text" label="Booking ID" value={booking.id}/>
      {booking.declineReason ? <Detail icon="message-circle" label="Decline reason" value={booking.declineReason}/> : null}
      {booking.cancellationReason ? <Detail icon="message-circle" label="Cancellation reason" value={booking.cancellationReason}/> : null}
    </BookingDetailsModal>
    <FinalPriceCompletionModal appearance="mechanic" visible={completionFormVisible} saving={saving} onCancel={() => setCompletionFormVisible(false)} onReview={reviewCompletion} />
    <OpenGoogleMapsModal visible={showMapsConfirmation} url={`https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`} onCancel={() => setShowMapsConfirmation(false)} />
  </View>;
}
function Detail({icon,label,value}:{icon:keyof typeof Feather.glyphMap;label:string;value:string}) { return <View style={styles.detail}><Feather name={icon} size={18} color={COLORS.muted}/><View style={{flex:1,minWidth:0}}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>; }
function HistoryDetail({icon,label,value,last=false}:{icon:keyof typeof Feather.glyphMap;label:string;value:string;last?:boolean}) { return <View style={[historyStyles.detailRow,last && historyStyles.detailRowLast]}><Feather name={icon} size={16} color={COLORS.muted}/><Text style={historyStyles.detailLabel}>{label}</Text><Text style={historyStyles.detailValue}>{value || "Not provided"}</Text></View>; }
const historyStyles = StyleSheet.create({
  pastSafe: { backgroundColor: COLORS.primary },
  detailHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: COLORS.primary },
  detailBack: { width: 44, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, detailHeaderTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 24, fontWeight: '700', flex: 1 },
  detailScroll: { flex: 1, backgroundColor: COLORS.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }, detailContent: { paddingHorizontal: 16, paddingTop: 16 },
  reportFooter: { backgroundColor: COLORS.canvas },
  archiveCard: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 3 }, default: {} }) },
  eyebrow: { fontSize: 10, fontWeight: '800', color: COLORS.primaryDark, letterSpacing: 1, marginBottom: 5 },
  archiveTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  completedStatus: { color: COLORS.green },
  archiveDate: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 }, detailLabel: { fontSize: 12, color: COLORS.muted, width: 90 },
  detailValue: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500', color: COLORS.text, textAlign: 'right' },
  reasonText: { fontSize: 13, lineHeight: 19, color: COLORS.text }, noticeText: { fontSize: 13, lineHeight: 19, color: '#9A5B00' }
});
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas }, content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  loading: { flex: 1, backgroundColor: COLORS.canvas, justifyContent: 'center', alignItems: 'center', gap: 18 }, loadingText: { color: COLORS.text, fontSize: 17 },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, back: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.primary }, backText: { color: COLORS.text, fontSize: 16 }, headerTitle: { color: COLORS.text, fontSize: 19, fontWeight: '700', flex: 1, flexShrink: 1 }, activeHeaderTitle: { color: '#FFFFFF' },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#EAF6EE', borderRadius: 14, padding: 15, marginBottom: 12 }, cancelledBanner: { backgroundColor: '#FDECEF' },
  recordEyebrow: { color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 3 }, recordSectionTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 10, marginTop: 5 }, completedTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' }, completedDate: { color: COLORS.muted, fontSize: 13, marginTop: 3 }, completedCard: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16 }, recordVehicle: { color: COLORS.text, fontSize: 23, fontWeight: '700' }, recordPlate: { color: COLORS.muted, fontSize: 15, marginTop: 4 }, feeBlock: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 14, marginTop: 2 }, completedFee: { color: COLORS.text, fontSize: 25, fontWeight: '700', marginTop: 4 }, cancelledDetailNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#FFF4E5', borderRadius: 14, padding: 12, marginTop: 4 }, cancelledDetailText: { color: '#9A5B00', fontSize: 13, lineHeight: 19, flex: 1 },
  requestCard: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 13, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 }, default: {} }) }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, newBadge: { backgroundColor: '#FFF4E5', color: '#9A5B00', fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, time: { color: COLORS.muted, fontSize: 13, flexShrink: 1, textAlign: 'right' }, vehicle: { color: COLORS.text, fontSize: 23, lineHeight: 30, fontWeight: '700', marginTop: 16 }, service: { color: COLORS.muted, fontSize: 16, lineHeight: 23, marginTop: 5 }, rule: { height: 1, backgroundColor: COLORS.line, marginVertical: 16 },
  detail: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 14 }, detailLabel: { color: COLORS.muted, fontSize: 12 }, detailValue: { color: COLORS.text, fontSize: 15, lineHeight: 21, marginTop: 2, flexShrink: 1 }, customerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 }, personIcon: { height: 42, width: 42, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, customerName: { color: COLORS.text, fontSize: 16, fontWeight: '700', flexShrink: 1 }, customerHint: { color: COLORS.muted, fontSize: 13, marginTop: 2 }, callIcon: { marginLeft: 'auto', height: 46, width: 46, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.subtle },
  mapPreview: { height: 185, borderRadius: 14, overflow: 'hidden', marginTop: 14, position: 'relative', backgroundColor: COLORS.subtle }, mapButton: { position: 'absolute', right: 12, bottom: 12, minHeight: 46, backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, mapButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }, pendingFooter: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.canvas, borderTopWidth: 1, borderTopColor: COLORS.line }, actionRow: { flexDirection: 'row', gap: 12 }, decline: { minHeight: 54, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#FDECEF' }, declineText: { color: COLORS.red, fontSize: 15, fontWeight: '700' }, primary: { minHeight: 54, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.blue }, primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  activeRoot: { flex: 1, backgroundColor: COLORS.canvas }, map: { ...StyleSheet.absoluteFillObject }, activeHeader: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 56, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, topJobCard: { position: 'absolute', top: 84, left: 16, right: 16, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 14, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 6 }, default: {} }) }, destination: { backgroundColor: COLORS.subtle, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, destinationTitle: { color: COLORS.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }, destinationText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 3, flexShrink: 1 }, locationTrackingError: { color: COLORS.red, fontSize: 12, lineHeight: 17, marginTop: 8 }, navigate: { minHeight: 54, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  jobPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16, gap: 10, ...Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 8 }, default: {} }) }, etaCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: COLORS.subtle, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }, etaLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, eta: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 2 }, callCustomer: { flexDirection: 'row', gap: 6, alignItems: 'center', borderColor: COLORS.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 46, backgroundColor: COLORS.card }, callCustomerText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  steps: { paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' }, step: { flex: 1, alignItems: 'center' }, stepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#8A96A6', alignItems: 'center', justifyContent: 'center' }, stepDotActive: { borderColor: COLORS.blue, backgroundColor: COLORS.blue }, stepText: { color: COLORS.muted, fontSize: 9, marginTop: 5, textAlign: 'center' }, stepTextActive: { color: COLORS.text, fontWeight: '700' }, bottomAction: { minHeight: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.blue, borderRadius: 14, marginTop: 4 }
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
