// app/(onsite-mechanic)/request-details.tsx
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#2E7D32",
  successMuted: "#E8F5E9",
};

type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED";

interface ServiceRequestDetail {
  id: string;
  customerName: string;
  phone: string;
  vehicle: string;
  year: number;
  plate: string;
  serviceType: string;
  problem: string;
  location: string;
  distanceKm: number;
  estimatedFee: string;
  status: RequestStatus;
  latitude: number;
  longitude: number;
}

// Mock data — kept in sync with requests.tsx
const MOCK_REQUEST_DETAILS: Record<string, ServiceRequestDetail> = {
  "req-001": {
    id: "req-001",
    customerName: "Maria Santos",
    phone: "0917 456 7821",
    vehicle: "Toyota Vios",
    year: 2020,
    plate: "ABC 1234",
    serviceType: "Battery Replacement",
    problem: "Vehicle won't start and battery appears weak.",
    location: "Quezon City",
    distanceKm: 2.4,
    estimatedFee: "\u20B1650",
    status: "PENDING",
    latitude: 14.6507,
    longitude: 121.0687,
  },
  "req-002": {
    id: "req-002",
    customerName: "Carlos Reyes",
    phone: "0918 234 6712",
    vehicle: "Honda Civic",
    year: 2019,
    plate: "DEF 5678",
    serviceType: "Engine Diagnostics",
    problem: "Engine warning light is on and vehicle is losing power.",
    location: "Diliman, Quezon City",
    distanceKm: 4.1,
    estimatedFee: "\u20B1900",
    status: "PENDING",
    latitude: 14.6532,
    longitude: 121.0645,
  },
  "req-003": {
    id: "req-003",
    customerName: "Angela Cruz",
    phone: "0920 781 3456",
    vehicle: "Mitsubishi Mirage",
    year: 2021,
    plate: "GHI 9012",
    serviceType: "Tire Replacement",
    problem: "Flat front-right tire.",
    location: "Cubao, Quezon City",
    distanceKm: 5.8,
    estimatedFee: "\u20B1750",
    status: "PENDING",
    latitude: 14.6198,
    longitude: 121.0561,
  },
};

// Aliases so older IDs (used on the Home dashboard) still resolve correctly
// without needing to touch index.tsx.
const LEGACY_ID_ALIASES: Record<string, string> = {
  "req-1": "req-001",
  "req-2": "req-002",
  "req-3": "req-003",
};

function resolveRequestId(rawId: string): string {
  return LEGACY_ID_ALIASES[rawId] ?? rawId;
}

// Mock current mechanic location — used as the map's origin point.
const MECHANIC_LOCATION = {
  latitude: 14.6485,
  longitude: 121.0635,
};

