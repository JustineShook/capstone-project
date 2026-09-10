// app/(towing-company)/request-details.tsx
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { auth } from "../../services/firebase";
import { getTowingBookingById, updateTowingBookingStatus } from "../../services/owner/towingService";
import { getPublicProviderListing } from "../../services/publicProviderListingService";

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

type RequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

type RequestPriority = "HIGH" | "MEDIUM" | "LOW";

interface TowingRequestDetail {
  id: string;
  customerName: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleType: string;
  requestType: string;
  problem: string;
  pickupLocation: string;
  pickupAddress: string;
  destination: string;
  destinationAddress: string;
  distanceKm: number;
  estimatedFee: string;
  status: RequestStatus;
  priority: RequestPriority;
  latitude: number;
  longitude: number;
}

// Mock data — kept in sync with requests.tsx (tow-001, tow-002, ...)
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for legacy dashboard deep links
const MOCK_REQUEST_DETAILS: Record<string, TowingRequestDetail> = {
  "tow-001": {
    id: "tow-001",
    customerName: "Maria Santos",
    phone: "0917 456 7821",
    vehicleMake: "Toyota",
    vehicleModel: "Vios",
    vehicleYear: 2020,
    vehicleType: "Car",
    requestType: "Emergency Towing",
    problem: "Vehicle suddenly stopped and will not start.",
    pickupLocation: "Quezon City",
    pickupAddress: "Commonwealth Avenue, Quezon City",
    destination: "Auto Repair Shop",
    destinationAddress: "Diliman, Quezon City",
    distanceKm: 3.2,
    estimatedFee: "\u20B11,200",
    status: "PENDING",
    priority: "HIGH",
    latitude: 14.676,
    longitude: 121.0437,
  },
  "tow-002": {
    id: "tow-002",
    customerName: "Carlos Reyes",
    phone: "0918 223 4456",
    vehicleMake: "Honda",
    vehicleModel: "Civic",
    vehicleYear: 2019,
    vehicleType: "Car",
    requestType: "Vehicle Breakdown",
    problem: "Engine overheated and shut off on the road.",
    pickupLocation: "Commonwealth Avenue",
    pickupAddress: "Commonwealth Avenue cor. Regalado, Quezon City",
    destination: "Quezon City Auto Center",
    destinationAddress: "Tandang Sora, Quezon City",
    distanceKm: 5.6,
    estimatedFee: "\u20B11,800",
    status: "ACCEPTED",
    priority: "MEDIUM",
    latitude: 14.6929,
    longitude: 121.0805,
  },
  "tow-003": {
    id: "tow-003",
    customerName: "Angela Cruz",
    phone: "0920 774 1198",
    vehicleMake: "Mitsubishi",
    vehicleModel: "Mirage",
    vehicleYear: 2021,
    vehicleType: "Car",
    requestType: "Flat Tire / Roadside Assistance",
    problem: "Rear tire blowout, spare tire not available.",
    pickupLocation: "Cubao",
    pickupAddress: "Gen. Araneta Avenue, Cubao, Quezon City",
    destination: "Customer's preferred shop",
    destinationAddress: "Aurora Boulevard, Cubao, Quezon City",
    distanceKm: 4.8,
    estimatedFee: "\u20B11,500",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    latitude: 14.6199,
    longitude: 121.0528,
  },
  "tow-004": {
    id: "tow-004",
    customerName: "Jerome Bautista",
    phone: "0915 662 9034",
    vehicleMake: "Ford",
    vehicleModel: "Ranger",
    vehicleYear: 2018,
    vehicleType: "Pickup Truck",
    requestType: "Accident Recovery",
    problem: "Minor collision, front bumper detached, vehicle undrivable.",
    pickupLocation: "Katipunan Avenue",
    pickupAddress: "Katipunan Avenue, Loyola Heights, Quezon City",
    destination: "Ford Service Center",
    destinationAddress: "E. Rodriguez Sr. Avenue, Quezon City",
    distanceKm: 6.1,
    estimatedFee: "\u20B12,400",
    status: "COMPLETED",
    priority: "HIGH",
    latitude: 14.6394,
    longitude: 121.0774,
  },
  "tow-005": {
    id: "tow-005",
    customerName: "Patricia Lim",
    phone: "0927 331 8850",
    vehicleMake: "Suzuki",
    vehicleModel: "Ertiga",
    vehicleYear: 2022,
    vehicleType: "Van",
    requestType: "Battery / Won't Start",
    problem: "Dead battery, requested tow to nearest service center instead of jumpstart.",
    pickupLocation: "Fairview",
    pickupAddress: "Fairview Terraces, Quezon City",
    destination: "Suzuki Auto Service",
    destinationAddress: "Regalado Avenue, Fairview, Quezon City",
    distanceKm: 2.9,
    estimatedFee: "\u20B11,000",
    status: "DECLINED",
    priority: "LOW",
    latitude: 14.7369,
    longitude: 121.0555,
  },
  "tow-006": {
    id: "tow-006",
    customerName: "Michael Tan",
    phone: "0933 118 6620",
    vehicleMake: "Nissan",
    vehicleModel: "Navara",
    vehicleYear: 2017,
    vehicleType: "SUV",
    requestType: "Vehicle Breakdown",
    problem: "Transmission issue, vehicle stuck in gear.",
    pickupLocation: "Novaliches",
    pickupAddress: "Quirino Highway, Novaliches, Quezon City",
    destination: "Nissan Service Center",
    destinationAddress: "Mindanao Avenue, Quezon City",
    distanceKm: 7.3,
    estimatedFee: "\u20B12,000",
    status: "CANCELLED",
    priority: "LOW",
    latitude: 14.7306,
    longitude: 121.0402,
  },
  "tow-007": {
    id: "tow-007",
    customerName: "Rachel Aquino",
    phone: "0916 809 2277",
    vehicleMake: "Kia",
    vehicleModel: "Soluto",
    vehicleYear: 2021,
    vehicleType: "Car",
    requestType: "Emergency Towing",
    problem: "Car stalled in the middle of an intersection during rain.",
    pickupLocation: "Timog Avenue",
    pickupAddress: "Timog Avenue, Quezon City",
    destination: "Kia Service Center",
    destinationAddress: "Quezon Avenue, Quezon City",
    distanceKm: 3.9,
    estimatedFee: "\u20B11,350",
    status: "PENDING",
    priority: "HIGH",
    latitude: 14.6377,
    longitude: 121.0367,
  },
};