// ---------------------------------------------------------------------------
// LEAFLET MAP HTML (real OSM tiles inside a WebView — same approach as the
// (owner) dashboard map: no API key, no react-native-maps dependency)
// ---------------------------------------------------------------------------
function buildMapHtml(
  mechanic: { latitude: number; longitude: number },
  customer: { latitude: number; longitude: number },
  distanceKm: number,
  accentColor: string
) {
  const midLat = (mechanic.latitude + customer.latitude) / 2;
  const midLng = (mechanic.longitude + customer.longitude) / 2;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F5EFEE; }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }

    .mechanic-wrap { position: relative; width: 26px; height: 26px; }
    .mechanic-ring {
      position: absolute; top: 50%; left: 50%;
      width: 56px; height: 56px;
      margin-left: -28px; margin-top: -28px;
      border-radius: 50%;
      background: ${accentColor};
      opacity: 0.22;
      animation: pulse 1.8s ease-out infinite;
    }
    .mechanic-dot {
      position: absolute; top: 50%; left: 50%;
      width: 20px; height: 20px;
      margin-left: -10px; margin-top: -10px;
      border-radius: 50%;
      background: ${accentColor};
      border: 3px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    @keyframes pulse {
      0%   { transform: scale(0.4); opacity: 0.35; }
      70%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    .customer-pin {
      width: 30px; height: 30px;
      border-radius: 15px;
      background: #fff;
      border: 2px solid ${accentColor};
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    .customer-pin-dot { width: 10px; height: 10px; border-radius: 5px; background: ${accentColor}; }

    .distance-label {
      background: #1A1A1A;
      color: #fff;
      font-family: -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([${midLat}, ${midLng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var mechanicIcon = L.divIcon({
      className: '',
      html: '<div class="mechanic-wrap"><div class="mechanic-ring"></div><div class="mechanic-dot"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([${mechanic.latitude}, ${mechanic.longitude}], { icon: mechanicIcon, zIndexOffset: 1000 }).addTo(map);

    var customerIcon = L.divIcon({
      className: '',
      html: '<div class="customer-pin"><div class="customer-pin-dot"></div></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([${customer.latitude}, ${customer.longitude}], { icon: customerIcon }).addTo(map);

    L.polyline(
      [[${mechanic.latitude}, ${mechanic.longitude}], [${customer.latitude}, ${customer.longitude}]],
      { color: '${accentColor}', weight: 3, dashArray: '6,6', opacity: 0.85 }
    ).addTo(map);

    var distanceIcon = L.divIcon({
      className: '',
      html: '<div class="distance-label">${distanceKm} km</div>',
      iconSize: [0, 0],
    });
    L.marker([${midLat}, ${midLng}], { icon: distanceIcon }).addTo(map);

    map.fitBounds(
      L.latLngBounds([
        [${mechanic.latitude}, ${mechanic.longitude}],
        [${customer.latitude}, ${customer.longitude}],
      ]),
      { padding: [70, 70] }
    );
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// BOTTOM SHEET SNAP POINTS
// ---------------------------------------------------------------------------
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_COLLAPSED = Math.round(SCREEN_HEIGHT * 0.2);
const SHEET_EXPANDED = Math.round(SCREEN_HEIGHT * 0.74);
const SNAP_POINTS = [SHEET_COLLAPSED, SHEET_EXPANDED];

function nearestSnapPoint(value: number) {
  return SNAP_POINTS.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest
  );
}

function handleCall(phone: string) {
  const dialable = phone.replace(/[^\d+]/g, "");
  const url = `tel:${dialable}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.warn("Calling is not supported on this device.");
      }
    })
    .catch((error) => console.error("Failed to open dialer:", error));
}

export default function RequestDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const request = useMemo(() => {
    if (typeof id !== "string") return undefined;
    return MOCK_REQUEST_DETAILS[resolveRequestId(id)];
  }, [id]);

  // Local UI-only state — no Firebase, no persistence.
  const [localStatus, setLocalStatus] = useState<RequestStatus | null>(null);

  const mapHtml = useMemo(() => {
    if (!request) return "";
    return buildMapHtml(MECHANIC_LOCATION, request, request.distanceKm, COLORS.primary);
  }, [request]);

  // ---- Draggable bottom sheet (same PanResponder pattern as the owner map) ----
  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightValueRef = useRef(SHEET_COLLAPSED);
  const dragStartHeightRef = useRef(SHEET_COLLAPSED);

  useMemo(() => {
    sheetHeight.addListener(({ value }) => {
      sheetHeightValueRef.current = value;
    });
  }, [sheetHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        dragStartHeightRef.current = sheetHeightValueRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const raw = dragStartHeightRef.current - gestureState.dy;
        const clamped = Math.min(SHEET_EXPANDED, Math.max(SHEET_COLLAPSED, raw));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const raw = dragStartHeightRef.current - gestureState.dy;
        const target = nearestSnapPoint(raw);
        Animated.spring(sheetHeight, {
          toValue: target,
          useNativeDriver: false,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  if (!request) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
        </View>
        <View style={styles.notFound}>
          <Feather name="alert-circle" size={22} color={COLORS.textMuted} />
          <Text style={styles.notFoundText}>Request not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayStatus = localStatus ?? request.status;

  const statusColors =
    displayStatus === "ACCEPTED"
      ? { bg: COLORS.primaryMuted, fg: COLORS.primary }
      : displayStatus === "DECLINED"
      ? { bg: COLORS.sectionBackground, fg: COLORS.textMuted }
      : displayStatus === "COMPLETED"
      ? { bg: COLORS.successMuted, fg: COLORS.success }
      : { bg: COLORS.sectionBackground, fg: COLORS.textMuted };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Fullscreen map — fills the entire screen behind everything */}
      <WebView
        key={request.id}
        source={{ html: mapHtml }}
        style={styles.fullscreenMap}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
      />

      {/* Header floats over the map */}
      <SafeAreaView style={styles.topOverlay} edges={["top"]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerFloatingTitle}>Request</Text>
          <View style={styles.backButtonSpacer} />
        </View>
      </SafeAreaView>

      {/* Draggable bottom sheet */}
      <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >
          {/* Collapsed summary row — remains visible near the top when collapsed */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryName}>{request.customerName}</Text>
              <Text style={styles.summaryService}>{request.serviceType}</Text>
            </View>
            <View style={styles.summaryRightWrap}>
              <Text style={styles.summaryLocation}>{request.location}</Text>
              <Text style={styles.summaryFee}>{request.estimatedFee}</Text>
            </View>
          </View>

          <View style={styles.sheetDivider} />

          {/* Expanded content */}
          <View style={styles.expandedHeaderRow}>
            <Text style={styles.expandedTitle}>REQUEST DETAILS</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColors.fg }]}>
                {displayStatus}
              </Text>
            </View>
          </View>

          {displayStatus === "ACCEPTED" && (
            <Text style={styles.acceptedNote}>Request Accepted</Text>
          )}

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Customer</Text>
            <View style={styles.detailRow}>
              <Feather name="user" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.customerName}</Text>
            </View>
            <View style={styles.callRow}>
              <Feather name="phone" size={14} color={COLORS.primary} />
              <Text style={styles.callText}>{request.phone}</Text>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.chatBadge}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/(onsite-mechanic)/chat",
                      params: { id: request.id, customerName: request.customerName },
                    })
                  }
                >
                  <Feather name="message-circle" size={13} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.callBadge}
                  activeOpacity={0.7}
                  onPress={() => handleCall(request.phone)}
                >
                  <Feather name="phone-call" size={11} color="#FFFFFF" />
                  <Text style={styles.callBadgeText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Vehicle</Text>
            <View style={styles.detailRow}>
              <Feather name="truck" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.vehicle}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="hash" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>
                {request.year} &middot; {request.plate}
              </Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Service</Text>
            <View style={styles.detailRow}>
              <Feather name="tool" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.serviceType}</Text>
            </View>
            <Text style={styles.problemText}>{request.problem}</Text>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Location</Text>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="navigation" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.distanceKm} km away</Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Estimated Fee</Text>
            <Text style={styles.feeText}>{request.estimatedFee}</Text>
          </View>

          {/* Action buttons — local UI state only */}
          {displayStatus === "PENDING" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => setLocalStatus("DECLINED")}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => setLocalStatus("ACCEPTED")}
              >
                <Text style={styles.acceptButtonText}>Accept Request</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  fullscreenMap: { ...StyleSheet.absoluteFillObject },

  // Legacy full-screen state kept for the not-found view
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  notFoundText: { fontSize: 13, color: COLORS.textMuted },

  // Floating header over the map
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backButtonSpacer: { width: 38, height: 38 },
  headerFloatingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  // Bottom sheet
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    overflow: "hidden",
  },
  dragHandleArea: { paddingTop: 10, paddingBottom: 8, alignItems: "center" },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 12 },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryTextWrap: { flex: 1, gap: 2 },
  summaryName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  summaryService: { fontSize: 12, color: "#FFFFFF", fontWeight: "600" },
  summaryRightWrap: { alignItems: "flex-end", gap: 2 },
  summaryLocation: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  summaryFee: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  sheetDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  expandedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  expandedTitle: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  acceptedNote: { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginTop: 6 },

  detailBlock: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  detailText: { fontSize: 13, color: COLORS.text },
  problemText: { fontSize: 13, color: COLORS.text, lineHeight: 19, marginTop: 2 },
  feeText: { fontSize: 20, fontWeight: "700", color: COLORS.primary },

  callRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  callText: { fontSize: 13, color: COLORS.primary, fontWeight: "600", flex: 1 },
  contactActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  callBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  callBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 22 },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  declineButtonText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  acceptButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  acceptButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
});