// Mock current tow truck location — used as the map's origin point.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- real requests use the provider's public listing location
const TOW_TRUCK_LOCATION = {
  latitude: 14.6485,
  longitude: 121.0635,
};

// ---------------------------------------------------------------------------
// LEAFLET MAP HTML (real OSM tiles inside a WebView — same approach as the
// onsite-mechanic request-details map: no API key, no react-native-maps dep)
// Primary route shown: Tow Truck -> Pickup (that's where the provider needs
// to go first). Destination is shown as additional info in the sheet, not
// plotted on this map.
// ---------------------------------------------------------------------------
function buildMapHtml(
  towTruck: { latitude: number; longitude: number },
  pickup: { latitude: number; longitude: number },
  distanceKm: number,
  accentColor: string
) {
  const midLat = (towTruck.latitude + pickup.latitude) / 2;
  const midLng = (towTruck.longitude + pickup.longitude) / 2;

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

    .truck-wrap { position: relative; width: 26px; height: 26px; }
    .truck-ring {
      position: absolute; top: 50%; left: 50%;
      width: 56px; height: 56px;
      margin-left: -28px; margin-top: -28px;
      border-radius: 50%;
      background: ${accentColor};
      opacity: 0.22;
      animation: pulse 1.8s ease-out infinite;
    }
    .truck-dot {
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

    .pickup-pin {
      width: 30px; height: 30px;
      border-radius: 15px;
      background: #fff;
      border: 2px solid ${accentColor};
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    .pickup-pin-dot { width: 10px; height: 10px; border-radius: 5px; background: ${accentColor}; }

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

    var truckIcon = L.divIcon({
      className: '',
      html: '<div class="truck-wrap"><div class="truck-ring"></div><div class="truck-dot"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([${towTruck.latitude}, ${towTruck.longitude}], { icon: truckIcon, zIndexOffset: 1000 }).addTo(map);

    var pickupIcon = L.divIcon({
      className: '',
      html: '<div class="pickup-pin"><div class="pickup-pin-dot"></div></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([${pickup.latitude}, ${pickup.longitude}], { icon: pickupIcon }).addTo(map);

    L.polyline(
      [[${towTruck.latitude}, ${towTruck.longitude}], [${pickup.latitude}, ${pickup.longitude}]],
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
        [${towTruck.latitude}, ${towTruck.longitude}],
        [${pickup.latitude}, ${pickup.longitude}],
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

// ---------------------------------------------------------------------------
// SERVICE PROGRESS TRACKER (UI/demo only — separate from RequestStatus)
// A tappable local timeline so the provider can walk through the towing
// job stages manually. Purely local useState, no persistence.
// ---------------------------------------------------------------------------
const SERVICE_PROGRESS_STEPS = [
  { key: "pending", label: "Booking Submitted", icon: "clipboard" as const },
  { key: "accepted", label: "Provider Accepted", icon: "check" as const },
  { key: "en_route", label: "Tow Truck En Route", icon: "navigation" as const },
  { key: "arrived", label: "Arrived at Pickup", icon: "map-pin" as const },
  { key: "in_progress", label: "Tow In Progress", icon: "truck" as const },
  { key: "completed", label: "Tow Completed", icon: "check-circle" as const },
];

export default function RequestDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [request, setRequest] = useState<TowingRequestDetail>();
  const [towTruckLocation, setTowTruckLocation] = useState<{ latitude: number; longitude: number }>();

  useEffect(() => {
    if (typeof id !== "string") return;
    void getTowingBookingById(id).then((item) => {
      if (!item) return;
      const vehicleParts = item.vehicle.split(" ");
      setRequest({ id: item.id, customerName: item.customerName, phone: item.customerEmail,
        vehicleMake: vehicleParts[0] ?? item.vehicle, vehicleModel: vehicleParts.slice(1).join(" "),
        vehicleYear: item.vehicleYear, vehicleType: "Vehicle", requestType: item.towingType,
        problem: item.vehicleCondition + (item.notes ? ` — ${item.notes}` : ""), pickupLocation: item.pickupLocation,
        pickupAddress: item.pickupLocation, destination: item.destination, destinationAddress: item.destination,
        distanceKm: item.totalDistanceKm, estimatedFee: `₱${(item.estimatedTotalPrice ?? item.estimatedPrice ?? 0).toLocaleString("en-PH")}`,
        status: item.status === "pending" ? "PENDING" : item.status === "accepted" ? "ACCEPTED" : item.status === "en_route" ? "EN_ROUTE" : item.status === "arrived" ? "ARRIVED" : item.status === "in_progress" ? "IN_PROGRESS" : item.status === "completed" ? "COMPLETED" : item.status === "rejected" ? "DECLINED" : "CANCELLED",
        priority: "MEDIUM", latitude: item.latitude, longitude: item.longitude });
    });
    const uid = auth.currentUser?.uid;
    if (uid) void getPublicProviderListing(uid).then((listing) => listing && setTowTruckLocation(listing.location));
  }, [id]);

  // Local UI-only state — no Firebase, no persistence.
  const [localStatus, setLocalStatus] = useState<RequestStatus | null>(null);

  const mapHtml = useMemo(() => {
    if (!request || !towTruckLocation) return "";
    return buildMapHtml(towTruckLocation, request, request.distanceKm, COLORS.primary);
  }, [request, towTruckLocation]);

  const persistStatus = async (status: RequestStatus) => {
    if (!request) return;
    const persisted = status === "DECLINED" ? "rejected" : status.toLowerCase() as "accepted" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled";
    await updateTowingBookingStatus(request.id, persisted);
    setLocalStatus(status);
  };

  // ---- Draggable bottom sheet (same PanResponder pattern as onsite-mechanic) ----
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
  const progressStepIndex = SERVICE_PROGRESS_STEPS.findIndex((step) => step.key === displayStatus.toLowerCase());

  const statusColors =
    displayStatus === "ACCEPTED" || displayStatus === "EN_ROUTE" || displayStatus === "ARRIVED"
      ? { bg: COLORS.primaryMuted, fg: COLORS.primary }
      : displayStatus === "IN_PROGRESS"
      ? { bg: "#E0E7FF", fg: "#3730A3" }
      : displayStatus === "DECLINED" || displayStatus === "CANCELLED"
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
              <Text style={styles.summaryService}>{request.requestType}</Text>
            </View>
            <View style={styles.summaryRightWrap}>
              <Text style={styles.summaryLocation}>{request.pickupLocation}</Text>
              <Text style={styles.summaryFee}>{request.estimatedFee}</Text>
            </View>
          </View>

          <View style={styles.sheetDivider} />

          {/* Expanded content */}
          <View style={styles.expandedHeaderRow}>
            <Text style={styles.expandedTitle}>REQUEST DETAILS</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColors.fg }]}>
                {displayStatus.replace("_", " ")}
              </Text>
            </View>
          </View>

          {displayStatus === "ACCEPTED" && (
            <Text style={styles.acceptedNote}>Request Accepted</Text>
          )}
          {displayStatus === "IN_PROGRESS" && (
            <Text style={styles.acceptedNote}>Tow In Progress</Text>
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
                      pathname: "/(towing-company)/chat",
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
              <Text style={styles.detailText}>
                {request.vehicleMake} {request.vehicleModel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="hash" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>
                {request.vehicleYear} &middot; {request.vehicleType}
              </Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Towing</Text>
            <View style={styles.detailRow}>
              <Feather name="tool" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.requestType}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="alert-triangle" size={14} color={COLORS.textMuted} />
              <Text style={styles.problemText}>{request.problem}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="flag" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>Priority: {request.priority}</Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Pickup</Text>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.pickupLocation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="navigation" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Destination</Text>
            <View style={styles.detailRow}>
              <Feather name="flag" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.destination}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="navigation" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.destinationAddress}</Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Distance</Text>
            <View style={styles.detailRow}>
              <Feather name="map" size={14} color={COLORS.textMuted} />
              <Text style={styles.detailText}>{request.distanceKm} km</Text>
            </View>
          </View>

          <View style={styles.detailBlock}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.blockLabel}>SERVICE PROGRESS</Text>
            </View>

            {SERVICE_PROGRESS_STEPS.map((step, index) => {
              const isCompleted = index < progressStepIndex;
              const isActive = index === progressStepIndex;
              const isFuture = index > progressStepIndex;
              const isLastStep = index === SERVICE_PROGRESS_STEPS.length - 1;

              return (
                <View
                  key={step.key}
                  style={styles.progressStepRow}
                >
                  <View style={styles.progressIconColumn}>
                    <View
                      style={[
                        styles.progressIconCircle,
                        isCompleted && styles.progressIconCircleCompleted,
                        isActive && styles.progressIconCircleActive,
                        isFuture && styles.progressIconCircleFuture,
                      ]}
                    >
                      <Feather
                        name={isCompleted ? "check" : step.icon}
                        size={13}
                        color={isCompleted || isActive ? "#FFFFFF" : COLORS.textMuted}
                      />
                    </View>
                    {!isLastStep && (
                      <View
                        style={[
                          styles.progressConnector,
                          isCompleted && styles.progressConnectorCompleted,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.progressLabelColumn}>
                    <Text
                      style={[
                        styles.progressLabelText,
                        isActive && styles.progressLabelTextActive,
                        isFuture && styles.progressLabelTextFuture,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {isActive && (
                      <Text style={styles.progressActiveTag}>Current Step</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.blockLabel}>Estimated Towing Fee</Text>
            <Text style={styles.feeText}>{request.estimatedFee}</Text>
          </View>

          {/* Action buttons — local UI state only */}
          {displayStatus === "PENDING" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => void persistStatus("DECLINED")}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => void persistStatus("ACCEPTED")}
              >
                <Text style={styles.acceptButtonText}>Accept Request</Text>
              </TouchableOpacity>
            </View>
          )}

          {displayStatus === "ACCEPTED" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => void persistStatus("CANCELLED")}
              >
                <Text style={styles.declineButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => void persistStatus("EN_ROUTE")}
              >
                <Text style={styles.acceptButtonText}>Start Route</Text>
              </TouchableOpacity>
            </View>
          )}

          {displayStatus === "EN_ROUTE" && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.declineButton} onPress={() => void persistStatus("CANCELLED")}><Text style={styles.declineButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={() => void persistStatus("ARRIVED")}><Text style={styles.acceptButtonText}>Mark Arrived</Text></TouchableOpacity>
            </View>
          )}

          {displayStatus === "ARRIVED" && (
            <TouchableOpacity style={styles.acceptButton} onPress={() => void persistStatus("IN_PROGRESS")}><Text style={styles.acceptButtonText}>Start Tow</Text></TouchableOpacity>
          )}

          {displayStatus === "IN_PROGRESS" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => void persistStatus("COMPLETED")}
              >
                <Text style={styles.acceptButtonText}>Complete Tow</Text>
              </TouchableOpacity>
            </View>
          )}

          {displayStatus === "COMPLETED" && (
            <View style={styles.completedBanner}>
              <Feather name="check-circle" size={18} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.completedBannerTitle}>Tow Completed</Text>
                <Text style={styles.completedBannerText}>
{request.customerName}
{"'"}s vehicle was towed to {request.destination} for{" "}
                  {request.estimatedFee}.
                </Text>
              </View>
            </View>
          )}

          {(displayStatus === "DECLINED" || displayStatus === "CANCELLED") && (
            <View style={styles.mutedBanner}>
              <Feather name="info" size={18} color={COLORS.textMuted} />
              <Text style={styles.mutedBannerText}>
                This request was {displayStatus.toLowerCase()} and is no longer active.
              </Text>
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
  detailText: { fontSize: 13, color: COLORS.text, flex: 1 },
  problemText: { fontSize: 13, color: COLORS.text, lineHeight: 19, flex: 1 },
  feeText: { fontSize: 20, fontWeight: "700", color: COLORS.primary },

  // Service progress tracker (UI/demo only)
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resetProgressText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },
  progressStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  progressIconColumn: {
    alignItems: "center",
    width: 26,
  },
  progressIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.sectionBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressIconCircleCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  progressIconCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressIconCircleFuture: {
    backgroundColor: COLORS.sectionBackground,
    borderColor: COLORS.border,
  },
  progressConnector: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  progressConnectorCompleted: {
    backgroundColor: COLORS.success,
  },
  progressLabelColumn: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 18,
  },
  progressLabelText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  progressLabelTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  progressLabelTextFuture: {
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  progressActiveTag: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  nextStepButton: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  nextStepButtonDisabled: {
    opacity: 0.75,
  },
  nextStepButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nextStepButtonTextDisabled: {
    color: "rgba(255,255,255,0.85)",
  },

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
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.sectionBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "600", color: COLORS.text },

  completedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: COLORS.successMuted,
    borderRadius: 12,
    padding: 16,
    marginTop: 22,
  },
  completedBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.success,
    marginBottom: 3,
  },
  completedBannerText: { fontSize: 12, color: COLORS.success, lineHeight: 17 },

  mutedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: COLORS.sectionBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 22,
  },
  mutedBannerText: { fontSize: 12, color: COLORS.textMuted, flex: 1, lineHeight: 17 },
});
